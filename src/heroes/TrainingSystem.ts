import { Random } from "../core/Random";
import type { Hero, TrainingAssignment, TrainingType } from "./Hero";
import type { NeedsSystem } from "./NeedsSystem";
import { SkillDiscoverySystem } from "../skills/SkillDiscoverySystem";
import { SkillLoadoutSystem } from "../skills/SkillLoadoutSystem";
import { SkillProgressionSystem } from "../skills/SkillProgressionSystem";
import { skillDefinitionRegistry } from "../skills/SkillDefinitionRegistry";
import { getInjuryModifiers, InjurySystem } from "./InjurySystem";

const MAX_TRAINING_SLOTS = 3;
const INJURY_CHECK_INTERVAL_MINUTES = 60;

export class TrainingSystem {
  constructor(
    private readonly skillProgression: SkillProgressionSystem,
    private readonly skillDiscovery: SkillDiscoverySystem,
    private readonly skillLoadout: SkillLoadoutSystem,
    private readonly injurySystem: InjurySystem,
    private readonly random = Random.fromEntropy(),
  ) {}

  queueTraining(hero: Hero, type: TrainingType): boolean {
    const restriction = this.injurySystem.getTrainingRestriction(hero, type);
    if (restriction) {
      hero.training.lastOutcome = restriction;
      return false;
    }
    const occupiedSlots = hero.training.queue.length + Number(hero.training.active !== null);
    if (occupiedSlots >= MAX_TRAINING_SLOTS) {
      hero.training.lastOutcome = "Training queue is full.";
      return false;
    }
    hero.training.queue.push(type);
    hero.training.lastOutcome = `${type} added to the queue.`;
    this.startNextAssignment(hero);
    return true;
  }

  prepare(heroes: readonly Hero[]): void {
    heroes.forEach((hero) => this.startNextAssignment(hero));
  }

  hasAssignment(hero: Readonly<Hero>): boolean {
    return hero.training.active !== null;
  }

  step(heroes: readonly Hero[], gameMinutes: number, needsSystem: NeedsSystem, day: number, facilityMultiplier = 1): void {
    heroes.forEach((hero) => {
      const assignment = hero.training.active;
      if (!assignment || hero.movement.activity !== "Training") {
        return;
      }

      if (this.injurySystem.getTrainingRestriction(hero, assignment.type)) {
        return;
      }
      const trainingRate = (0.42 + hero.personality.discipline * 0.16 + hero.attributes.endurance * 0.01) *
        getInjuryModifiers(hero).training * Math.max(1, facilityMultiplier);
      assignment.progress = Math.min(100, assignment.progress + gameMinutes * trainingRate);
      hero.training.injuryCheckMinutes += gameMinutes;
      this.checkForInjury(hero, needsSystem, day);

      if (assignment.progress >= 100) {
        this.completeAssignment(hero, assignment);
        hero.training.active = null;
        hero.training.injuryCheckMinutes = 0;
        this.startNextAssignment(hero);
      }
    });
  }

  private startNextAssignment(hero: Hero): void {
    if (hero.training.active) {
      return;
    }
    const type = hero.training.queue.shift();
    if (type) {
      hero.training.active = { progress: 0, type };
    }
  }

  private completeAssignment(hero: Hero, assignment: TrainingAssignment): void {
    if (assignment.type === "Strength Training") {
      const previous = hero.attributes.strength;
      hero.attributes.strength = Math.min(10, previous + 1);
      hero.training.lastOutcome = this.describeImprovement(
        "Strength",
        previous,
        hero.attributes.strength,
      );
      return;
    }

    if (assignment.type === "Defense Training") {
      this.completeSkillTraining(hero, "brace");
      return;
    }

    const skill = hero.skills.sword <= hero.skills.spear ? "sword" : "spear";
    this.completeSkillTraining(hero, `${skill}_mastery`);
  }

  private completeSkillTraining(hero: Hero, definitionId: string): void {
    const discovered = this.skillDiscovery.tryDiscover(hero, definitionId, "training");
    if (discovered) {
      this.skillLoadout.autoPrepare(hero, definitionId);
    }
    const result = this.skillProgression.recordTrainingCompletion(
      hero,
      definitionId,
      "Completed a deliberate training assignment.",
    );
    if (!result) {
      hero.training.lastOutcome = `${skillDefinitionRegistry.require(definitionId).name} could not improve yet.`;
      return;
    }
    this.skillDiscovery.evaluateProgression(hero, definitionId, "training").forEach((skill) => {
      this.skillLoadout.autoPrepare(hero, skill.definitionId);
    });
    const name = skillDefinitionRegistry.require(definitionId).name;
    hero.training.lastOutcome = result.levelAfter > result.levelBefore
      ? `${name} improved to ${result.levelAfter}.`
      : `${name} gained ${result.gainedXp} XP.`;
  }

  private checkForInjury(hero: Hero, needsSystem: NeedsSystem, day: number): void {
    if (hero.training.injuryCheckMinutes < INJURY_CHECK_INTERVAL_MINUTES) {
      return;
    }
    hero.training.injuryCheckMinutes %= INJURY_CHECK_INTERVAL_MINUTES;
    if (hero.needs.fatigue <= 72) {
      return;
    }

    const enduranceProtection = hero.attributes.endurance * 0.025;
    const injuryChance = Math.min(0.28, (hero.needs.fatigue - 68) / 100 - enduranceProtection);
    if (injuryChance <= 0 || this.random.next() >= injuryChance) {
      return;
    }

    const damage = this.random.integer(3, 7);
    needsSystem.applyInjury(hero, damage);
    this.injurySystem.inflictTrainingInjury(hero, day);
    hero.training.lastOutcome = `Minor Wound sustained during training · -${damage} health.`;
  }

  private describeImprovement(label: string, previous: number, current: number): string {
    return current > previous ? `${label} improved to ${current}.` : `${label} is already mastered.`;
  }
}
