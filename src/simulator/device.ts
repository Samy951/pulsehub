import { FrameType, MetricId } from '../protocol/frame.ts';
import type { Frame } from '../protocol/frame.ts';

export type Random = () => number;

// Healthy operating point of a device, in protocol units (hundredths of °C, mV, mA)
const NOMINAL = { temperature: 4000, voltage: 12_000, current: 2000 } as const;
const JITTER = { temperature: 300, voltage: 200, current: 300 } as const;

export class VirtualDevice {
  readonly deviceId: number;
  private readonly bootTime: number;
  private readonly random: Random;
  private seq = 0;

  constructor(deviceId: number, bootTime: number, random: Random) {
    this.deviceId = deviceId;
    this.bootTime = bootTime;
    this.random = random;
  }

  nextFrame(now: number): Frame {
    const frame: Frame = {
      type: FrameType.TELEMETRY,
      deviceId: this.deviceId,
      seq: this.seq,
      uptimeMs: (now - this.bootTime) >>> 0,
      measures: [
        { metricId: MetricId.TEMPERATURE, value: this.around(NOMINAL.temperature, JITTER.temperature) },
        { metricId: MetricId.VOLTAGE, value: this.around(NOMINAL.voltage, JITTER.voltage) },
        { metricId: MetricId.CURRENT, value: this.around(NOMINAL.current, JITTER.current) },
      ],
    };
    this.seq = (this.seq + 1) >>> 0; // uint32 counter: wraps to 0 like the real hardware
    return frame;
  }

  private around(nominal: number, jitter: number): number {
    return Math.round(nominal + (this.random() * 2 - 1) * jitter);
  }
}
