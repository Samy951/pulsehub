import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pipeline } from '../../src/hub/pipeline.ts';
import { startReceiver } from '../../src/hub/receiver.ts';
import { Sequencer } from '../../src/hub/sequencer.ts';
import { FleetSummary } from '../../src/hub/summary.ts';
import { encode } from '../../src/protocol/encode.ts';
import { FrameType, MetricId } from '../../src/protocol/frame.ts';
import { send, waitFor } from '../helpers/udp.ts';

function createHub(): { pipeline: Pipeline; summary: FleetSummary } {
  const summary = new FleetSummary({ silentAfterMs: 2000, hotTemperature: 7000, alertAfterMs: 3000 });
  return { pipeline: new Pipeline(new Sequencer(3000), summary), summary };
}

function frame(seq: number): Buffer {
  return encode({
    type: FrameType.TELEMETRY,
    deviceId: 1,
    seq,
    uptimeMs: seq * 50,
    measures: [{ metricId: MetricId.TEMPERATURE, value: 4000 }],
  });
}

test('fait passer chaque datagramme par le décodage, le séquencement puis la synthèse', () => {
  const { pipeline, summary } = createHub();
  const datagrams = [frame(0), frame(1), frame(1), frame(4), frame(3), Buffer.from('garbage')];
  for (const bytes of datagrams) pipeline.handle(bytes, 0);

  const { received, accepted, duplicates, late, lost, invalid } = summary.snapshot(0).reception;
  assert.deepEqual({ received, accepted, duplicates, late, lost, invalid }, {
    received: 6, accepted: 3, duplicates: 1, late: 1, lost: 2, invalid: 1,
  });
});

test('de bout en bout : une trame envoyée en UDP arrive dans la synthèse', async () => {
  const { pipeline, summary } = createHub();
  const socket = await startReceiver(0, (bytes) => pipeline.handle(bytes, Date.now()));
  try {
    await send(socket.address().port, frame(0));
    await waitFor(() => summary.snapshot(Date.now()).reception.accepted === 1);
    assert.equal(summary.snapshot(Date.now()).devices[0]?.temperatureC, 40);
  } finally {
    socket.close();
  }
});
