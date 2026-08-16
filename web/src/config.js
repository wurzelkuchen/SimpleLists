/**
 * Centralized Application Configuration
 * 
 * - Signaling Server: WebSocket endpoint for WebRTC peer discovery
 * - Cryptographic Derivation: PBKDF2 parameters for deterministic room credential generation
 * - STUN Servers: Standard public Google STUN servers for NAT traversal
 */

export const CONFIG = {
  APP_NAME: 'Simple Lists',
  APP_VERSION: '1.0.0',
  APP_PROTOCOL_VERSION: 1,

  // Default signaling server endpoint (Public zero-setup relay or custom WebSocket)
  // Can also be customized in Settings if running on a private LAN or self-hosted host
  DEFAULT_SIGNALING_URL: 'public',

  // PBKDF2 derivation parameters
  PBKDF2_SALT: 'simple-lists:v1:app-domain-salt:2025-08-16',
  PBKDF2_ITERATIONS: 100000,
  PBKDF2_KEY_LENGTH_BITS: 256,

  // Public STUN servers for WebRTC ICE negotiation
  RTC_CONFIGURATION: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  }
};
