import {
  FrameType,
  HEADER_SIZE,
  MAGIC,
  MAX_FRAME_SIZE,
  MEASURE_SIZE,
  Offset,
  VERSION,
  frameSize,
  isFrameType,
  isMetricId,
  xorChecksum,
} from './frame.ts';
import type { Frame, Measure } from './frame.ts';

export type DecodeError =
  | 'too-short'
  | 'too-long'
  | 'bad-magic'
  | 'bad-version'
  | 'bad-type'
  | 'bad-length'
  | 'bad-checksum'
  | 'bad-device'
  | 'bad-count'
  | 'bad-metric';

export type DecodeResult = { ok: true; frame: Frame } | { ok: false; error: DecodeError };

const invalid = (error: DecodeError): DecodeResult => ({ ok: false, error });

// Never throws: every buffer read is preceded by the length check that makes it safe.
export function decode(bytes: Buffer): DecodeResult {
  if (bytes.length < frameSize(0)) return invalid('too-short');
  if (bytes.length > MAX_FRAME_SIZE) return invalid('too-long');
  if (bytes.readUInt16BE(Offset.MAGIC) !== MAGIC) return invalid('bad-magic');
  if (bytes.readUInt8(Offset.VERSION) !== VERSION) return invalid('bad-version');

  const type = bytes.readUInt8(Offset.TYPE);
  if (!isFrameType(type)) return invalid('bad-type');

  const count = bytes.readUInt8(Offset.COUNT);
  if (bytes.length !== frameSize(count)) return invalid('bad-length');

  const last = bytes.length - 1;
  if (xorChecksum(bytes.subarray(0, last)) !== bytes.readUInt8(last)) return invalid('bad-checksum');

  const deviceId = bytes.readUInt16BE(Offset.DEVICE_ID);
  if (deviceId === 0) return invalid('bad-device');
  if (type === FrameType.HEARTBEAT && count !== 0) return invalid('bad-count');

  const measures: Measure[] = [];
  for (let i = 0; i < count; i++) {
    const offset = HEADER_SIZE + i * MEASURE_SIZE;
    const metricId = bytes.readUInt8(offset);
    if (!isMetricId(metricId)) return invalid('bad-metric');
    measures.push({ metricId, value: bytes.readInt16BE(offset + 1) });
  }

  const seq = bytes.readUInt32BE(Offset.SEQ);
  const uptimeMs = bytes.readUInt32BE(Offset.UPTIME_MS);
  return { ok: true, frame: { type, deviceId, seq, uptimeMs, measures } };
}
