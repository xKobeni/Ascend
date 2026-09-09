import type { Hero } from "./Hero";
import { HeroGenerator } from "./HeroGenerator";

export class HeroManager {
  private readonly heroes = new Map<string, Hero>();

  constructor(private readonly generator = new HeroGenerator()) {}

  generateInitialRoster(count: number): readonly Hero[] {
    while (this.heroes.size < count) {
      const hero = this.generator.generate();
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
}
