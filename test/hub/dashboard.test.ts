import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard } from '../../src/hub/dashboard.ts';

async function withDashboard(snapshot: () => unknown, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = await startDashboard(0, 60_000, snapshot);
  try {
    const address = server.address();
    assert.ok(address !== null && typeof address === 'object');
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

test('sert la page de la régie sur /', async () => {
  await withDashboard(() => ({}), async (baseUrl) => {
    const response = await fetch(baseUrl);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await response.text(), /PulseHub/);
  });
});

test('envoie la synthèse en SSE dès la connexion, sans attendre le premier rafraîchissement', async () => {
  await withDashboard(() => ({ reception: { received: 0 } }), async (baseUrl) => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/events`, { signal: controller.signal });
    const reader = response.body?.getReader();
    const first = await reader?.read();
    controller.abort();

    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    assert.equal(new TextDecoder().decode(first?.value), 'data: {"reception":{"received":0}}\n\n');
  });
});

test('répond 404 sur une adresse inconnue', async () => {
  await withDashboard(() => ({}), async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/admin`)).status, 404);
  });
});
