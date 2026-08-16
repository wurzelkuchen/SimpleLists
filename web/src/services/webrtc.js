import { CONFIG } from '../config.js';
import { generateUUID } from './crypto.js';
import { syncLogger } from './logger.js';

/**
 * Multi-device WebRTC P2P Mesh & Signaling Synchronization Engine
 * 
 * Features:
 * - Built-in Public Cloud Relay (ntfy.sh WebSocket/HTTP) for zero-setup, cross-network syncing
 * - Optional custom WebSocket signaling server support (ws:// or wss://)
 * - Deterministic peer initiation rule (lexicographical peerId comparison)
 * - Automatic discovery and pairwise WebRTC DataChannel establishment
 * - Zero user data passed through signaling (only ephemeral SDP offers/answers & ICE candidates)
 * - End-to-end encrypted payload over WebRTC DataChannel
 * - Resilient automatic reconnection on network change or visibility change
 * - Comprehensive real-time diagnostic logging
 */

class WebRTCSyncEngine {
  constructor() {
    this.myPeerId = generateUUID().substring(0, 12);
    this.roomId = null;
    this.signalingUrl = CONFIG.DEFAULT_SIGNALING_URL;
    this.ws = null;
    this.isPublicRelay = true;
    
    // Peer Map: peerId -> { pc: RTCPeerConnection, dc: RTCDataChannel, state: string, pendingCandidates: Array }
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

    // Window listeners for auto reconnection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        syncLogger.info('SIGNAL', 'Device came online, checking connection...');
        this.handleNetworkReturn();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          syncLogger.debug('SIGNAL', 'App visible, checking connection...');
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
        syncLogger.success('SIGNAL', `Signaling WebSocket connected (${isPublic ? 'ntfy.sh topic ' + topic : wsUrl})`);

        if (isPublic) {
          // Announce presence to the public topic
          this.sendSignal({
            type: 'join',
            roomId: this.roomId,
            senderPeerId: this.myPeerId,
            peerId: this.myPeerId
          });

          // Periodic ping/presence announcement
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.sendSignal({
                type: 'ping',
                roomId: this.roomId,
                senderPeerId: this.myPeerId,
                peerId: this.myPeerId
              });
            }
          }, 8000);
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
          syncLogger.warn('SIGNAL', `Signaling closed abnormally (code ${event.code}), scheduling reconnect...`);
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
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    syncLogger.debug('SIGNAL', `Scheduling reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay)}ms`);

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectSignaling();
    }, delay);
  }

  sendSignal(msg) {
    if (this.isPublicRelay) {
      const topic = `simplelists_v1_${this.roomId}`;
      syncLogger.debug('SIGNAL', `Sending signal '${msg.type}' via relay`, { target: msg.targetPeerId || 'all' });

      fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: { 'Title': 'simplelists-signal' }
      }).catch(err => {
        syncLogger.warn('SIGNAL', `Public signal post failed: ${err.message}`);
      });
    } else {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        syncLogger.debug('SIGNAL', `Sending signal '${msg.type}' via direct WS`, { target: msg.targetPeerId || 'all' });
        this.ws.send(JSON.stringify(msg));
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
          syncLogger.info('SIGNAL', `Peer discovery signal (${msg.type}) from: ${otherPeerId}`);
          // If we are already connected to this peer, don't re-initiate
          const existing = this.peers.get(otherPeerId);
          if (!existing || !existing.dc || existing.dc.readyState !== 'open') {
            // Reply with announcement so other peer knows we exist
            this.sendSignal({
              type: 'announce',
              roomId: this.roomId,
              senderPeerId: this.myPeerId,
              targetPeerId: otherPeerId
            });
            // If our ID is lexicographically higher, initiate WebRTC offer
            if (this.myPeerId > otherPeerId) {
              syncLogger.info('WEBRTC', `Initiating WebRTC handshake with ${otherPeerId} (initiator rule: myId > peerId)`);
              this.handleDiscoveredPeer(otherPeerId);
            }
          }
        }
        break;
      }

      case 'announce': {
        if (msg.targetPeerId === this.myPeerId && msg.senderPeerId) {
          const otherPeerId = msg.senderPeerId;
          syncLogger.info('SIGNAL', `Received announcement from peer: ${otherPeerId}`);
          const existing = this.peers.get(otherPeerId);
          if (!existing || !existing.dc || existing.dc.readyState !== 'open') {
            if (this.myPeerId > otherPeerId) {
              syncLogger.info('WEBRTC', `Initiating WebRTC offer to announced peer ${otherPeerId}`);
              this.handleDiscoveredPeer(otherPeerId);
            }
          }
        }
        break;
      }

      case 'peer-list': {
        this.signalingState = 'connected';
        this.signalingError = null;
        this.notifyStatus();
        const peers = msg.peers || [];
        syncLogger.info('SIGNAL', `Received active peer list (${peers.length} peers)`, peers);
        for (const peerId of peers) {
          if (peerId !== this.myPeerId && this.myPeerId > peerId) {
            this.handleDiscoveredPeer(peerId);
          }
        }
        break;
      }

      case 'peer-joined': {
        if (msg.peerId && msg.peerId !== this.myPeerId) {
          syncLogger.info('SIGNAL', `Peer joined: ${msg.peerId}`);
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
        if ((msg.targetPeerId === this.myPeerId || !msg.targetPeerId) && msg.senderPeerId && msg.candidate) {
          syncLogger.debug('WEBRTC', `Received ICE candidate from ${msg.senderPeerId}`);
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
        // Heartbeat ack
        break;
    }
  }

  /**
   * Deterministic WebRTC initiation:
   * Peer with lexicographically higher ID creates offer.
   * Peer with lower ID waits for offer.
   */
  handleDiscoveredPeer(otherPeerId) {
    if (this.peers.has(otherPeerId)) {
      const p = this.peers.get(otherPeerId);
      if (p.dc && p.dc.readyState === 'open') return;
      if (p.state === 'offering' && p.pc && p.pc.signalingState !== 'closed') return;
    }

    syncLogger.info('WEBRTC', `Creating RTCPeerConnection & DataChannel for peer: ${otherPeerId}`);
    const pc = this.createPeerConnection(otherPeerId);
    const dc = pc.createDataChannel('sync', { ordered: true });
    this.setupDataChannel(otherPeerId, dc);
    this.peers.set(otherPeerId, { pc, dc, state: 'offering', pendingCandidates: [] });

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        syncLogger.info('WEBRTC', `Sending SDP offer to ${otherPeerId}`);
        this.sendSignal({
          type: 'offer',
          roomId: this.roomId,
          senderPeerId: this.myPeerId,
          targetPeerId: otherPeerId,
          offer: pc.localDescription
        });
      })
      .catch(err => {
        syncLogger.error('WEBRTC', `Error creating WebRTC offer for ${otherPeerId}: ${err.message}`);
      });
  }

  async handleIncomingOffer(senderPeerId, offer) {
    let peer = this.peers.get(senderPeerId);
    let pc = peer ? peer.pc : null;

    if (!pc || pc.signalingState === 'closed') {
      pc = this.createPeerConnection(senderPeerId);
      this.peers.set(senderPeerId, { pc, dc: null, state: 'answering', pendingCandidates: [] });
      peer = this.peers.get(senderPeerId);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      syncLogger.debug('WEBRTC', `Remote SDP description set for ${senderPeerId}`);

      // Drain and apply any queued ICE candidates that arrived before the offer
      if (peer && peer.pendingCandidates && peer.pendingCandidates.length > 0) {
        syncLogger.debug('WEBRTC', `Flushing ${peer.pendingCandidates.length} queued ICE candidates for ${senderPeerId}`);
        for (const cand of peer.pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            syncLogger.warn('WEBRTC', `Queued ICE candidate warning: ${e.message}`);
          }
        }
        peer.pendingCandidates = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      syncLogger.info('WEBRTC', `Sending SDP answer to ${senderPeerId}`);
      this.sendSignal({
        type: 'answer',
        roomId: this.roomId,
        senderPeerId: this.myPeerId,
        targetPeerId: senderPeerId,
        answer: pc.localDescription
      });
    } catch (err) {
      syncLogger.error('WEBRTC', `Error handling WebRTC offer from ${senderPeerId}: ${err.message}`);
    }
  }

  async handleIncomingAnswer(senderPeerId, answer) {
    const peer = this.peers.get(senderPeerId);
    if (!peer || !peer.pc) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      syncLogger.success('WEBRTC', `Remote answer applied for ${senderPeerId}`);

      // Drain and apply any queued ICE candidates that arrived before the answer
      if (peer.pendingCandidates && peer.pendingCandidates.length > 0) {
        syncLogger.debug('WEBRTC', `Flushing ${peer.pendingCandidates.length} queued ICE candidates for ${senderPeerId}`);
        for (const cand of peer.pendingCandidates) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            syncLogger.warn('WEBRTC', `Queued ICE candidate warning: ${e.message}`);
          }
        }
        peer.pendingCandidates = [];
      }
    } catch (err) {
      syncLogger.error('WEBRTC', `Error handling WebRTC answer from ${senderPeerId}: ${err.message}`);
    }
  }

  async handleIncomingCandidate(senderPeerId, candidate) {
    let peer = this.peers.get(senderPeerId);
    if (!peer) {
      const pc = this.createPeerConnection(senderPeerId);
      this.peers.set(senderPeerId, { pc, dc: null, state: 'waiting-offer', pendingCandidates: [] });
      peer = this.peers.get(senderPeerId);
    }

    if (!peer.pc || !peer.pc.remoteDescription) {
      if (!peer.pendingCandidates) peer.pendingCandidates = [];
      peer.pendingCandidates.push(candidate);
      return;
    }

    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      syncLogger.debug('WEBRTC', `addIceCandidate error: ${err.message}`);
    }
  }

  createPeerConnection(targetPeerId) {
    const pc = new RTCPeerConnection(CONFIG.RTC_CONFIGURATION);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          roomId: this.roomId,
          senderPeerId: this.myPeerId,
          targetPeerId,
          candidate: event.candidate
        });
      }
    };

    pc.ondatachannel = (event) => {
      syncLogger.info('WEBRTC', `Incoming DataChannel from peer: ${targetPeerId}`);
      const dc = event.channel;
      const peer = this.peers.get(targetPeerId);
      if (peer) {
        peer.dc = dc;
      }
      this.setupDataChannel(targetPeerId, dc);
    };

    pc.onconnectionstatechange = () => {
      syncLogger.info('WEBRTC', `Peer ${targetPeerId} connection state -> ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(targetPeerId);
      }
    };

    return pc;
  }

  setupDataChannel(peerId, dc) {
    dc.onopen = () => {
      syncLogger.success('SYNC', `DataChannel OPEN with peer: ${peerId} 🚀`);
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
      this.sendSignal({
        type: 'ping',
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
