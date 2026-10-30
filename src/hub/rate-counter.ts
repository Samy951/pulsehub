// Counts events per whole second and reports the last complete one, so the figure is stable between refreshes
export class RateCounter {
  private second = 0;
  private current = 0;
  private previous = 0;

  add(now: number): void {
    this.roll(now);
    this.current++;
  }

  perSecond(now: number): number {
    this.roll(now);
    return this.previous;
  }

  private roll(now: number): void {
    const second = Math.floor(now / 1000);
    if (second === this.second) return;
    this.previous = second === this.second + 1 ? this.current : 0;
    this.second = second;
    this.current = 0;
  }
}
