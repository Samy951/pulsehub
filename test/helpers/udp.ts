import { createSocket } from 'node:dgram';
import { setTimeout as sleep } from 'node:timers/promises';

export function send(port: number, bytes: Buffer): Promise<void> {
  const client = createSocket('udp4');
  return new Promise((resolve, reject) => {
    client.send(bytes, port, '127.0.0.1', (error) => {
      client.close();
      if (error) reject(error);
      else resolve();
    });
  });
}

// UDP delivery is asynchronous: poll until the condition holds, for at most one second
export async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await sleep(10);
}
