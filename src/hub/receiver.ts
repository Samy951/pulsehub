import { createSocket } from 'node:dgram';
import type { Socket } from 'node:dgram';

// Binds the UDP port and hands every datagram to onDatagram: one failing datagram never stops the hub
export function startReceiver(port: number, onDatagram: (bytes: Buffer) => void): Promise<Socket> {
  const socket = createSocket('udp4');

  socket.on('message', (bytes) => {
    try {
      onDatagram(bytes);
    } catch (error) {
      console.error('Datagram dropped, its handler failed:', error);
    }
  });

  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, () => {
      socket.off('error', reject);
      socket.on('error', (error) => console.error(`UDP socket error: ${error.message}`));
      resolve(socket);
    });
  });
}
