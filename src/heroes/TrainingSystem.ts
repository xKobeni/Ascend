import { Random } from "../core/Random";
import type { Hero, TrainingAssignment, TrainingType } from "./Hero";
import type { NeedsSystem } from "./NeedsSystem";

const MAX_TRAINING_SLOTS = 3;
const INJURY_CHECK_INTERVAL_MINUTES = 60;

export class TrainingSystem {
  constructor(private readonly random = Random.fromEntropy()) {}

  queueTraining(hero: Hero, type: TrainingType): boolean {
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

  step(heroes: readonly Hero[], gameMinutes: number, needsSystem: NeedsSystem): void {
    heroes.forEach((hero) => {
      const assignment = hero.training.active;
      if (!assignment || hero.movement.activity !== "Training") {
        return;
      }

      const trainingRate = 0.42 + hero.personality.discipline * 0.16 + hero.attributes.endurance * 0.01;
      assignment.progress = Math.min(100, assignment.progress + gameMinutes * trainingRate);
      hero.training.injuryCheckMinutes += gameMinutes;
      this.checkForInjury(hero, needsSystem);

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
      const previous = hero.skills.defense;
      hero.skills.defense = Math.min(10, previous + 1);
      hero.training.lastOutcome = this.describeImprovement(
        "Defense",
        previous,
        hero.skills.defense,
      );
      return;
    }

    const skill = hero.skills.sword <= hero.skills.spear ? "sword" : "spear";
    const previous = hero.skills[skill];
    hero.skills[skill] = Math.min(10, previous + 1);
    hero.training.lastOutcome = this.describeImprovement(
      skill === "sword" ? "Sword" : "Spear",
      previous,
      hero.skills[skill],
    );
  }

  private checkForInjury(hero: Hero, needsSystem: NeedsSystem): void {
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
    hero.training.lastOutcome = `Minor training injury · -${damage} health.`;
  }

  private describeImprovement(label: string, previous: number, current: number): string {
    return current > previous ? `${label} improved to ${current}.` : `${label} is already mastered.`;
  }
}
