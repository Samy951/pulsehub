import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { decode } from '../../src/protocol/decode.ts';
import type { DecodeError } from '../../src/protocol/decode.ts';
import { encode } from '../../src/protocol/encode.ts';
import { FrameType, MetricId } from '../../src/protocol/frame.ts';
import type { Frame } from '../../src/protocol/frame.ts';

const telemetry: Frame = {
  type: FrameType.TELEMETRY,
  deviceId: 12,
  seq: 4_000_000_000,
  uptimeMs: 3_600_000,
  measures: [
    { metricId: MetricId.TEMPERATURE, value: 4250 },
    { metricId: MetricId.VOLTAGE, value: 12_000 },
    { metricId: MetricId.CURRENT, value: -150 },
  ],
};

function mutated(change: (bytes: Buffer) => void): Buffer {
  const bytes = encode(telemetry);
  change(bytes);
  return bytes;
}

test('décode la trame exemple du sujet (HEARTBEAT, checksum F6)', () => {
  const result = decode(Buffer.from('50480102000700000001000003e800f6', 'hex'));

  assert.deepEqual(result, {
    ok: true,
    frame: { type: FrameType.HEARTBEAT, deviceId: 7, seq: 1, uptimeMs: 1000, measures: [] },
  });
});

test('décode une TELEMETRY en conservant le signe des valeurs int16', () => {
  assert.deepEqual(decode(encode(telemetry)), { ok: true, frame: telemetry });
});

const invalidFrames: [DecodeError, Buffer][] = [
  ['too-short', Buffer.alloc(15)],
  ['too-long', Buffer.alloc(513)],
  ['bad-magic', mutated((b) => (b[0] = 0x00))],
  ['bad-version', mutated((b) => (b[2] = 2))],
  ['bad-type', mutated((b) => (b[3] = 0x09))],
  ['bad-length', encode(telemetry).subarray(0, 20)],
  ['bad-checksum', mutated((b) => b.writeUInt8(b.readUInt8(b.length - 1) ^ 0xff, b.length - 1))],
  ['bad-device', encode({ ...telemetry, deviceId: 0 })],
  ['bad-count', encode({ ...telemetry, type: FrameType.HEARTBEAT })],
  ['bad-metric', encode({ ...telemetry, measures: [{ metricId: 9 as MetricId, value: 1 }] })],
];

for (const [error, bytes] of invalidFrames) {
  test(`rejette une trame invalide : ${error}`, () => {
    assert.deepEqual(decode(bytes), { ok: false, error });
  });
}

test('ne lève jamais d\'exception, même sur 1000 datagrammes aléatoires', () => {
  for (let i = 0; i < 1000; i++) {
    assert.doesNotThrow(() => decode(randomBytes(randomInt(0, 600))));
  }
});
