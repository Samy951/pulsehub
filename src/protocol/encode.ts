import { HEADER_SIZE, MAGIC, MEASURE_SIZE, VERSION, frameSize, xorChecksum } from './frame.ts';
import type { Frame } from './frame.ts';

export function encode(frame: Frame): Buffer {
  const bytes = Buffer.alloc(frameSize(frame.measures.length));

  bytes.writeUInt16BE(MAGIC, 0);
  bytes.writeUInt8(VERSION, 2);
  bytes.writeUInt8(frame.type, 3);
  bytes.writeUInt16BE(frame.deviceId, 4);
  bytes.writeUInt32BE(frame.seq, 6);
  bytes.writeUInt32BE(frame.uptimeMs, 10);
  bytes.writeUInt8(frame.measures.length, 14);

  frame.measures.forEach((measure, i) => {
    const offset = HEADER_SIZE + i * MEASURE_SIZE;
    bytes.writeUInt8(measure.metricId, offset);
    bytes.writeInt16BE(measure.value, offset + 1);
  });

  const last = bytes.length - 1;
  bytes.writeUInt8(xorChecksum(bytes.subarray(0, last)), last);
  return bytes;
}
