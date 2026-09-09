import { createInitialMovement } from "../base/NavigationPoints";
import type { Hero } from "./Hero";
import { HeroGenerator } from "./HeroGenerator";
import { HeroRoutineSystem } from "./HeroRoutineSystem";

export class HeroManager {
  private readonly heroes = new Map<string, Hero>();
  private readonly routineSystem = new HeroRoutineSystem();

  constructor(private readonly generator = new HeroGenerator()) {}

  generateInitialRoster(count: number): readonly Hero[] {
    while (this.heroes.size < count) {
      const hero = this.generator.generate(createInitialMovement(this.heroes.size));
      if ([...this.heroes.values()].some((existingHero) => existingHero.name === hero.name)) {
        continue;
      }
      this.heroes.set(hero.id, hero);
    }
    return this.getAll();
  }

  getAll(): readonly Hero[] {
    return [...this.heroes.values()];
  }

  getById(id: string): Readonly<Hero> | undefined {
    return this.heroes.get(id);
  }

  step(deltaSeconds: number, minuteOfDay: number): void {
    this.routineSystem.step([...this.heroes.values()], deltaSeconds, minuteOfDay);
  }

  getDayPeriod(minuteOfDay: number) {
    return this.routineSystem.getDayPeriod(minuteOfDay);
  }
}
