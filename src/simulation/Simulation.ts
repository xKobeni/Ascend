import type { Hero } from "../heroes/Hero";
import { HeroManager } from "../heroes/HeroManager";
import type { DayPeriod } from "../heroes/HeroRoutineSystem";
import type { TrainingType } from "../heroes/Hero";

const STARTING_MINUTE = 7 * 60;
const GAME_MINUTES_PER_REAL_SECOND = 12;

export interface SimulationSnapshot {
  day: number;
  elapsedSeconds: number;
  heroCount: number;
  minuteOfDay: number;
  period: DayPeriod;
  tick: number;
}

export class Simulation {
  private readonly heroManager = new HeroManager();
  private readonly state: SimulationSnapshot = {
    day: 1,
    elapsedSeconds: 0,
    heroCount: 5,
    minuteOfDay: STARTING_MINUTE,
    period: "Morning",
    tick: 0,
  };

  constructor() {
    this.heroManager.generateInitialRoster(this.state.heroCount);
  }

  step(deltaSeconds: number): void {
    this.state.tick += 1;
    this.state.elapsedSeconds += deltaSeconds;
    const totalGameMinutes = STARTING_MINUTE + this.state.elapsedSeconds * GAME_MINUTES_PER_REAL_SECOND;
    this.state.day = Math.floor(totalGameMinutes / (24 * 60)) + 1;
    this.state.minuteOfDay = totalGameMinutes % (24 * 60);
    this.state.period = this.heroManager.getDayPeriod(this.state.minuteOfDay);
    this.heroManager.step(
      deltaSeconds,
      deltaSeconds * GAME_MINUTES_PER_REAL_SECOND,
      this.state.day,
      this.state.minuteOfDay,
    );
  }

  getSnapshot(): Readonly<SimulationSnapshot> {
    return this.state;
  }

  getHeroes(): readonly Readonly<Hero>[] {
    return this.heroManager.getAll();
  }

  getHero(id: string): Readonly<Hero> | undefined {
    return this.heroManager.getById(id);
  }

  queueTraining(heroId: string, type: TrainingType): boolean {
    return this.heroManager.queueTraining(heroId, type);
  }

  getSocialEvents() {
    return this.heroManager.getSocialEvents();
  }
}
