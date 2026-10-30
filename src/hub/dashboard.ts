import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server, ServerResponse } from 'node:http';

const PAGE = new URL('../../public/index.html', import.meta.url);

const sseMessage = (data: unknown): string => `data: ${JSON.stringify(data)}\n\n`;

// Serves the control-room page and streams the summary to every open page over Server-Sent Events
export async function startDashboard(port: number, refreshMs: number, snapshot: () => unknown): Promise<Server> {
  const page = await readFile(PAGE);
  const clients = new Set<ServerResponse>();

  const server = createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
    } else if (request.url === '/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      response.write(sseMessage(snapshot())); // the page shows the current state at once, zeros included
      clients.add(response);
      request.on('close', () => clients.delete(response));
    } else {
      response.writeHead(404).end();
    }
  });

  // One snapshot per refresh, shared by every open page
  const timer = setInterval(() => {
    if (clients.size === 0) return;
    const message = sseMessage(snapshot());
    for (const client of clients) client.write(message);
  }, refreshMs);
  server.on('close', () => clearInterval(timer));

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}
