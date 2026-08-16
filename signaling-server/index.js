/**
 * Simple Lists WebSocket Signaling Server
 * 
 * Responsibilities:
 * - Temporary in-memory room management for WebRTC peer discovery
 * - Routing SDP offers, SDP answers, and ICE candidates between peers in the same room
 * - Zero storage of lists, items, or application data
 * - Automatic cleanup of rooms upon peer disconnection
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = parseInt(process.env.PORT || '8080', 10);
const MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB limit
const HEARTBEAT_INTERVAL = 30000; // 30s

// In-memory room store: Map<roomId, Map<peerId, { ws, joinedAt }>>
const rooms = new Map();

// Map<ws, { roomId, peerId, isAlive }>
const clients = new Map();

// HTTP server for health checking and WebSocket upgrade
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    let totalPeers = 0;
    for (const room of rooms.values()) {
      totalPeers += room.size;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      activeRooms: rooms.size,
      connectedPeers: totalPeers,
      timestamp: Date.now()
    }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_MESSAGE_SIZE
});

function broadcastToRoom(roomId, message, senderWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const client of room.values()) {
    if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch (err) {
        // Socket error handled during cleanup
      }
    }
  }
}

function sendToPeer(roomId, targetPeerId, message) {
  const room = rooms.get(roomId);
  if (!room) return false;
  const targetClient = room.get(targetPeerId);
  if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
    try {
      targetClient.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      return false;
    }
  }
  return false;
}

function removeClient(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;

  const { roomId, peerId } = clientInfo;
  clients.delete(ws);

  if (roomId && peerId) {
    const room = rooms.get(roomId);
    if (room) {
      room.delete(peerId);
      // Notify remaining peers in the room
      broadcastToRoom(roomId, {
        type: 'peer-left',
        peerId
      });

      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }
  }
}

wss.on('connection', (ws) => {
  const clientInfo = {
    roomId: null,
    peerId: null,
    isAlive: true
  };
  clients.set(ws, clientInfo);

  ws.on('pong', () => {
    clientInfo.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
      return;
    }

    if (!msg || typeof msg.type !== 'string') {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing message type' }));
      return;
    }

    switch (msg.type) {
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      }

      case 'join': {
        const { roomId, peerId } = msg;
        if (!roomId || !peerId || typeof roomId !== 'string' || typeof peerId !== 'string') {
          ws.send(JSON.stringify({ type: 'error', message: 'roomId and peerId are required strings' }));
          return;
        }

        // Leave previous room if already joined
        if (clientInfo.roomId && clientInfo.roomId !== roomId) {
          removeClient(ws);
        }

        clientInfo.roomId = roomId;
        clientInfo.peerId = peerId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }
        const room = rooms.get(roomId);

        // Collect existing peers
        const existingPeers = Array.from(room.keys()).filter(id => id !== peerId);

        // Register new peer
        room.set(peerId, { ws, joinedAt: Date.now() });

        // Send existing peer list to newcomer
        ws.send(JSON.stringify({
          type: 'peer-list',
          roomId,
          myPeerId: peerId,
          peers: existingPeers
        }));

        // Notify other peers in room about newcomer
        broadcastToRoom(roomId, {
          type: 'peer-joined',
          peerId
        }, ws);
        break;
      }

      case 'offer': {
        const { targetPeerId, offer } = msg;
        if (!clientInfo.roomId || !clientInfo.peerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not joined to any room' }));
          return;
        }
        if (!targetPeerId || !offer) {
          ws.send(JSON.stringify({ type: 'error', message: 'targetPeerId and offer required' }));
          return;
        }
        sendToPeer(clientInfo.roomId, targetPeerId, {
          type: 'offer',
          senderPeerId: clientInfo.peerId,
          offer
        });
        break;
      }

      case 'answer': {
        const { targetPeerId, answer } = msg;
        if (!clientInfo.roomId || !clientInfo.peerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not joined to any room' }));
          return;
        }
        if (!targetPeerId || !answer) {
          ws.send(JSON.stringify({ type: 'error', message: 'targetPeerId and answer required' }));
          return;
        }
        sendToPeer(clientInfo.roomId, targetPeerId, {
          type: 'answer',
          senderPeerId: clientInfo.peerId,
          answer
        });
        break;
      }

      case 'ice-candidate': {
        const { targetPeerId, candidate } = msg;
        if (!clientInfo.roomId || !clientInfo.peerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not joined to any room' }));
          return;
        }
        if (!targetPeerId || !candidate) {
          ws.send(JSON.stringify({ type: 'error', message: 'targetPeerId and candidate required' }));
          return;
        }
        sendToPeer(clientInfo.roomId, targetPeerId, {
          type: 'ice-candidate',
          senderPeerId: clientInfo.peerId,
          candidate
        });
        break;
      }

      case 'leave': {
        removeClient(ws);
        clientInfo.roomId = null;
        clientInfo.peerId = null;
        ws.send(JSON.stringify({ type: 'left' }));
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
    }
  });

  ws.on('close', () => {
    removeClient(ws);
  });

  ws.on('error', () => {
    removeClient(ws);
  });
});

// Periodic heartbeat to terminate dead sockets
const heartbeatInterval = setInterval(() => {
  for (const [ws, info] of clients.entries()) {
    if (!info.isAlive) {
      removeClient(ws);
      ws.terminate();
    } else {
      info.isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        removeClient(ws);
      }
    }
  }
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Simple Lists Signaling Server running on port ${PORT}`);
  });
}

module.exports = { server, wss, rooms, clients };
