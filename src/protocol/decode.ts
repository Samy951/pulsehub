import {
  FrameType,
  HEADER_SIZE,
  MAGIC,
  MAX_FRAME_SIZE,
  MEASURE_SIZE,
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

// Ne lève jamais : chaque lecture du buffer est précédée du contrôle de longueur qui la rend sûre.
export function decode(bytes: Buffer): DecodeResult {
  if (bytes.length < frameSize(0)) return invalid('too-short');
  if (bytes.length > MAX_FRAME_SIZE) return invalid('too-long');
  if (bytes.readUInt16BE(0) !== MAGIC) return invalid('bad-magic');
  if (bytes.readUInt8(2) !== VERSION) return invalid('bad-version');

  const type = bytes.readUInt8(3);
  if (!isFrameType(type)) return invalid('bad-type');

  const count = bytes.readUInt8(14);
  if (bytes.length !== frameSize(count)) return invalid('bad-length');

  const last = bytes.length - 1;
  if (xorChecksum(bytes.subarray(0, last)) !== bytes.readUInt8(last)) return invalid('bad-checksum');

  const deviceId = bytes.readUInt16BE(4);
  if (deviceId === 0) return invalid('bad-device');
  if (type === FrameType.HEARTBEAT && count !== 0) return invalid('bad-count');

  const measures: Measure[] = [];
  for (let i = 0; i < count; i++) {
    const offset = HEADER_SIZE + i * MEASURE_SIZE;
    const metricId = bytes.readUInt8(offset);
    if (!isMetricId(metricId)) return invalid('bad-metric');
    measures.push({ metricId, value: bytes.readInt16BE(offset + 1) });
  }

  return {
    ok: true,
    frame: { type, deviceId, seq: bytes.readUInt32BE(6), uptimeMs: bytes.readUInt32BE(10), measures },
  };
}
