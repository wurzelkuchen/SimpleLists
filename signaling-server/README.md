# Simple Lists Signaling Server

A lightweight, self-hostable, in-memory WebSocket signaling server designed for the Simple Lists WebRTC peer discovery and P2P connection establishment.

## Security & Architecture

- **Zero Data Storage**: Lists, items, phrases, and application sync data are **never** received, processed, or stored by this server.
- **In-Memory Only**: Room memberships exist solely in memory for currently connected WebSockets. Rooms are deleted immediately when empty.
- **Payload Limits**: Strict 64 KB message size enforcement and malformed JSON rejection.
- **Encrypted P2P Channels**: Once WebRTC connections are negotiated via SDP/ICE, all list synchronization occurs peer-to-peer over DTLS/SCTP WebRTC DataChannels.

## JSON Signaling Protocol

| Message Type | Direction | Payload Schema | Description |
|---|---|---|---|
| `join` | Client -> Server | `{"type":"join", "roomId":"string", "peerId":"string"}` | Joins a derived room |
| `peer-list` | Server -> Client | `{"type":"peer-list", "roomId":"string", "myPeerId":"string", "peers":["peer1", ...]}` | Returns current peers in room |
| `peer-joined` | Server -> Client | `{"type":"peer-joined", "peerId":"string"}` | Broadcast when a new peer enters |
| `offer` | Client -> Server -> Client | `{"type":"offer", "targetPeerId":"string", "offer":{}}` | Routes WebRTC SDP Offer |
| `answer` | Client -> Server -> Client | `{"type":"answer", "targetPeerId":"string", "answer":{}}` | Routes WebRTC SDP Answer |
| `ice-candidate`| Client -> Server -> Client | `{"type":"ice-candidate", "targetPeerId":"string", "candidate":{}}`| Routes ICE candidates |
| `peer-left` | Server -> Client | `{"type":"peer-left", "peerId":"string"}` | Broadcast when a peer disconnects |
| `leave` | Client -> Server | `{"type":"leave"}` | Explicit room exit |
| `ping`/`pong` | Bidirectional | `{"type":"ping"}` / `{"type":"pong"}` | Heartbeat keep-alive |

## Running Locally

```bash
cd signaling-server
npm install
npm start
```

## Running with Docker

```bash
docker build -t simple-lists-signaling .
docker run -p 8080:8080 simple-lists-signaling
```
