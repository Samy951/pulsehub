import { HEADER_SIZE, MAGIC, MEASURE_SIZE, Offset, VERSION, frameSize, xorChecksum } from './frame.ts';
import type { Frame } from './frame.ts';

export function encode(frame: Frame): Buffer {
  const bytes = Buffer.alloc(frameSize(frame.measures.length));

  bytes.writeUInt16BE(MAGIC, Offset.MAGIC);
  bytes.writeUInt8(VERSION, Offset.VERSION);
  bytes.writeUInt8(frame.type, Offset.TYPE);
  bytes.writeUInt16BE(frame.deviceId, Offset.DEVICE_ID);
  bytes.writeUInt32BE(frame.seq, Offset.SEQ);
  bytes.writeUInt32BE(frame.uptimeMs, Offset.UPTIME_MS);
  bytes.writeUInt8(frame.measures.length, Offset.COUNT);

  frame.measures.forEach((measure, i) => {
    const offset = HEADER_SIZE + i * MEASURE_SIZE;
    bytes.writeUInt8(measure.metricId, offset);
    bytes.writeInt16BE(measure.value, offset + 1);
  });

  const last = bytes.length - 1;
  bytes.writeUInt8(xorChecksum(bytes.subarray(0, last)), last);
  return bytes;
}
