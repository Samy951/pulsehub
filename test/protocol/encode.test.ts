import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from '../../src/protocol/encode.ts';
import { FrameType, MetricId } from '../../src/protocol/frame.ts';

test('encode la trame exemple du sujet octet pour octet', () => {
  const bytes = encode({ type: FrameType.HEARTBEAT, deviceId: 7, seq: 1, uptimeMs: 1000, measures: [] });

  assert.equal(bytes.toString('hex'), '50480102000700000001000003e800f6');
});

test('encode chaque mesure sur 3 octets : metricId puis value int16 signée', () => {
  const bytes = encode({
    type: FrameType.TELEMETRY,
    deviceId: 1,
    seq: 0,
    uptimeMs: 0,
    measures: [{ metricId: MetricId.CURRENT, value: -2 }],
  });

  assert.equal(bytes.length, 19);
  assert.equal(bytes.subarray(14, 18).toString('hex'), '0103fffe');
});
