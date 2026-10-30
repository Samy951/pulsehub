import { decode } from '../protocol/decode.ts';
import type { Sequencer } from './sequencer.ts';
import type { FleetSummary } from './summary.ts';

// The hub's processing chain for one datagram: decode, then sequence, then summarise
export class Pipeline {
  private readonly sequencer: Sequencer;
  private readonly summary: FleetSummary;

  constructor(sequencer: Sequencer, summary: FleetSummary) {
    this.sequencer = sequencer;
    this.summary = summary;
  }

  handle(bytes: Buffer, now: number): void {
    const result = decode(bytes);
    if (!result.ok) {
      this.summary.recordInvalid(result.error, now);
      return;
    }
    const { deviceId, seq, uptimeMs } = result.frame;
    this.summary.recordFrame(result.frame, this.sequencer.check(deviceId, seq, uptimeMs), now);
  }
}
