import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import { setTimeout as sleep } from 'node:timers/promises';
import { startReceiver } from '../../src/hub/receiver.ts';

function send(port: number, bytes: Buffer): Promise<void> {
  const client = createSocket('udp4');
  return new Promise((resolve, reject) => {
    client.send(bytes, port, '127.0.0.1', (error) => {
      client.close();
      if (error) reject(error);
      else resolve();
    });
  });
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await sleep(10);
}

test('transmet chaque datagramme reçu au gestionnaire', async () => {
  const received: Buffer[] = [];
  const socket = await startReceiver(0, (bytes) => received.push(bytes));
  try {
    await send(socket.address().port, Buffer.from([1, 2, 3]));
    await waitFor(() => received.length === 1);
    assert.deepEqual(received, [Buffer.from([1, 2, 3])]);
  } finally {
    socket.close();
  }
});

test('continue de recevoir quand le traitement d\'un datagramme lève une exception', async (t) => {
  const logged = t.mock.method(console, 'error', () => undefined);
  const lengths: number[] = [];
  const socket = await startReceiver(0, (bytes) => {
    if (bytes[0] === 0xff) throw new Error('handler failure');
    lengths.push(bytes.length);
  });
  try {
    await send(socket.address().port, Buffer.from([0xff]));
    await send(socket.address().port, Buffer.from([1, 2]));
    await waitFor(() => lengths.length === 1);
    assert.deepEqual(lengths, [2]);
    assert.equal(logged.mock.callCount(), 1);
  } finally {
    socket.close();
  }
});

test('refuse de démarrer si le port UDP est déjà utilisé', async () => {
  const first = await startReceiver(0, () => undefined);
  try {
    await assert.rejects(startReceiver(first.address().port, () => undefined), /EADDRINUSE/);
  } finally {
    first.close();
  }
});
