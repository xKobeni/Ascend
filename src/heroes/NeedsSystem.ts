import type { Hero, HeroNeeds } from "./Hero";
import type { ScheduledActivity } from "../base/NavigationPoints";

export interface HeroDecision {
  activity: ScheduledActivity;
  reason: string | null;
  source: "Need" | "Schedule";
}

const clampNeed = (value: number): number => Math.min(100, Math.max(0, value));

export class NeedsSystem {
  step(heroes: readonly Hero[], gameMinutes: number): void {
    const gameHours = gameMinutes / 60;
    heroes.forEach((hero) => this.updateHero(hero, gameHours));
  }

  chooseActivity(
    hero: Readonly<Hero>,
    scheduledActivity: ScheduledActivity,
    isPlayerDirected = false,
  ): HeroDecision {
    const { needs, movement } = hero;

    const recoveryInjury = hero.injuries.find((injury) => !injury.permanent);
    if (recoveryInjury && needs.hunger >= 25) {
      return this.needDecision("Resting", `Injury recovery · ${recoveryInjury.type}`);
    }

    if (
      movement.decisionSource === "Need" &&
      movement.targetActivity === "Eating" &&
      needs.hunger < 76
    ) {
      return this.needDecision("Eating", "Low hunger");
    }
    if (
      movement.decisionSource === "Need" &&
      movement.targetActivity === "Resting" &&
      (needs.fatigue > 32 || needs.stress > 38 || needs.health < 72)
    ) {
      return this.needDecision("Resting", this.getRestReason(needs));
    }
    if (
      movement.decisionSource === "Need" &&
      movement.targetActivity === "Socializing" &&
      needs.social < 76
    ) {
      return this.needDecision("Socializing", "Low social need");
    }

    const hungerThreshold = isPlayerDirected ? 35 : 56;
    const fatigueThreshold = isPlayerDirected ? 78 : 58;
    const stressThreshold = isPlayerDirected ? 88 : 72;
    const healthThreshold = isPlayerDirected ? 38 : 48;
    const socialThreshold = isPlayerDirected ? 25 : 55;
    const choices = [
      {
        activity: "Eating" as const,
        reason: "Low hunger",
        urgency: hungerThreshold - needs.hunger,
      },
      {
        activity: "Resting" as const,
        reason: this.getRestReason(needs),
        urgency: Math.max(
          needs.fatigue - fatigueThreshold,
          needs.stress - stressThreshold,
          healthThreshold - needs.health,
        ),
      },
      {
        activity: "Socializing" as const,
        reason: "Low social need",
        urgency: socialThreshold - needs.social,
      },
    ].sort((left, right) => right.urgency - left.urgency);

    const mostUrgent = choices[0];
    if (mostUrgent && mostUrgent.urgency > 0) {
      return this.needDecision(mostUrgent.activity, mostUrgent.reason);
    }
    return { activity: scheduledActivity, reason: null, source: "Schedule" };
  }

  applyCombatStress(hero: Hero, intensity: number): void {
    hero.needs.stress = clampNeed(hero.needs.stress + Math.max(0, intensity));
  }

  applyDeathStress(heroes: readonly Hero[], deathCount: number, defeatOutcome = false): void {
    const baseStress = deathCount >= 3 ? 30 : deathCount === 2 ? 20 : 12;
    const defeatBonus = defeatOutcome ? 8 : 0;
    const totalStress = baseStress + defeatBonus;
    heroes.forEach((hero) => this.applyCombatStress(hero, totalStress));
  }

  applyInjury(hero: Hero, damage: number): void {
    const boundedDamage = Math.max(0, damage);
    hero.needs.health = clampNeed(hero.needs.health - boundedDamage);
    hero.needs.stress = clampNeed(hero.needs.stress + boundedDamage * 0.65);
  }

  private updateHero(hero: Hero, gameHours: number): void {
    const { needs } = hero;
    const activity = hero.movement.activity;

    needs.hunger = clampNeed(
      needs.hunger + (activity === "Eating" ? 24 : -4.5) * gameHours,
    );
    needs.fatigue = clampNeed(
      needs.fatigue +
        (activity === "Resting"
          ? -22
          : activity === "Training"
            ? 9
            : activity === "Walking"
              ? 4
              : 1.5) *
          gameHours,
    );
    needs.social = clampNeed(
      needs.social + (activity === "Socializing" ? 20 : -3.25) * gameHours,
    );
    needs.stress = clampNeed(
      needs.stress +
        (activity === "Resting" ? -5 : activity === "Socializing" ? -3 : -0.5) * gameHours,
    );

    const moraleRate =
      (activity === "Resting" ? 1.5 : 0) +
      (activity === "Socializing" ? 2.5 : 0) +
      (needs.hunger < 35 ? -4 : 0) +
      (needs.health < 70 ? -3 : 0) +
      (needs.stress > 60 ? -2 : 0);
    needs.morale = clampNeed(needs.morale + moraleRate * gameHours);

    if (activity === "Resting" && needs.health < 100) {
      needs.health = clampNeed(needs.health + 0.75 * gameHours);
    }
  }

  private getRestReason(needs: Readonly<HeroNeeds>): string {
    if (needs.health < 48) {
      return "Low health";
    }
    if (needs.stress > 72) {
      return "High stress";
    }
    return "High fatigue";
  }

  private needDecision(activity: ScheduledActivity, reason: string): HeroDecision {
    return { activity, reason, source: "Need" };
  }
}
