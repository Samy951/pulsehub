import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VirtualDevice } from '../../src/simulator/device.ts';
import { decode } from '../../src/protocol/decode.ts';
import { encode } from '../../src/protocol/encode.ts';

const BOOT_TIME = 1_000_000;
const middle = (): number => 0.5;

function valuesOf(device: VirtualDevice): number[] {
  return device.nextFrame(BOOT_TIME).measures.map((measure) => measure.value);
}

test('numérote ses trames à partir de 0, de 1 en 1', () => {
  const device = new VirtualDevice(3, BOOT_TIME, middle);

  const seqs = [device.nextFrame(BOOT_TIME), device.nextFrame(BOOT_TIME), device.nextFrame(BOOT_TIME)].map(
    (frame) => frame.seq,
  );

  assert.deepEqual(seqs, [0, 1, 2]);
});

test('calcule uptimeMs depuis son heure de démarrage', () => {
  const device = new VirtualDevice(3, BOOT_TIME, middle);

  assert.equal(device.nextFrame(BOOT_TIME + 1500).uptimeMs, 1500);
});

test('émet température, tension et courant au nominal quand l\'aléatoire est neutre', () => {
  assert.deepEqual(valuesOf(new VirtualDevice(3, BOOT_TIME, middle)), [4000, 12_000, 2000]);
});

test('garde ses mesures dans la plage nominal ± variation', () => {
  assert.deepEqual(valuesOf(new VirtualDevice(3, BOOT_TIME, () => 0)), [3700, 11_800, 1700]);
  assert.deepEqual(valuesOf(new VirtualDevice(3, BOOT_TIME, () => 1)), [4300, 12_200, 2300]);
});

test('produit des trames que le décodeur du hub accepte', () => {
  const frame = new VirtualDevice(42, BOOT_TIME, Math.random).nextFrame(BOOT_TIME + 50);

  assert.deepEqual(decode(encode(frame)), { ok: true, frame });
});
