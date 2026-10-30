// Throughput benchmark: runs the hub's processing chain (receiver -> pipeline -> summary) in this process and
// drives real simulator processes at rising loads. A load is sustained when the hub accepts what the simulators
// actually sent, with (almost) no loss. Several simulators run side by side because one tops out first.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { loadHubConfig } from '../src/hub/config.ts';
import { Pipeline } from '../src/hub/pipeline.ts';
import { startReceiver } from '../src/hub/receiver.ts';
import { Sequencer } from '../src/hub/sequencer.ts';
import { FleetSummary } from '../src/hub/summary.ts';
import { parseInteger } from '../src/shared/parse-number.ts';

// Its own port, so the benchmark can run while a hub is listening on PULSEHUB_UDP_PORT
const PORT = parseInteger('PULSEHUB_BENCH_PORT', process.env.PULSEHUB_BENCH_PORT ?? '9099', 1, 65_535);
// The measurement method itself (described in the README): 10 s per load step, loads below
const STEP_SECONDS = 10;

interface Load {
  simulators: number;
  devices: number; // per simulator
  rateHz: number;
}

const LOADS: Load[] = [
  { simulators: 1, devices: 50, rateHz: 20 },
  { simulators: 1, devices: 1000, rateHz: 100 },
  { simulators: 2, devices: 1000, rateHz: 100 },
  { simulators: 3, devices: 1000, rateHz: 100 },
  { simulators: 4, devices: 1000, rateHz: 100 },
];

interface RunningSimulator {
  child: ChildProcess;
  output: string;
}

function spawnSimulator(firstId: number, load: Load): RunningSimulator {
  const args = ['src/simulator/main.ts', '--port', String(PORT), '--first-id', String(firstId),
    '--devices', String(load.devices), '--rate', String(load.rateHz)];
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  const running: RunningSimulator = { child, output: '' };
  child.stdout?.on('data', (chunk: Buffer) => {
    running.output += chunk.toString();
  });
  return running;
}

// Each simulator prints "sending N datagrams/s" once per second: average them, skipping the start-up second
function averageSendRate(output: string): number {
  const rates = [...output.matchAll(/sending (\d+) datagrams\/s/g)].map((match) => Number(match[1])).slice(1);
  return rates.length === 0 ? 0 : Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
}

async function measure(summary: FleetSummary, load: Load): Promise<Record<string, string | number>> {
  const before = summary.snapshot(Date.now()).reception;
  const simulators = Array.from({ length: load.simulators }, (_, i) => spawnSimulator(i * load.devices + 1, load));

  await sleep(STEP_SECONDS * 1000);
  for (const simulator of simulators) simulator.child.kill();
  await sleep(500); // let the datagrams still in flight arrive

  const after = summary.snapshot(Date.now()).reception;
  const accepted = after.accepted - before.accepted;
  const lost = after.lost - before.lost;
  return {
    simulators: load.simulators,
    'offered (frames/s)': load.simulators * load.devices * load.rateHz,
    'sent (frames/s)': simulators.reduce((sum, simulator) => sum + averageSendRate(simulator.output), 0),
    'accepted (frames/s)': Math.round(accepted / STEP_SECONDS),
    'loss rate': `${((100 * lost) / Math.max(accepted + lost, 1)).toFixed(2)} %`,
  };
}

async function main(): Promise<void> {
  // Same settings as the hub, so the benchmark measures the chain exactly as `npm run hub` builds it
  const config = loadHubConfig(process.env);
  const summary = new FleetSummary({
    silentAfterMs: config.silentAfterMs,
    hotTemperature: config.hotTemperature,
    alertAfterMs: config.alertAfterMs,
  });
  const pipeline = new Pipeline(new Sequencer(config.rebootGapMs), summary);
  const socket = await startReceiver(PORT, (bytes) => pipeline.handle(bytes, Date.now()));

  const results = [];
  for (const load of LOADS) {
    console.log(`Measuring ${load.simulators} simulator(s) x ${load.devices} devices x ${load.rateHz} Hz for ${STEP_SECONDS} s...`);
    results.push(await measure(summary, load));
  }
  socket.close();
  console.table(results);
}

await main();
