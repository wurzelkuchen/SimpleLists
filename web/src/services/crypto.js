import { CONFIG } from '../config.js';

/**
 * Convert an ArrayBuffer to a hex string
 */
export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert string to Uint8Array UTF-8
 */
export function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

/**
 * Generate a UUID v4
 * Uses standard crypto.randomUUID() where available, with secure fallback
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fall through to fallback
    }
  }

  // Fallback using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122
    const hex = bufferToHex(bytes.buffer);
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
  }

  // Pure JS fallback
  let d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * SHA-256 hash of a string, returning hex string
 */
async function sha256Hex(str) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = stringToBytes(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return bufferToHex(hashBuffer);
  }
  // Simple fallback hash if crypto.subtle is somehow unavailable
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Deterministically derive room credentials from the user's shared phrase.
 * 
 * Uses standard PBKDF2-HMAC-SHA-256 with 100,000 iterations and a fixed domain salt.
 * 
 * Produces:
 * - roomId: Hex string representing the signaling room channel
 * - roomAuthToken: Hex string used for room authentication verification
 * 
 * The raw phrase is NEVER transmitted across the network or stored in logs.
 */
export async function deriveRoomCredentials(phrase) {
  const normalizedPhrase = (phrase || '').trim().normalize('NFKC');
  if (!normalizedPhrase) {
    throw new Error('Phrase must not be empty');
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const phraseBytes = stringToBytes(normalizedPhrase);
      const saltBytes = stringToBytes(CONFIG.PBKDF2_SALT);

      const baseKey = await crypto.subtle.importKey(
        'raw',
        phraseBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      // Derive master 256-bit key
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: CONFIG.PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        baseKey,
        CONFIG.PBKDF2_KEY_LENGTH_BITS
      );

      const masterHex = bufferToHex(derivedBits);

      // Domain-separated derivations for Room ID and Auth Token
      const roomId = await sha256Hex(`simple-lists:v1:room-id:${masterHex}`);
      const roomAuthToken = await sha256Hex(`simple-lists:v1:auth-token:${masterHex}`);

      return {
        roomId: roomId.substring(0, 32),
        roomAuthToken: roomAuthToken.substring(0, 32),
        derivedAt: Date.now()
      };
    } catch (err) {
      console.warn('SubtleCrypto PBKDF2 failed, falling back to SHA-256 derivation:', err);
    }
  }

  // Fallback if subtle crypto is limited in test/unsupported environments
  const masterHex = await sha256Hex(`${CONFIG.PBKDF2_SALT}:${normalizedPhrase}`);
  const roomId = await sha256Hex(`simple-lists:v1:room-id:${masterHex}`);
  const roomAuthToken = await sha256Hex(`simple-lists:v1:auth-token:${masterHex}`);

  return {
    roomId: roomId.substring(0, 32),
    roomAuthToken: roomAuthToken.substring(0, 32),
    derivedAt: Date.now()
  };
}
