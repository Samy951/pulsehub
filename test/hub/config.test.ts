import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHubConfig } from '../../src/hub/config.ts';

test('sans variable : UDP 9000, HTTP 8080, rafraîchissement 500 ms, muet après 2 s, chaud au-delà de 70 °C', () => {
  assert.deepEqual(loadHubConfig({}), {
    udpPort: 9000,
    httpPort: 8080,
    refreshMs: 500,
    silentAfterMs: 2000,
    hotTemperature: 7000,
    rebootGapMs: 3000,
  });
});

test('lit chaque paramètre depuis l\'environnement', () => {
  const config = loadHubConfig({
    PULSEHUB_UDP_PORT: '9100',
    PULSEHUB_HTTP_PORT: '3000',
    PULSEHUB_REFRESH_MS: '250',
    PULSEHUB_SILENT_AFTER_MS: '5000',
    PULSEHUB_HOT_CELSIUS: '65.5',
    PULSEHUB_REBOOT_GAP_MS: '10000',
  });

  assert.deepEqual(config, {
    udpPort: 9100,
    httpPort: 3000,
    refreshMs: 250,
    silentAfterMs: 5000,
    hotTemperature: 6550,
    rebootGapMs: 10_000,
  });
});

test('refuse une valeur invalide en nommant la variable fautive', () => {
  assert.throws(() => loadHubConfig({ PULSEHUB_UDP_PORT: 'neuf-mille' }), /PULSEHUB_UDP_PORT must be a number/);
});
