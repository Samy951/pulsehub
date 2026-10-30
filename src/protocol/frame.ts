// PulseHub v1 protocol: every multi-byte value is big-endian.

export const MAGIC = 0x5048; // "PH"
export const VERSION = 1;
export const HEADER_SIZE = 15;
export const MEASURE_SIZE = 3;
export const CHECKSUM_SIZE = 1;
export const MAX_FRAME_SIZE = 512;

export const FrameType = { TELEMETRY: 0x01, HEARTBEAT: 0x02 } as const;
export type FrameType = (typeof FrameType)[keyof typeof FrameType];

export const MetricId = { TEMPERATURE: 1, VOLTAGE: 2, CURRENT: 3 } as const;
export type MetricId = (typeof MetricId)[keyof typeof MetricId];

export interface Measure {
  metricId: MetricId;
  value: number; // int16: hundredths of °C, mV or mA depending on metricId
}

export interface Frame {
  type: FrameType;
  deviceId: number;
  seq: number;
  uptimeMs: number;
  measures: Measure[];
}

export function isFrameType(value: number): value is FrameType {
  return (Object.values(FrameType) as number[]).includes(value);
}

export function isMetricId(value: number): value is MetricId {
  return (Object.values(MetricId) as number[]).includes(value);
}

export function frameSize(measureCount: number): number {
  return HEADER_SIZE + MEASURE_SIZE * measureCount + CHECKSUM_SIZE;
}

export function xorChecksum(bytes: Uint8Array): number {
  let checksum = 0;
  for (const byte of bytes) checksum ^= byte;
  return checksum;
}
