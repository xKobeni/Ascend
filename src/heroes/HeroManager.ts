import { createInitialMovement } from "../base/NavigationPoints";
import type { Hero } from "./Hero";
import { HeroGenerator } from "./HeroGenerator";
import { NeedsSystem } from "./NeedsSystem";
import { RelationshipSystem } from "./RelationshipSystem";
import { HeroRoutineSystem } from "./HeroRoutineSystem";
import { TrainingSystem } from "./TrainingSystem";
import type { TrainingType } from "./Hero";

export class HeroManager {
  private readonly heroes = new Map<string, Hero>();
  private readonly needsSystem = new NeedsSystem();
  private readonly relationshipSystem = new RelationshipSystem();
  private readonly routineSystem = new HeroRoutineSystem();
  private readonly trainingSystem = new TrainingSystem();
  private readonly usedNames = new Set<string>();

  constructor(private readonly generator = new HeroGenerator()) {}

  generateInitialRoster(count: number): readonly Hero[] {
    while (this.heroes.size < count) {
      const hero = this.generator.generate(
        createInitialMovement(this.heroes.size),
        this.heroes.size,
        this.usedNames,
      );
      this.usedNames.add(hero.name);
      this.heroes.set(hero.id, hero);
    }
    const heroes = this.getAll();
    this.relationshipSystem.initialize(heroes);
    return heroes;
  }

  getAll(): readonly Hero[] {
    return [...this.heroes.values()];
  }

  getById(id: string): Readonly<Hero> | undefined {
    return this.heroes.get(id);
  }

  queueTraining(heroId: string, type: TrainingType): boolean {
    const hero = this.heroes.get(heroId);
    return hero ? this.trainingSystem.queueTraining(hero, type) : false;
  }

  step(
    deltaSeconds: number,
    gameMinutes: number,
    day: number,
    minuteOfDay: number,
  ): void {
    const heroes = [...this.heroes.values()];
    this.trainingSystem.prepare(heroes);
    this.needsSystem.step(heroes, gameMinutes);
    this.routineSystem.step(
      heroes,
      deltaSeconds,
      minuteOfDay,
      this.needsSystem,
      this.trainingSystem,
    );
    this.trainingSystem.step(heroes, gameMinutes, this.needsSystem);
    this.relationshipSystem.step(heroes, gameMinutes, day, minuteOfDay);
  }

  getSocialEvents() {
    return this.relationshipSystem.getEvents();
  }

  getDayPeriod(minuteOfDay: number) {
    return this.routineSystem.getDayPeriod(minuteOfDay);
  }
}
