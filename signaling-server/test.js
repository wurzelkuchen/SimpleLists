const { server } = require('./index');
const WebSocket = require('ws');
const assert = require('assert');

const PORT = 8089;

server.listen(PORT, async () => {
  console.log(`Test signaling server running on port ${PORT}`);

  try {
    const ws1 = new WebSocket(`ws://localhost:${PORT}`);
    const ws2 = new WebSocket(`ws://localhost:${PORT}`);

    await Promise.all([
      new Promise(r => ws1.on('open', r)),
      new Promise(r => ws2.on('open', r))
    ]);

    const messages1 = [];
    const messages2 = [];
    ws1.on('message', m => messages1.push(JSON.parse(m.toString())));
    ws2.on('message', m => messages2.push(JSON.parse(m.toString())));

    // Peer 1 joins room test-room
    ws1.send(JSON.stringify({ type: 'join', roomId: 'test-room', peerId: 'peer-1' }));
    await new Promise(r => setTimeout(r, 100));

    assert(messages1.some(m => m.type === 'peer-list' && m.peers.length === 0), 'Peer 1 should receive empty peer-list');

    // Peer 2 joins room test-room
    ws2.send(JSON.stringify({ type: 'join', roomId: 'test-room', peerId: 'peer-2' }));
    await new Promise(r => setTimeout(r, 100));

    assert(messages2.some(m => m.type === 'peer-list' && m.peers.includes('peer-1')), 'Peer 2 should see peer-1 in list');
    assert(messages1.some(m => m.type === 'peer-joined' && m.peerId === 'peer-2'), 'Peer 1 should receive peer-joined for peer-2');

    // Send offer from peer 1 to peer 2
    ws1.send(JSON.stringify({ type: 'offer', targetPeerId: 'peer-2', offer: { type: 'offer', sdp: 'dummy-offer' } }));
    await new Promise(r => setTimeout(r, 100));

    assert(messages2.some(m => m.type === 'offer' && m.senderPeerId === 'peer-1' && m.offer.sdp === 'dummy-offer'), 'Peer 2 should receive offer from peer 1');

    // Send answer from peer 2 to peer 1
    ws2.send(JSON.stringify({ type: 'answer', targetPeerId: 'peer-1', answer: { type: 'answer', sdp: 'dummy-answer' } }));
    await new Promise(r => setTimeout(r, 100));

    assert(messages1.some(m => m.type === 'answer' && m.senderPeerId === 'peer-2' && m.answer.sdp === 'dummy-answer'), 'Peer 1 should receive answer from peer 2');

    // Disconnect peer 2 and ensure peer 1 receives peer-left
    ws2.close();
    await new Promise(r => setTimeout(r, 150));

    assert(messages1.some(m => m.type === 'peer-left' && m.peerId === 'peer-2'), 'Peer 1 should receive peer-left when peer 2 disconnects');

    ws1.close();
    server.close();
    console.log('All signaling server tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Signaling server test failed:', err);
    server.close();
    process.exit(1);
  }
});
