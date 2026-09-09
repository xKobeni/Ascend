export interface ClockFrame {
  frameDeltaSeconds: number;
  interpolationAlpha: number;
  steps: number;
}

export class GameClock {
  private accumulatorSeconds = 0;
  private previousTimeMs: number | null = null;

  constructor(
    readonly fixedStepSeconds = 1 / 20,
    private readonly maximumFrameSeconds = 0.25,
    private readonly maximumStepsPerFrame = 5,
  ) {}

  advance(timestampMs: number, onStep: (deltaSeconds: number) => void): ClockFrame {
    if (this.previousTimeMs === null) {
      this.previousTimeMs = timestampMs;
      return { frameDeltaSeconds: 0, interpolationAlpha: 0, steps: 0 };
    }

    const frameSeconds = Math.min(
      Math.max((timestampMs - this.previousTimeMs) / 1_000, 0),
      this.maximumFrameSeconds,
    );
    this.previousTimeMs = timestampMs;
    this.accumulatorSeconds += frameSeconds;

    let steps = 0;
    while (
      this.accumulatorSeconds >= this.fixedStepSeconds &&
      steps < this.maximumStepsPerFrame
    ) {
      onStep(this.fixedStepSeconds);
      this.accumulatorSeconds -= this.fixedStepSeconds;
      steps += 1;
    }

    if (steps === this.maximumStepsPerFrame) {
      this.accumulatorSeconds %= this.fixedStepSeconds;
    }

    return {
      frameDeltaSeconds: frameSeconds,
      interpolationAlpha: this.accumulatorSeconds / this.fixedStepSeconds,
      steps,
    };
  }

  resetFrameTime(): void {
    this.previousTimeMs = null;
    this.accumulatorSeconds = 0;
  }
}
