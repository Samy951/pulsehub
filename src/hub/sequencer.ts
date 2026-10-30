export type Verdict = { kind: 'accepted'; lost: number } | { kind: 'duplicate' } | { kind: 'late' };

// seq is a uint32 that wraps to 0: a frame at most half the range ahead counts as newer, anything else as older
const HALF_RANGE = 2 ** 31;

// Remembers the last accepted seq of each device and judges every new frame against it
export class Sequencer {
  private readonly lastSeq = new Map<number, number>();

  check(deviceId: number, seq: number): Verdict {
    const last = this.lastSeq.get(deviceId);
    if (last === undefined) {
      this.lastSeq.set(deviceId, seq);
      return { kind: 'accepted', lost: 0 };
    }

    const distance = (seq - last) >>> 0; // how far ahead seq is, modulo 2^32
    if (distance === 0) return { kind: 'duplicate' };
    if (distance >= HALF_RANGE) return { kind: 'late' };

    this.lastSeq.set(deviceId, seq);
    return { kind: 'accepted', lost: distance - 1 };
  }
}
