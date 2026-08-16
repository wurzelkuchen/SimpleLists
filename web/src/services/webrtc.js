import { CONFIG } from '../config.js';
import { generateUUID } from './crypto.js';

/**
 * Multi-device WebRTC P2P Mesh & Signaling Synchronization Engine
 * 
 * Features:
 * - Deterministic peer initiation rule (lexicographical peerId comparison)
 * - Automatic discovery and pairwise WebRTC DataChannel establishment
 * - Zero user data passed through signaling server
 * - Resilient automatic reconnection on network change or visibility change
 */

class WebRTCSyncEngine {
  constructor() {
    this.myPeerId = generateUUID().substring(0, 12);
    this.roomId = null;
    this.signalingUrl = CONFIG.DEFAULT_SIGNALING_URL;
    this.ws = null;
    
    // Peer Map: peerId -> { pc: RTCPeerConnection, dc: RTCDataChannel, state: string }
    this.peers = new Map();
    
    // Status listeners
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
    this.statusListeners = new Set();
    this.messageListeners = new Set();
    
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isExplicitlyStopped = false;

    // Window listeners for auto reconnection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkReturn());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
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
      status: this.status,
      peerCount: connectedPeers.length,
      connectedPeers,
      myPeerId: this.myPeerId,
      roomId: this.roomId,
      signalingUrl: this.signalingUrl
    };
  }

  notifyStatus() {
    const info = this.getStatus();
    for (const listener of this.statusListeners) {
      try {
        listener(info);
      } catch (e) {
        console.error('Status listener error:', e);
      }
    }
  }

  notifyMessage(msg, fromPeerId) {
    for (const listener of this.messageListeners) {
      try {
        listener(msg, fromPeerId);
      } catch (e) {
        console.error('Message listener error:', e);
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

    this.setStatus('connecting');
    this.connectSignaling();
  }

  disconnect() {
    this.isExplicitlyStopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);

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
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'leave' }));
        }
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.setStatus('disconnected');
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

    try {
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
      }

      this.ws = new WebSocket(this.signalingUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connecting');

        // Join room with derived roomId
        this.ws.send(JSON.stringify({
          type: 'join',
          roomId: this.roomId,
          peerId: this.myPeerId
        }));

        // Start ping interval
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch (e) {}
          }
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleSignalingMessage(msg);
        } catch (err) {
          console.warn('Signaling parse error:', err);
        }
      };

      this.ws.onclose = () => {
        clearInterval(this.heartbeatTimer);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        clearInterval(this.heartbeatTimer);
        // On error, onclose will typically fire as well
      };
    } catch (e) {
      console.warn('WebSocket connect error:', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.isExplicitlyStopped || !this.roomId) return;
    this.setStatus(this.peers.size > 0 ? 'connected' : 'connecting');

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectSignaling();
    }, delay);
  }

  handleSignalingMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'peer-list': {
        this.setStatus('connected');
        const peers = msg.peers || [];
        for (const peerId of peers) {
          if (peerId !== this.myPeerId) {
            this.handleDiscoveredPeer(peerId);
          }
        }
        break;
      }

      case 'peer-joined': {
        if (msg.peerId && msg.peerId !== this.myPeerId) {
          this.handleDiscoveredPeer(msg.peerId);
        }
        break;
      }

      case 'offer': {
        if (msg.senderPeerId && msg.offer) {
          this.handleIncomingOffer(msg.senderPeerId, msg.offer);
        }
        break;
      }

      case 'answer': {
        if (msg.senderPeerId && msg.answer) {
          this.handleIncomingAnswer(msg.senderPeerId, msg.answer);
        }
        break;
      }

      case 'ice-candidate': {
        if (msg.senderPeerId && msg.candidate) {
          this.handleIncomingCandidate(msg.senderPeerId, msg.candidate);
        }
        break;
      }

      case 'peer-left': {
        if (msg.peerId) {
          this.cleanupPeer(msg.peerId);
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
      return; // Already connecting or connected
    }

    const shouldInitiate = this.myPeerId > otherPeerId;
    const pc = this.createPeerConnection(otherPeerId);

    if (shouldInitiate) {
      const dc = pc.createDataChannel('sync', { ordered: true });
      this.setupDataChannel(otherPeerId, dc);
      this.peers.set(otherPeerId, { pc, dc, state: 'offering' });

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'offer',
              targetPeerId: otherPeerId,
              offer: pc.localDescription
            }));
          }
        })
        .catch(err => console.error('Error creating WebRTC offer:', err));
    } else {
      this.peers.set(otherPeerId, { pc, dc: null, state: 'waiting-offer' });
    }
  }

  async handleIncomingOffer(senderPeerId, offer) {
    let peer = this.peers.get(senderPeerId);
    let pc = peer ? peer.pc : null;

    if (!pc) {
      pc = this.createPeerConnection(senderPeerId);
      this.peers.set(senderPeerId, { pc, dc: null, state: 'answering' });
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'answer',
          targetPeerId: senderPeerId,
          answer: pc.localDescription
        }));
      }
    } catch (err) {
      console.error('Error handling WebRTC offer:', err);
    }
  }

  async handleIncomingAnswer(senderPeerId, answer) {
    const peer = this.peers.get(senderPeerId);
    if (!peer || !peer.pc) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Error handling WebRTC answer:', err);
    }
  }

  async handleIncomingCandidate(senderPeerId, candidate) {
    const peer = this.peers.get(senderPeerId);
    if (!peer || !peer.pc) return;

    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Ignore ICE candidates that arrive before remote description
    }
  }

  createPeerConnection(targetPeerId) {
    const pc = new RTCPeerConnection(CONFIG.RTC_CONFIGURATION);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          targetPeerId,
          candidate: event.candidate
        }));
      }
    };

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      const peer = this.peers.get(targetPeerId);
      if (peer) {
        peer.dc = dc;
      }
      this.setupDataChannel(targetPeerId, dc);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(targetPeerId);
      }
    };

    return pc;
  }

  setupDataChannel(peerId, dc) {
    dc.onopen = () => {
      this.notifyStatus();
      // On DataChannel open, trigger initial state synchronization request
      this.notifyMessage({ type: 'channel_opened' }, peerId);
    };

    dc.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.notifyMessage(payload, peerId);
      } catch (err) {
        console.warn('DataChannel message parse error:', err);
      }
    };

    dc.onclose = () => {
      this.cleanupPeer(peerId);
    };

    dc.onerror = () => {
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
        } catch (e) {}
      }
    }
    return sentCount;
  }
}

export const syncEngine = new WebRTCSyncEngine();
