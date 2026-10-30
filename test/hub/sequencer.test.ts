import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sequencer } from '../../src/hub/sequencer.ts';

function verdicts(steps: [deviceId: number, seq: number][]): unknown[] {
  const sequencer = new Sequencer();
  return steps.map(([deviceId, seq]) => sequencer.check(deviceId, seq));
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
