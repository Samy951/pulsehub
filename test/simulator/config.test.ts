import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSimulatorConfig } from '../../src/simulator/config.ts';

test('sans option : 50 appareils à 20 Hz vers 127.0.0.1:9000, aucun défaut', () => {
  assert.deepEqual(parseSimulatorConfig([]), {
    devices: 50,
    rateHz: 20,
    host: '127.0.0.1',
    port: 9000,
    faults: { badChecksum: 0, duplicate: 0, reorder: 0, anomaly: 0 },
    stop: { devices: 0, afterMs: 10_000 },
  });
});

test('lit les options de la ligne de commande', () => {
  const config = parseSimulatorConfig([
    '--devices', '10',
    '--rate', '5',
    '--port', '9100',
    '--bad-checksum', '0.02',
    '--duplicate', '0.05',
    '--stop', '2',
    '--stop-after', '3',
  ]);

  assert.equal(config.devices, 10);
  assert.equal(config.rateHz, 5);
  assert.equal(config.port, 9100);
  assert.equal(config.faults.badChecksum, 0.02);
  assert.equal(config.faults.duplicate, 0.05);
  assert.deepEqual(config.stop, { devices: 2, afterMs: 3000 });
});

const invalidArgs: [string, string[], RegExp][] = [
  ['fréquence négative', ['--rate=-5'], /--rate must be a number between/],
  ['probabilité supérieure à 1', ['--duplicate', '2'], /--duplicate must be a number between 0 and 1/],
  ['nombre d\'appareils non entier', ['--devices', '1.5'], /--devices must be a whole number/],
  ['valeur non numérique', ['--port', 'abc'], /--port must be a number/],
  ['option inconnue', ['--speed', '3'], /Unknown option '--speed'/],
];

for (const [label, args, message] of invalidArgs) {
  test(`refuse une option invalide : ${label}`, () => {
    assert.throws(() => parseSimulatorConfig(args), message);
  });
}
