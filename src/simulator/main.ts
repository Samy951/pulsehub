import { createSocket } from 'node:dgram';
import { parseSimulatorConfig } from './config.ts';
import { VirtualDevice } from './device.ts';
import { FaultInjector, isStopped } from './faults.ts';

function main(): void {
  const config = parseSimulatorConfig(process.argv.slice(2));
  const socket = createSocket('udp4');
  socket.on('error', (error) => console.error(`UDP error: ${error.message}`));

  const startedAt = Date.now();
  const devices = Array.from({ length: config.devices }, (_, i) => new VirtualDevice(config.firstId + i, startedAt, Math.random));
  const faults = new FaultInjector(config.faults, config.overheat, Math.random);
  let sentSinceReport = 0;
  let roundsSent = 0;

  // One round: every running device emits its next frame
  const sendRound = (now: number): void => {
    for (const device of devices) {
      if (isStopped(device.deviceId, now - startedAt, config.stop)) continue;
      for (const datagram of faults.apply(device.nextFrame(now))) {
        socket.send(datagram, config.port, config.host);
        sentSinceReport++;
      }
    }
  };

  // setInterval runs a little late on every tick: send the rounds the elapsed time calls for, so the rate holds.
  // The backlog is capped at one second, so waking up from a laptop sleep does not flood the hub.
  setInterval(() => {
    const now = Date.now();
    const roundsDue = Math.floor(((now - startedAt) * config.rateHz) / 1000);
    roundsSent = Math.max(roundsSent, roundsDue - Math.ceil(config.rateHz));
    for (; roundsSent < roundsDue; roundsSent++) sendRound(now);
  }, 1000 / config.rateHz);

  // Under heavy load this timer fires late too: divide by the time that really elapsed, not by one second
  let lastReportAt = startedAt;
  setInterval(() => {
    const now = Date.now();
    const perSecond = Math.round((sentSinceReport * 1000) / Math.max(now - lastReportAt, 1));
    process.stdout.write(`\rsending ${perSecond} datagrams/s   `);
    sentSinceReport = 0;
    lastReportAt = now;
  }, 1000);

  console.log(`PulseHub simulator: ${config.devices} devices at ${config.rateHz} Hz -> udp://${config.host}:${config.port}`);
}

// Invalid options throw before any socket or timer exists, so the process simply ends with an error code
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
