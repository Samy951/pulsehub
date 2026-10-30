import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FaultInjector, isStopped } from '../../src/simulator/faults.ts';
import type { FaultRates } from '../../src/simulator/faults.ts';
import { decode } from '../../src/protocol/decode.ts';
import { encode } from '../../src/protocol/encode.ts';
import { FrameType, MetricId } from '../../src/protocol/frame.ts';
import type { Frame } from '../../src/protocol/frame.ts';

const NO_FAULTS: FaultRates = { badChecksum: 0, duplicate: 0, reorder: 0, anomaly: 0 };

// random() always returns 0: every fault with a rate above 0 fires, the others never do
function injector(rates: Partial<FaultRates>): FaultInjector {
  return new FaultInjector({ ...NO_FAULTS, ...rates }, () => 0);
}

function frame(seq: number): Frame {
  return {
    type: FrameType.TELEMETRY,
    deviceId: 5,
    seq,
    uptimeMs: seq * 50,
    measures: [
      { metricId: MetricId.TEMPERATURE, value: 4000 },
      { metricId: MetricId.VOLTAGE, value: 12_000 },
    ],
  };
}

test('sans défaut, envoie la trame telle quelle', () => {
  assert.deepEqual(injector({}).apply(frame(0)), [encode(frame(0))]);
});

test('checksum faux : le hub rejette la trame en bad-checksum', () => {
  assert.deepEqual(injector({ badChecksum: 1 }).apply(frame(0)).map(decode), [{ ok: false, error: 'bad-checksum' }]);
});

test('doublon : envoie deux fois la même trame', () => {
  const decoded = injector({ duplicate: 1 }).apply(frame(0)).map(decode);

  assert.deepEqual(decoded, [
    { ok: true, frame: frame(0) },
    { ok: true, frame: frame(0) },
  ]);
});

test('valeur anormale : la température passe à 95 °C, le reste ne change pas', () => {
  const [temperature, voltage] = frame(0).measures;
  const expected = { ...frame(0), measures: [{ ...temperature, value: 9500 }, voltage] };

  assert.deepEqual(injector({ anomaly: 1 }).apply(frame(0)).map(decode), [{ ok: true, frame: expected }]);
});

test('désordre : retient une trame et la livre après la suivante', () => {
  const faults = injector({ reorder: 1 });

  assert.deepEqual(faults.apply(frame(0)), []);
  const seqs = faults.apply(frame(1)).map((bytes) => {
    const result = decode(bytes);
    return result.ok ? result.frame.seq : -1;
  });
  assert.deepEqual(seqs, [1, 0]);
});

test('arrêt : les N premiers appareils se taisent une fois le délai écoulé', () => {
  const stop = { devices: 2, afterMs: 10_000 };

  assert.equal(isStopped(1, 9_999, stop), false);
  assert.equal(isStopped(1, 10_000, stop), true);
  assert.equal(isStopped(2, 10_000, stop), true);
});

test('arrêt : les autres appareils continuent d\'émettre', () => {
  assert.equal(isStopped(3, 60_000, { devices: 2, afterMs: 10_000 }), false);
});
