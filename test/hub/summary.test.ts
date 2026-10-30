import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FleetSummary } from '../../src/hub/summary.ts';
import { FrameType, MetricId } from '../../src/protocol/frame.ts';
import type { Frame } from '../../src/protocol/frame.ts';

const THRESHOLDS = { silentAfterMs: 2000, hotTemperature: 7000, alertAfterMs: 3000 };
const ACCEPTED = { kind: 'accepted', lost: 0 } as const;

function telemetry(deviceId: number, temperature: number): Frame {
  return {
    type: FrameType.TELEMETRY,
    deviceId,
    seq: 0,
    uptimeMs: 0,
    measures: [
      { metricId: MetricId.TEMPERATURE, value: temperature },
      { metricId: MetricId.VOLTAGE, value: 12_000 },
      { metricId: MetricId.CURRENT, value: 2500 },
    ],
  };
}

function statusesAt(summary: FleetSummary, now: number): string[] {
  return summary.snapshot(now).devices.map((device) => device.status);
}

test('au démarrage, tout est à zéro et aucun appareil n\'est connu', () => {
  assert.deepEqual(new FleetSummary(THRESHOLDS).snapshot(0), {
    reception: {
      received: 0, perSecond: 0, accepted: 0, invalid: 0, invalidByReason: {},
      duplicates: 0, late: 0, lost: 0, lossRate: 0, reboots: 0,
    },
    statusCounts: { ok: 0, hot: 0, alert: 0, silent: 0 },
    devices: [],
  });
});

test('compte les datagrammes invalides par raison', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordInvalid('bad-checksum', 0);
  summary.recordInvalid('bad-checksum', 0);
  summary.recordInvalid('too-short', 0);

  const { reception } = summary.snapshot(0);
  assert.equal(reception.received, 3);
  assert.equal(reception.invalid, 3);
  assert.deepEqual(reception.invalidByReason, { 'bad-checksum': 2, 'too-short': 1 });
});

test('affiche les dernières mesures d\'un appareil en °C, V et A', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(4, 4250), ACCEPTED, 1000);

  assert.deepEqual(summary.snapshot(1500).devices, [{
    deviceId: 4, status: 'ok', temperatureC: 42.5, voltageV: 12, currentA: 2.5,
    lastSeenMsAgo: 500, lost: 0, reboots: 0, hotReadings: 0,
  }]);
});

test('compte doublons et retards sans toucher aux mesures de l\'appareil', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(1, 4000), ACCEPTED, 0);
  summary.recordFrame(telemetry(1, 9000), { kind: 'duplicate' }, 0);
  summary.recordFrame(telemetry(1, 9000), { kind: 'late' }, 0);

  const snapshot = summary.snapshot(0);
  assert.equal(snapshot.reception.duplicates, 1);
  assert.equal(snapshot.reception.late, 1);
  assert.equal(snapshot.reception.accepted, 1);
  assert.equal(snapshot.devices[0]?.temperatureC, 40);
});

test('cumule les pertes par appareil et calcule le taux de perte', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(1, 4000), ACCEPTED, 0);
  summary.recordFrame(telemetry(1, 4000), { kind: 'accepted', lost: 2 }, 0);

  const snapshot = summary.snapshot(0);
  assert.equal(snapshot.reception.lost, 2);
  assert.equal(snapshot.reception.lossRate, 0.5); // 2 lost out of 4 expected
  assert.equal(snapshot.devices[0]?.lost, 2);
});

test('compte les redémarrages de chaque appareil', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(1, 4000), { kind: 'rebooted' }, 0);

  assert.equal(summary.snapshot(0).reception.reboots, 1);
  assert.equal(summary.snapshot(0).devices[0]?.reboots, 1);
});

test('déclare un appareil muet quand il n\'a rien envoyé depuis plus de silentAfterMs', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(1, 4000), ACCEPTED, 0);

  assert.deepEqual(statusesAt(summary, 2000), ['ok']);
  assert.deepEqual(statusesAt(summary, 2001), ['silent']);
});

test('signale un appareil chaud au-dessus du seuil, et garde la trace du relevé', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(1, 9500), ACCEPTED, 0);

  assert.deepEqual(statusesAt(summary, 0), ['hot']);
  summary.recordFrame(telemetry(1, 4000), ACCEPTED, 50);
  assert.deepEqual(statusesAt(summary, 50), ['ok']);
  assert.equal(summary.snapshot(50).devices[0]?.hotReadings, 1);
});

test('passe en alerte après alertAfterMs de chaleur continue, puis revient à la normale', () => {
  const summary = new FleetSummary(THRESHOLDS);
  for (const now of [0, 1000, 2000, 3000]) summary.recordFrame(telemetry(1, 8000), ACCEPTED, now);
  assert.deepEqual(statusesAt(summary, 2999), ['hot']);
  assert.deepEqual(statusesAt(summary, 3000), ['alert']);

  summary.recordFrame(telemetry(1, 4000), ACCEPTED, 3100);
  assert.deepEqual(statusesAt(summary, 3100), ['ok']);
});

test('donne le débit de la dernière seconde complète', () => {
  const summary = new FleetSummary(THRESHOLDS);
  for (let i = 0; i < 20; i++) summary.recordFrame(telemetry(1, 4000), ACCEPTED, 1000 + i * 50);

  assert.equal(summary.snapshot(1999).reception.perSecond, 0);
  assert.equal(summary.snapshot(2000).reception.perSecond, 20);
  assert.equal(summary.snapshot(3500).reception.perSecond, 0);
});

test('compte les appareils par état, triés par numéro', () => {
  const summary = new FleetSummary(THRESHOLDS);
  summary.recordFrame(telemetry(3, 9000), ACCEPTED, 5000);
  summary.recordFrame(telemetry(1, 4000), ACCEPTED, 5000);
  summary.recordFrame(telemetry(2, 4000), ACCEPTED, 0);

  const snapshot = summary.snapshot(5000);
  assert.deepEqual(snapshot.devices.map((device) => device.deviceId), [1, 2, 3]);
  assert.deepEqual(snapshot.statusCounts, { ok: 1, hot: 1, alert: 0, silent: 1 });
});
