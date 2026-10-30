import { encode } from '../protocol/encode.ts';
import { MetricId } from '../protocol/frame.ts';
import type { Frame } from '../protocol/frame.ts';
import type { Random } from './device.ts';

// Probability (0 to 1) that each fault hits a given frame
export interface FaultRates {
  badChecksum: number;
  duplicate: number;
  reorder: number;
  anomaly: number;
}

// Devices 1..devices go silent once afterMs have elapsed since the start
export interface StopFault {
  devices: number;
  afterMs: number;
}

// 95.00 °C: far above any healthy reading, yet still a valid int16
const ANOMALY_TEMPERATURE = 9500;
// 80.00 °C on every frame: above the hub's default 70 °C threshold for as long as the run lasts
const OVERHEAT_TEMPERATURE = 8000;

export function isStopped(deviceId: number, elapsedMs: number, stop: StopFault): boolean {
  return deviceId <= stop.devices && elapsedMs >= stop.afterMs;
}

function withTemperature(frame: Frame, value: number): Frame {
  const measures = frame.measures.map((measure) =>
    measure.metricId === MetricId.TEMPERATURE ? { ...measure, value } : measure,
  );
  return { ...frame, measures };
}

function corruptChecksum(bytes: Buffer): void {
  const last = bytes.length - 1;
  bytes.writeUInt8(bytes.readUInt8(last) ^ 0xff, last);
}

// Turns each frame into the datagrams to send right now, with faults applied at the configured rates
export class FaultInjector {
  private readonly rates: FaultRates;
  private readonly overheatDevices: number;
  private readonly random: Random;
  private readonly held = new Map<number, Buffer>();

  // overheatDevices: devices 1..overheatDevices report a sustained overheat, to demonstrate the hub's alert
  constructor(rates: FaultRates, overheatDevices: number, random: Random) {
    this.rates = rates;
    this.overheatDevices = overheatDevices;
    this.random = random;
  }

  apply(frame: Frame): Buffer[] {
    let content = frame.deviceId <= this.overheatDevices ? withTemperature(frame, OVERHEAT_TEMPERATURE) : frame;
    if (this.roll(this.rates.anomaly)) content = withTemperature(content, ANOMALY_TEMPERATURE);
    const bytes = encode(content);
    if (this.roll(this.rates.badChecksum)) corruptChecksum(bytes);

    const late = this.held.get(frame.deviceId);
    if (late !== undefined) {
      this.held.delete(frame.deviceId);
      return [bytes, late];
    }
    if (this.roll(this.rates.reorder)) {
      this.held.set(frame.deviceId, bytes);
      return [];
    }
    return this.roll(this.rates.duplicate) ? [bytes, bytes] : [bytes];
  }

  private roll(rate: number): boolean {
    return this.random() < rate;
  }
}
