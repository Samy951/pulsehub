import type { DecodeError } from '../protocol/decode.ts';
import { MetricId } from '../protocol/frame.ts';
import type { Frame } from '../protocol/frame.ts';
import { RateCounter } from './rate-counter.ts';
import type { Verdict } from './sequencer.ts';

export interface SummaryThresholds {
  silentAfterMs: number;
  hotTemperature: number; // hundredths of °C, the protocol unit
  alertAfterMs: number;
}

export type DeviceStatus = 'ok' | 'hot' | 'alert' | 'silent';

// What the control room sees, in human units: °C, V, A
export interface DeviceView {
  deviceId: number;
  status: DeviceStatus;
  temperatureC: number | null;
  voltageV: number | null;
  currentA: number | null;
  lastSeenMsAgo: number;
  lost: number;
  reboots: number;
  hotReadings: number;
}

interface Counters {
  received: number;
  accepted: number;
  invalid: number;
  duplicates: number;
  late: number;
  lost: number;
  reboots: number;
}

export interface ReceptionView extends Counters {
  perSecond: number;
  invalidByReason: Partial<Record<DecodeError, number>>;
  lossRate: number; // share of expected frames that never arrived, from 0 to 1
}

export interface FleetSnapshot {
  reception: ReceptionView;
  statusCounts: Record<DeviceStatus, number>;
  devices: DeviceView[];
}

interface DeviceState {
  lastSeenAt: number;
  temperature: number | null;
  voltage: number | null;
  current: number | null;
  hotSince: number | null; // start of the current run of readings above the hot threshold
  lost: number;
  reboots: number;
  hotReadings: number;
}

const scaled = (value: number | null, divisor: number): number | null => (value === null ? null : value / divisor);

// Turns the stream of judged frames into the fleet summary the control room watches
export class FleetSummary {
  private readonly thresholds: SummaryThresholds;
  private readonly devices = new Map<number, DeviceState>();
  private readonly invalidByReason: Partial<Record<DecodeError, number>> = {};
  private readonly rate = new RateCounter();
  private readonly counters: Counters = { received: 0, accepted: 0, invalid: 0, duplicates: 0, late: 0, lost: 0, reboots: 0 };

  constructor(thresholds: SummaryThresholds) {
    this.thresholds = thresholds;
  }

  recordInvalid(error: DecodeError, now: number): void {
    this.countReceived(now);
    this.counters.invalid++;
    this.invalidByReason[error] = (this.invalidByReason[error] ?? 0) + 1;
  }

  recordFrame(frame: Frame, verdict: Verdict, now: number): void {
    this.countReceived(now);
    if (verdict.kind === 'duplicate') {
      this.counters.duplicates++;
      return;
    }
    if (verdict.kind === 'late') {
      this.counters.late++;
      return;
    }

    const device = this.devices.get(frame.deviceId) ?? this.newDevice(frame.deviceId);
    this.counters.accepted++;
    device.lastSeenAt = now;
    if (verdict.kind === 'accepted') {
      this.counters.lost += verdict.lost;
      device.lost += verdict.lost;
    } else {
      this.counters.reboots++;
      device.reboots++;
    }
    for (const { metricId, value } of frame.measures) {
      if (metricId === MetricId.TEMPERATURE) this.updateTemperature(device, value, now);
      else if (metricId === MetricId.VOLTAGE) device.voltage = value;
      else device.current = value;
    }
  }

  snapshot(now: number): FleetSnapshot {
    const devices = [...this.devices]
      .toSorted(([a], [b]) => a - b)
      .map(([deviceId, state]) => this.view(deviceId, state, now));
    const statusCounts: Record<DeviceStatus, number> = { ok: 0, hot: 0, alert: 0, silent: 0 };
    for (const device of devices) statusCounts[device.status]++;

    const expected = this.counters.accepted + this.counters.lost;
    return {
      reception: {
        ...this.counters,
        perSecond: this.rate.perSecond(now),
        invalidByReason: { ...this.invalidByReason },
        lossRate: expected === 0 ? 0 : this.counters.lost / expected,
      },
      statusCounts,
      devices,
    };
  }

  private countReceived(now: number): void {
    this.counters.received++;
    this.rate.add(now);
  }

  private newDevice(deviceId: number): DeviceState {
    const device: DeviceState = {
      lastSeenAt: 0, temperature: null, voltage: null, current: null, hotSince: null, lost: 0, reboots: 0, hotReadings: 0,
    };
    this.devices.set(deviceId, device);
    return device;
  }

  private updateTemperature(device: DeviceState, value: number, now: number): void {
    device.temperature = value;
    if (value > this.thresholds.hotTemperature) {
      device.hotReadings++;
      device.hotSince ??= now;
    } else {
      device.hotSince = null;
    }
  }

  private view(deviceId: number, state: DeviceState, now: number): DeviceView {
    return {
      deviceId,
      status: this.statusOf(state, now),
      temperatureC: scaled(state.temperature, 100),
      voltageV: scaled(state.voltage, 1000),
      currentA: scaled(state.current, 1000),
      lastSeenMsAgo: now - state.lastSeenAt,
      lost: state.lost,
      reboots: state.reboots,
      hotReadings: state.hotReadings,
    };
  }

  private statusOf(state: DeviceState, now: number): DeviceStatus {
    if (now - state.lastSeenAt > this.thresholds.silentAfterMs) return 'silent';
    if (state.hotSince === null) return 'ok';
    return now - state.hotSince >= this.thresholds.alertAfterMs ? 'alert' : 'hot';
  }
}
