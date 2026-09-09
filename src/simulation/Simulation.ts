import type { Hero } from "../heroes/Hero";
import { HeroManager } from "../heroes/HeroManager";

export interface SimulationSnapshot {
  elapsedSeconds: number;
  heroCount: number;
  tick: number;
}

export class Simulation {
  private readonly heroManager = new HeroManager();
  private readonly state: SimulationSnapshot = {
    elapsedSeconds: 0,
    heroCount: 5,
    tick: 0,
  };

  constructor() {
    this.heroManager.generateInitialRoster(this.state.heroCount);
  }

  step(deltaSeconds: number): void {
    this.state.tick += 1;
    this.state.elapsedSeconds += deltaSeconds;
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
}
