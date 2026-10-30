import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sequencer } from '../../src/hub/sequencer.ts';

const REBOOT_GAP_MS = 3000;

// Each step is [deviceId, seq, uptimeMs]; uptime defaults to a device emitting every 50 ms
function verdicts(steps: [deviceId: number, seq: number, uptimeMs?: number][]): unknown[] {
  const sequencer = new Sequencer(REBOOT_GAP_MS);
  return steps.map(([deviceId, seq, uptimeMs]) => sequencer.check(deviceId, seq, uptimeMs ?? seq * 50));
}

test('accepte la première trame d\'un appareil, sans perte', () => {
  assert.deepEqual(verdicts([[1, 42]]), [{ kind: 'accepted', lost: 0 }]);
});

test('accepte les trames qui se suivent, sans perte', () => {
  assert.deepEqual(verdicts([[1, 7], [1, 8]]).at(-1), { kind: 'accepted', lost: 0 });
});

test('compte les numéros sautés comme des pertes', () => {
  assert.deepEqual(verdicts([[1, 1], [1, 4]]).at(-1), { kind: 'accepted', lost: 2 });
});

test('écarte un doublon (même numéro que la dernière trame)', () => {
  assert.deepEqual(verdicts([[1, 5], [1, 5]]).at(-1), { kind: 'duplicate' });
});

test('écarte une trame en retard (numéro déjà dépassé)', () => {
  assert.deepEqual(verdicts([[1, 5], [1, 3]]).at(-1), { kind: 'late' });
});

test('suit chaque appareil séparément', () => {
  assert.deepEqual(verdicts([[1, 10], [2, 0], [2, 1]]), [
    { kind: 'accepted', lost: 0 },
    { kind: 'accepted', lost: 0 },
    { kind: 'accepted', lost: 0 },
  ]);
});

test('gère le retour à zéro du compteur uint32', () => {
  assert.deepEqual(verdicts([[1, 0xffff_ffff], [1, 0]]).at(-1), { kind: 'accepted', lost: 0 });
  assert.deepEqual(verdicts([[1, 0xffff_fffe], [1, 1]]).at(-1), { kind: 'accepted', lost: 2 });
  assert.deepEqual(verdicts([[1, 0], [1, 0xffff_ffff]]).at(-1), { kind: 'late' });
});

test('détecte un redémarrage (uptime qui repart de 0) puis repart de zéro pour cet appareil', () => {
  assert.deepEqual(verdicts([[1, 500, 25_000], [1, 0, 0], [1, 1, 50]]).slice(1), [
    { kind: 'rebooted' },
    { kind: 'accepted', lost: 0 },
  ]);
});

test('ne prend pas le retour à zéro de uptime pour un redémarrage si seq continue d\'avancer', () => {
  assert.deepEqual(verdicts([[1, 100, 0xffff_ff00], [1, 101, 10]]).at(-1), { kind: 'accepted', lost: 0 });
});
