import { createInitialMovement } from "../base/NavigationPoints";
import type { Hero } from "./Hero";
import { HeroGenerator } from "./HeroGenerator";
import { NeedsSystem } from "./NeedsSystem";
import { RelationshipSystem } from "./RelationshipSystem";
import { HeroRoutineSystem } from "./HeroRoutineSystem";
import { TrainingSystem } from "./TrainingSystem";
import type { TrainingType } from "./Hero";
import { SkillDiscoverySystem } from "../skills/SkillDiscoverySystem";
import { SkillLoadoutSystem } from "../skills/SkillLoadoutSystem";
import { SkillProgressionSystem } from "../skills/SkillProgressionSystem";
import type { SkillProgressionResult, SkillUsageEvent } from "../skills/Skill";

export class HeroManager {
  private readonly heroes = new Map<string, Hero>();
  private readonly needsSystem = new NeedsSystem();
  private readonly relationshipSystem = new RelationshipSystem();
  private readonly routineSystem = new HeroRoutineSystem();
  private readonly skillDiscovery = new SkillDiscoverySystem();
  private readonly skillLoadout = new SkillLoadoutSystem();
  private readonly skillProgression = new SkillProgressionSystem();
  private readonly trainingSystem = new TrainingSystem(
    this.skillProgression,
    this.skillDiscovery,
    this.skillLoadout,
  );
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

  toggleSkillLoadout(heroId: string, definitionId: string): boolean {
    const hero = this.heroes.get(heroId);
    return hero ? this.skillLoadout.toggle(hero, definitionId) : false;
  }

  recordSkillUsage(event: Readonly<SkillUsageEvent>): SkillProgressionResult | null {
    const hero = this.heroes.get(event.heroId);
    if (!hero) {
      return null;
    }
    const result = this.skillProgression.recordUsage(hero, event);
    if (!result) {
      return null;
    }
    this.skillDiscovery.evaluateProgression(hero, event.definitionId, event.source).forEach((skill) => {
      this.skillLoadout.autoPrepare(hero, skill.definitionId);
    });
    return result;
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
