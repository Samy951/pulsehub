export type Verdict =
  | { kind: 'accepted'; lost: number }
  | { kind: 'duplicate' }
  | { kind: 'late' }
  | { kind: 'rebooted' };

// seq is a uint32 that wraps to 0: a frame at most half the range ahead counts as newer, anything else as older
const HALF_RANGE = 2 ** 31;

interface LastFrame {
  seq: number;
  uptimeMs: number;
}

// Remembers the last accepted frame of each device and judges every new frame against it
export class Sequencer {
  private readonly rebootGapMs: number;
  private readonly last = new Map<number, LastFrame>();

  constructor(rebootGapMs: number) {
    this.rebootGapMs = rebootGapMs;
  }

  check(deviceId: number, seq: number, uptimeMs: number): Verdict {
    const last = this.last.get(deviceId);
    if (last === undefined) {
      this.last.set(deviceId, { seq, uptimeMs });
      return { kind: 'accepted', lost: 0 };
    }

    const distance = (seq - last.seq) >>> 0; // how far ahead seq is, modulo 2^32
    const isNewer = distance !== 0 && distance < HALF_RANGE;

    // A reboot restarts both counters; a merely late frame only steps back a few milliseconds of uptime
    if (!isNewer && last.uptimeMs - uptimeMs > this.rebootGapMs) {
      this.last.set(deviceId, { seq, uptimeMs });
      return { kind: 'rebooted' };
    }
    if (distance === 0) return { kind: 'duplicate' };
    if (!isNewer) return { kind: 'late' };

    this.last.set(deviceId, { seq, uptimeMs });
    return { kind: 'accepted', lost: distance - 1 };
  }
}
