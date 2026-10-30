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

export function isStopped(deviceId: number, elapsedMs: number, stop: StopFault): boolean {
  return deviceId <= stop.devices && elapsedMs >= stop.afterMs;
}

function withAnomaly(frame: Frame): Frame {
  const measures = frame.measures.map((measure) =>
    measure.metricId === MetricId.TEMPERATURE ? { ...measure, value: ANOMALY_TEMPERATURE } : measure,
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
  private readonly random: Random;
  private readonly held = new Map<number, Buffer>();

  constructor(rates: FaultRates, random: Random) {
    this.rates = rates;
    this.random = random;
  }

  apply(frame: Frame): Buffer[] {
    const bytes = encode(this.roll(this.rates.anomaly) ? withAnomaly(frame) : frame);
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
