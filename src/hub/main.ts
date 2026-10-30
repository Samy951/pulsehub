import { loadHubConfig } from './config.ts';
import { startDashboard } from './dashboard.ts';
import { Pipeline } from './pipeline.ts';
import { startReceiver } from './receiver.ts';
import { Sequencer } from './sequencer.ts';
import { FleetSummary } from './summary.ts';

// Composition root: the only place that builds the hub's parts and wires them together
async function main(): Promise<void> {
  const config = loadHubConfig(process.env);
  const summary = new FleetSummary({
    silentAfterMs: config.silentAfterMs,
    hotTemperature: config.hotTemperature,
    alertAfterMs: config.alertAfterMs,
  });
  const pipeline = new Pipeline(new Sequencer(config.rebootGapMs), summary);

  await startReceiver(config.udpPort, (bytes) => pipeline.handle(bytes, Date.now()));
  await startDashboard(config.httpPort, config.refreshMs, () => summary.snapshot(Date.now()));
  console.log(`PulseHub hub listening for frames on udp://0.0.0.0:${config.udpPort}`);
  console.log(`Control-room dashboard: http://localhost:${config.httpPort}`);
}

main().catch((error: unknown) => {
  console.error(`PulseHub hub failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
