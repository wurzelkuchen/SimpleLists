import { CONFIG } from '../config.js';
import { generateUUID } from './crypto.js';
import { syncLogger } from './logger.js';

/**
 * Helper to wait for ICE candidate gathering to finish (or max timeout),
 * bundling all host & STUN candidates directly into a single SDP offer/answer.
 * This completely eliminates the need to send rapid-fire individual candidate signals.
 */
function waitForIceGatheringComplete(pc, maxWaitMs = 900) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        finish();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(finish, maxWaitMs);
  });
}

/**
 * Rate-limited Outgoing Signal Queue
 * Throttles outbound HTTP POST signaling requests to prevent 429 Too Many Requests / CORS drops.
 */
class OutgoingSignalQueue {
  constructor(worker) {
    this.worker = worker;
    this.queue = [];
    this.isProcessing = false;
    this.minInterval = 350; // ms minimum spacing between HTTP requests
  }

  enqueue(msg) {
    // Deduplicate repeated ephemeral pings or duplicate announcements
    if (msg.type === 'ping' || msg.type === 'join' || msg.type === 'announce') {
      const idx = this.queue.findIndex(
        m => m.type === msg.type && (m.targetPeerId || '') === (msg.targetPeerId || '')
      );
      if (idx !== -1) {
        this.queue.splice(idx, 1);
      }
    }
    this.queue.push(msg);
    this.process();
  }

  clear() {
    this.queue = [];
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const msg = this.queue.shift();
      try {
        await this.worker(msg);
      } catch (err) {
        // Handled in worker
      }
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.minInterval));
      }
    }

    this.isProcessing = false;
  }
}

/**
 * Multi-Device WebRTC P2P Mesh & Signaling Synchronization Engine
 * 
 * Features:
 * - Single-message Bundled ICE Candidates (Zero candidate storms)
 * - Rate-limited HTTP Signal Queue to protect public relay limits
 * - Deterministic peer negotiation with handshake lock & timeout protection
 * - Automatic reconnection on network change or visibility change
 * - End-to-end encrypted payload over direct WebRTC DataChannel
 * - Comprehensive real-time diagnostic logging
 */
class WebRTCSyncEngine {
  constructor() {
    this.myPeerId = generateUUID().substring(0, 12);
    this.roomId = null;
    this.signalingUrl = CONFIG.DEFAULT_SIGNALING_URL;
    this.ws = null;
    this.isPublicRelay = true;
    
    // Peer Map: peerId -> { pc: RTCPeerConnection, dc: RTCDataChannel, state: string, negotiatingUntil: number }
    this.peers = new Map();
    
    // Status & Signaling listeners
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
    this.signalingState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.signalingError = null;
    this.statusListeners = new Set();
    this.messageListeners = new Set();
    
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isExplicitlyStopped = false;

    // Rate-limited signal queue for HTTP posts
    this.signalQueue = new OutgoingSignalQueue((msg) => this.executeSignalPost(msg));

    // Window listeners for auto reconnection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        syncLogger.info('SIGNAL', 'Device online detected, checking connectivity...');
        this.handleNetworkReturn();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          syncLogger.debug('SIGNAL', 'App resumed, checking connections...');
          this.handleNetworkReturn();
        }
      });
    }
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  onMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  getStatus() {
    const connectedPeers = Array.from(this.peers.entries())
      .filter(([_, p]) => p.dc && p.dc.readyState === 'open')
      .map(([id]) => id);

    return {
      status: connectedPeers.length > 0 ? 'connected' : (this.signalingState === 'connected' ? 'connected_to_signaling' : this.status),
      signalingState: this.signalingState,
      signalingError: this.signalingError,
      peerCount: connectedPeers.length,
      connectedPeers,
      myPeerId: this.myPeerId,
      roomId: this.roomId,
      signalingUrl: this.signalingUrl,
      isPublicRelay: this.isPublicRelay
    };
  }

  notifyStatus() {
    const info = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(info);
      } catch (e) {
        syncLogger.error('STORE', 'Status listener exception', e.message);
      }
    }
  }

  notifyMessage(msg, fromPeerId) {
    for (const listener of this.messageListeners) {
      try {
        listener(msg, fromPeerId);
      } catch (e) {
        syncLogger.error('SYNC', 'Message listener exception', e.message);
      }
    }
  }

  connect(roomId, customSignalingUrl = null) {
    if (!roomId) return;
    this.isExplicitlyStopped = false;
    this.roomId = roomId;
    if (customSignalingUrl) {
      this.signalingUrl = customSignalingUrl;
    }

    syncLogger.info('SIGNAL', `Initializing room sync for room: ${roomId.substring(0, 12)}...`, {
      myPeerId: this.myPeerId,
      signalingUrl: this.signalingUrl
    });

    this.setStatus('connecting');
    this.connectSignaling();
  }

  disconnect() {
    this.isExplicitlyStopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    this.signalQueue.clear();

    syncLogger.warn('SIGNAL', 'Disconnecting from sync room & closing peers...');

    // Send leave signal before teardown
    try {
      this.sendSignal({
        type: 'leave',
        roomId: this.roomId,
        senderPeerId: this.myPeerId,
        peerId: this.myPeerId
      });
    } catch (e) {}

    // Close all peer connections
    for (const [peerId, peer] of this.peers.entries()) {
      try {
        if (peer.dc) peer.dc.close();
        if (peer.pc) peer.pc.close();
      } catch (e) {}
    }
    this.peers.clear();

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.signalingState = 'disconnected';
    this.signalingError = null;
    this.setStatus('disconnected');
    syncLogger.info('SIGNAL', 'Sync engine stopped');
  }

  handleNetworkReturn() {
    if (this.isExplicitlyStopped || !this.roomId) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectSignaling();
    }
  }

  setStatus(status) {
    this.status = status;
    this.notifyStatus();
  }

  connectSignaling() {
    if (this.isExplicitlyStopped || !this.roomId) return;
    clearTimeout(this.reconnectTimer);

    const isPublic = !this.signalingUrl || 
                     this.signalingUrl === 'public' || 
                     this.signalingUrl.includes('ntfy.sh');
    this.isPublicRelay = isPublic;

    const topic = `simplelists_v1_${this.roomId}`;
    const wsUrl = isPublic 
      ? `wss://ntfy.sh/${topic}/ws` 
      : this.signalingUrl;

    try {
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
      }

      this.signalingState = 'connecting';
      this.signalingError = null;
      this.notifyStatus();

      syncLogger.info('SIGNAL', `Connecting to signaling relay WebSocket (${isPublic ? 'Public Relay' : wsUrl})...`);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.signalingState = 'connected';
        this.signalingError = null;
        this.setStatus('connecting');
        syncLogger.success('SIGNAL', `Signaling relay connected (${isPublic ? 'ntfy.sh topic ' + topic : wsUrl})`);

        if (isPublic) {
          // Announce presence to the public topic
          this.sendSignal({
            type: 'join',
            roomId: this.roomId,
            senderPeerId: this.myPeerId,
            peerId: this.myPeerId
          });

          // Periodic ping every 25s (rate-limit safe)
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              // Only send ping if we don't already have open peers
              const openCount = Array.from(this.peers.values()).filter(p => p.dc && p.dc.readyState === 'open').length;
              if (openCount === 0) {
                this.sendSignal({
                  type: 'ping',
                  roomId: this.roomId,
                  senderPeerId: this.myPeerId,
                  peerId: this.myPeerId
                });
              }
            }
          }, 25000);
        } else {
          // Dedicated WebSocket Server protocol
          this.ws.send(JSON.stringify({
            type: 'join',
            roomId: this.roomId,
            peerId: this.myPeerId
          }));

          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              try {
                this.ws.send(JSON.stringify({ type: 'ping' }));
              } catch (e) {}
            }
          }, 20000);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (isPublic) {
            // Ntfy envelope: { event: 'message', message: '{...json...}', topic: '...' }
            if (raw.event === 'message' && raw.message) {
              const msg = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;
              this.handleSignalingMessage(msg);
            }
          } else {
            this.handleSignalingMessage(raw);
          }
        } catch (err) {
          syncLogger.warn('SIGNAL', `Signaling parse warning: ${err.message}`);
        }
      };

      this.ws.onclose = (event) => {
        clearInterval(this.heartbeatTimer);
        this.signalingState = 'disconnected';
        if (!event.wasClean) {
          this.signalingError = isPublic 
            ? 'Public relay connection interrupted, reconnecting...' 
            : `Unable to reach signaling server at ${this.signalingUrl}`;
          syncLogger.warn('SIGNAL', `Signaling closed abnormally (code ${event.code}), reconnecting in background...`);
        } else {
          syncLogger.info('SIGNAL', 'Signaling connection closed cleanly');
        }
        this.scheduleReconnect();
      };

      this.ws.onerror = (e) => {
        clearInterval(this.heartbeatTimer);
        this.signalingState = 'error';
        this.signalingError = isPublic 
          ? 'Network issue reaching public relay. Retrying...' 
          : `Connection failed for ${this.signalingUrl}.`;
        syncLogger.error('SIGNAL', 'Signaling WebSocket error occurred');
        this.notifyStatus();
      };
    } catch (e) {
      syncLogger.error('SIGNAL', `WebSocket initiation error: ${e.message}`);
      this.signalingState = 'error';
      this.signalingError = `Error connecting to signaling: ${e.message || e}`;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.isExplicitlyStopped || !this.roomId) return;
    this.setStatus(this.peers.size > 0 ? 'connected' : 'connecting');

    this.reconnectAttempts++;
    const delay = Math.min(1500 * Math.pow(1.4, this.reconnectAttempts), 12000);
    syncLogger.debug('SIGNAL', `Scheduling reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay)}ms`);

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectSignaling();
    }, delay);
  }

  sendSignal(msg) {
    if (this.isPublicRelay) {
      this.signalQueue.enqueue(msg);
    } else {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        syncLogger.debug('SIGNAL', `Sending direct signal '${msg.type}'`, { target: msg.targetPeerId || 'all' });
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  async executeSignalPost(msg, attempt = 1) {
    const topic = `simplelists_v1_${this.roomId}`;
    syncLogger.debug('SIGNAL', `Posting signal '${msg.type}' to relay`, { target: msg.targetPeerId || 'all' });

    try {
      const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: { 'Title': 'simplelists-signal' }
      });

      if (!res.ok && res.status === 429) {
        syncLogger.warn('SIGNAL', 'Relay rate limit hit, backing off 1.5s...');
        await new Promise(r => setTimeout(r, 1500));
        if (attempt <= 2) {
          return this.executeSignalPost(msg, attempt + 1);
        }
      }
    } catch (err) {
      syncLogger.warn('SIGNAL', `Signal post issue: ${err.message}`);
      if (attempt <= 2 && msg.type !== 'ping') {
        await new Promise(r => setTimeout(r, 800 * attempt));
        return this.executeSignalPost(msg, attempt + 1);
      }
    }
  }

  handleSignalingMessage(msg) {
    if (!msg || !msg.type) return;

    // Ignore self-broadcasted messages
    const sender = msg.senderPeerId || msg.peerId;
    if (sender === this.myPeerId) return;

    switch (msg.type) {
      case 'join':
      case 'ping': {
        const otherPeerId = sender;
        if (otherPeerId) {
          const existing = this.peers.get(otherPeerId);
          // If already connected with an open DataChannel, nothing to do
          if (existing && existing.dc && existing.dc.readyState === 'open') {
            return;
          }

          // If currently in an active negotiation lock (within 15s), don't disrupt
          if (existing && existing.negotiatingUntil && Date.now() < existing.negotiatingUntil) {
            syncLogger.debug('SIGNAL', `Handshake already in progress with ${otherPeerId}, ignoring discovery ping`);
            return;
          }

          syncLogger.info('SIGNAL', `Peer discovery signal (${msg.type}) from: ${otherPeerId}`);

          // Reply with announcement so other peer knows we exist
          this.sendSignal({
            type: 'announce',
            roomId: this.roomId,
            senderPeerId: this.myPeerId,
            targetPeerId: otherPeerId
          });

          // If our ID is lexicographically higher, initiate WebRTC offer
          if (this.myPeerId > otherPeerId) {
            syncLogger.info('WEBRTC', `Initiating WebRTC offer to ${otherPeerId} (initiator rule: myId > peerId)`);
            this.handleDiscoveredPeer(otherPeerId);
          }
        }
        break;
      }

      case 'announce': {
        if (msg.targetPeerId === this.myPeerId && msg.senderPeerId) {
          const otherPeerId = msg.senderPeerId;
          const existing = this.peers.get(otherPeerId);
          if (existing && existing.dc && existing.dc.readyState === 'open') return;
          if (existing && existing.negotiatingUntil && Date.now() < existing.negotiatingUntil) return;

          syncLogger.info('SIGNAL', `Received announcement from peer: ${otherPeerId}`);
          if (this.myPeerId > otherPeerId) {
            syncLogger.info('WEBRTC', `Initiating WebRTC offer to announced peer ${otherPeerId}`);
            this.handleDiscoveredPeer(otherPeerId);
          }
        }
        break;
      }

      case 'peer-list': {
        this.signalingState = 'connected';
        this.signalingError = null;
        this.notifyStatus();
        const peers = msg.peers || [];
        for (const peerId of peers) {
          if (peerId !== this.myPeerId && this.myPeerId > peerId) {
            this.handleDiscoveredPeer(peerId);
          }
        }
        break;
      }

      case 'peer-joined': {
        if (msg.peerId && msg.peerId !== this.myPeerId) {
          if (this.myPeerId > msg.peerId) {
            this.handleDiscoveredPeer(msg.peerId);
          }
        }
        break;
      }

      case 'offer': {
        if ((msg.targetPeerId === this.myPeerId || !msg.targetPeerId) && msg.senderPeerId && msg.offer) {
          syncLogger.info('WEBRTC', `Received SDP offer from ${msg.senderPeerId}`);
          this.handleIncomingOffer(msg.senderPeerId, msg.offer);
        }
        break;
      }

      case 'answer': {
        if ((msg.targetPeerId === this.myPeerId || !msg.targetPeerId) && msg.senderPeerId && msg.answer) {
          syncLogger.success('WEBRTC', `Received SDP answer from ${msg.senderPeerId}`);
          this.handleIncomingAnswer(msg.senderPeerId, msg.answer);
        }
        break;
      }

      case 'ice-candidate': {
        // Fallback handler if candidate is received
        if ((msg.targetPeerId === this.myPeerId || !msg.targetPeerId) && msg.senderPeerId && msg.candidate) {
          this.handleIncomingCandidate(msg.senderPeerId, msg.candidate);
        }
        break;
      }

      case 'peer-left':
      case 'leave': {
        const leftPeerId = msg.peerId || msg.senderPeerId;
        if (leftPeerId) {
          syncLogger.warn('WEBRTC', `Peer left: ${leftPeerId}`);
          this.cleanupPeer(leftPeerId);
        }
        break;
      }

      case 'pong':
        break;
    }
  }

  /**
   * Deterministic WebRTC initiation:
   * 1. Create PeerConnection & DataChannel
   * 2. Create SDP offer & setLocalDescription
   * 3. Wait for ICE candidate gathering completion (bundling candidates into SDP)
   * 4. Send exactly ONE offer message to target peer
   */
  async handleDiscoveredPeer(otherPeerId) {
    const existing = this.peers.get(otherPeerId);
    if (existing) {
      if (existing.dc && existing.dc.readyState === 'open') return;
      if (existing.negotiatingUntil && Date.now() < existing.negotiatingUntil) return;
      this.cleanupPeer(otherPeerId);
    }

    syncLogger.info('WEBRTC', `Creating RTCPeerConnection & DataChannel for peer: ${otherPeerId}`);
    const pc = this.createPeerConnection(otherPeerId);
    const dc = pc.createDataChannel('sync', { ordered: true });
    this.setupDataChannel(otherPeerId, dc);

    const peerInfo = { 
      pc, 
      dc, 
      state: 'offering', 
      negotiatingUntil: Date.now() + 15000, 
      pendingCandidates: [] 
    };
    this.peers.set(otherPeerId, peerInfo);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to bundle all candidates into localDescription
      syncLogger.debug('WEBRTC', `Gathering ICE candidates for ${otherPeerId}...`);
      await waitForIceGatheringComplete(pc, 900);

      syncLogger.info('WEBRTC', `Sending bundled SDP offer to ${otherPeerId}`);
      this.sendSignal({
        type: 'offer',
        roomId: this.roomId,
        senderPeerId: this.myPeerId,
        targetPeerId: otherPeerId,
        offer: {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp
        }
      });
    } catch (err) {
      syncLogger.error('WEBRTC', `Error creating WebRTC offer for ${otherPeerId}: ${err.message}`);
      peerInfo.negotiatingUntil = 0;
    }
  }

  /**
   * Handle incoming SDP offer:
   * 1. Create PeerConnection
   * 2. setRemoteDescription(offer)
   * 3. Create SDP answer & setLocalDescription
   * 4. Wait for ICE candidate gathering completion
   * 5. Send exactly ONE answer message
   */
  async handleIncomingOffer(senderPeerId, offer) {
    let peer = this.peers.get(senderPeerId);
    if (peer && peer.dc && peer.dc.readyState === 'open') return;

    if (peer && peer.pc) {
      this.cleanupPeer(senderPeerId);
    }

    const pc = this.createPeerConnection(senderPeerId);
    peer = { 
      pc, 
      dc: null, 
      state: 'answering', 
      negotiatingUntil: Date.now() + 15000, 
      pendingCandidates: [] 
    };
    this.peers.set(senderPeerId, peer);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      syncLogger.debug('WEBRTC', `Remote SDP offer applied for ${senderPeerId}`);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for candidate gathering to bundle into SDP
      syncLogger.debug('WEBRTC', `Gathering ICE candidates for answer to ${senderPeerId}...`);
      await waitForIceGatheringComplete(pc, 900);

      syncLogger.info('WEBRTC', `Sending bundled SDP answer to ${senderPeerId}`);
      this.sendSignal({
        type: 'answer',
        roomId: this.roomId,
        senderPeerId: this.myPeerId,
        targetPeerId: senderPeerId,
        answer: {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp
        }
      });
    } catch (err) {
      syncLogger.error('WEBRTC', `Error handling WebRTC offer from ${senderPeerId}: ${err.message}`);
      peer.negotiatingUntil = 0;
    }
  }

  async handleIncomingAnswer(senderPeerId, answer) {
    const peer = this.peers.get(senderPeerId);
    if (!peer || !peer.pc) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      peer.state = 'connected';
      syncLogger.success('WEBRTC', `Remote answer applied for ${senderPeerId} -> WebRTC handshake complete! 🎉`);
    } catch (err) {
      syncLogger.error('WEBRTC', `Error applying WebRTC answer from ${senderPeerId}: ${err.message}`);
      peer.negotiatingUntil = 0;
    }
  }

  async handleIncomingCandidate(senderPeerId, candidate) {
    const peer = this.peers.get(senderPeerId);
    if (!peer || !peer.pc || !peer.pc.remoteDescription) return;

    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      syncLogger.debug('WEBRTC', `addIceCandidate notice: ${err.message}`);
    }
  }

  createPeerConnection(targetPeerId) {
    const pc = new RTCPeerConnection(CONFIG.RTC_CONFIGURATION);

    // Incoming DataChannel handler (for answerer side)
    pc.ondatachannel = (event) => {
      syncLogger.info('WEBRTC', `Incoming DataChannel established from peer: ${targetPeerId}`);
      const dc = event.channel;
      const peer = this.peers.get(targetPeerId);
      if (peer) {
        peer.dc = dc;
        peer.state = 'connected';
      }
      this.setupDataChannel(targetPeerId, dc);
    };

    pc.onconnectionstatechange = () => {
      syncLogger.info('WEBRTC', `Peer ${targetPeerId} connection state -> ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        const peer = this.peers.get(targetPeerId);
        if (peer) peer.state = 'connected';
        this.notifyStatus();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(targetPeerId);
      }
    };

    return pc;
  }

  setupDataChannel(peerId, dc) {
    dc.onopen = () => {
      syncLogger.success('SYNC', `DataChannel OPEN with peer: ${peerId} 🚀`);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.state = 'connected';
        peer.negotiatingUntil = 0;
      }
      this.notifyStatus();
      // On DataChannel open, trigger initial state synchronization request
      this.notifyMessage({ type: 'channel_opened' }, peerId);
    };

    dc.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.notifyMessage(payload, peerId);
      } catch (err) {
        syncLogger.warn('SYNC', `DataChannel message parse error: ${err.message}`);
      }
    };

    dc.onclose = () => {
      syncLogger.warn('SYNC', `DataChannel CLOSED with peer: ${peerId}`);
      this.cleanupPeer(peerId);
    };

    dc.onerror = (e) => {
      syncLogger.error('SYNC', `DataChannel error with peer: ${peerId}`);
      this.cleanupPeer(peerId);
    };
  }

  cleanupPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        if (peer.dc) peer.dc.close();
        if (peer.pc) peer.pc.close();
      } catch (e) {}
      this.peers.delete(peerId);
      this.notifyStatus();
    }
  }

  sendToPeer(peerId, data) {
    const peer = this.peers.get(peerId);
    if (peer && peer.dc && peer.dc.readyState === 'open') {
      try {
        peer.dc.send(JSON.stringify(data));
        return true;
      } catch (e) {
        syncLogger.error('SYNC', `Error sending to peer ${peerId}: ${e.message}`);
        return false;
      }
    }
    return false;
  }

  broadcast(data) {
    const serialized = JSON.stringify(data);
    let sentCount = 0;
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        try {
          peer.dc.send(serialized);
          sentCount++;
        } catch (e) {
          syncLogger.error('SYNC', `Error broadcasting to peer ${peerId}: ${e.message}`);
        }
      }
    }
    return sentCount;
  }

  /**
   * Triggers an immediate active sync cycle:
   * 1. Reconnects signaling if disconnected
   * 2. Broadcasts discovery 'join' / 'ping' on signaling relay
   * 3. Sends full sync_state + request_sync to all open peer DataChannels
   */
  triggerSyncNow() {
    syncLogger.info('SYNC', '▶ Manual "Sync Now" triggered');

    if (!this.roomId) {
      syncLogger.warn('SYNC', 'Cannot sync: No room configured. Please enter a shared phrase.');
      return { success: false, reason: 'no_room' };
    }

    // 1. If signaling is disconnected or errored, force reconnect
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      syncLogger.info('SIGNAL', 'Signaling offline, attempting immediate reconnection...');
      this.connectSignaling();
    } else {
      // 2. Announce presence to discover new peers
      this.sendSignal({
        type: 'join',
        roomId: this.roomId,
        senderPeerId: this.myPeerId,
        peerId: this.myPeerId
      });
    }

    // 3. Trigger peer message sync on all open data channels
    let activePeers = 0;
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        activePeers++;
        // Request state from peer & tell them to sync
        this.notifyMessage({ type: 'request_sync' }, peerId);
      }
    }

    syncLogger.success('SYNC', `Sync cycle dispatched (Active DataChannels: ${activePeers})`);
    return { success: true, activePeers };
  }
}

export const syncEngine = new WebRTCSyncEngine();
