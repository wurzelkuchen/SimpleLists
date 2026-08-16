/**
 * In-Memory Real-Time Diagnostic Logger
 * Tracks signaling, WebRTC negotiation, mesh state, and LWW sync events.
 */

class SyncLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 300;
    this.listeners = new Set();
    this.nextId = 1;
  }

  log(level, category, message, details = null) {
    const entry = {
      id: this.nextId++,
      time: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      }),
      level, // 'info' | 'success' | 'warn' | 'error' | 'debug'
      category, // 'SIGNAL' | 'WEBRTC' | 'SYNC' | 'STORE' | 'CRYPTO'
      message,
      details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details)) : details) : null
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.notify(entry);

    // Also mirror to browser console for developer inspection
    const prefix = `[${entry.time}][${category}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details || '');
    } else if (level === 'success') {
      console.log(`%c${prefix} ${message}`, 'color: #10b981; font-weight: bold;', details || '');
    } else {
      console.log(prefix, message, details || '');
    }
  }

  info(category, message, details = null) {
    this.log('info', category, message, details);
  }

  success(category, message, details = null) {
    this.log('success', category, message, details);
  }

  warn(category, message, details = null) {
    this.log('warn', category, message, details);
  }

  error(category, message, details = null) {
    this.log('error', category, message, details);
  }

  debug(category, message, details = null) {
    this.log('debug', category, message, details);
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.notify({ type: 'clear' });
  }

  onLog(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event, this.logs);
      } catch (err) {
        console.error('Logger listener error:', err);
      }
    }
  }
}

export const syncLogger = new SyncLogger();
