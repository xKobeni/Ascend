import { Random } from "../core/Random";
import type { Hero, HeroInjury, InjuryType, TrainingType } from "./Hero";

export interface InjuryDefinition {
  attackMultiplier: number;
  defenseMultiplier: number;
  description: string;
  recoveryMinutes: number;
  trainingMultiplier: number;
  treatmentCost: number;
}

export interface InjuryModifiers {
  attack: number;
  defense: number;
  training: number;
}

export interface TreatmentResult {
  cost: number;
  message: string;
  success: boolean;
}

const HOUR = 60;
const DEFINITIONS: Readonly<Record<InjuryType, Readonly<InjuryDefinition>>> = Object.freeze({
  "Minor Wound": Object.freeze({ attackMultiplier: 0.95, defenseMultiplier: 0.96, description: "Light trauma reduces combat readiness and training pace.", recoveryMinutes: 18 * HOUR, trainingMultiplier: 0.88, treatmentCost: 1 }),
  "Broken Arm": Object.freeze({ attackMultiplier: 0.8, defenseMultiplier: 0.9, description: "Attack -20% · Defense -10% · Training speed -30%.", recoveryMinutes: 72 * HOUR, trainingMultiplier: 0.7, treatmentCost: 3 }),
  Burn: Object.freeze({ attackMultiplier: 0.92, defenseMultiplier: 0.82, description: "Defense -18% · Training speed -25%.", recoveryMinutes: 48 * HOUR, trainingMultiplier: 0.75, treatmentCost: 2 }),
  Concussion: Object.freeze({ attackMultiplier: 0.88, defenseMultiplier: 0.88, description: "Attack -12% · Defense -12% · Training speed -35%.", recoveryMinutes: 60 * HOUR, trainingMultiplier: 0.65, treatmentCost: 2 }),
});

export const getInjuryDefinition = (type: InjuryType): Readonly<InjuryDefinition> => DEFINITIONS[type];

export const hasRecoveringInjury = (hero: Readonly<Hero>): boolean =>
  hero.injuries.some((injury) => !injury.permanent);

export const getInjuryModifiers = (hero: Readonly<Hero>): InjuryModifiers => {
  const modifiers = hero.injuries.reduce((result, injury) => {
    const definition = getInjuryDefinition(injury.type);
    const permanenceScale = injury.permanent && injury.treated ? 0.5 : 1;
    result.attack *= 1 - (1 - definition.attackMultiplier) * permanenceScale;
    result.defense *= 1 - (1 - definition.defenseMultiplier) * permanenceScale;
    result.training *= 1 - (1 - definition.trainingMultiplier) * permanenceScale;
    return result;
  }, { attack: 1, defense: 1, training: 1 });
  return {
    attack: Math.max(0.5, modifiers.attack),
    defense: Math.max(0.5, modifiers.defense),
    training: Math.max(0.35, modifiers.training),
  };
};

export class InjurySystem {
  constructor(private readonly random = Random.fromEntropy()) {}

  inflictTrainingInjury(hero: Hero, day: number): HeroInjury {
    return this.inflict(hero, "Minor Wound", "Training", day, false);
  }

  inflictExpeditionInjury(hero: Hero, outcome: "Defeat" | "Withdrawn", damageRatio: number, day: number): HeroInjury {
    const severe = damageRatio >= 0.72 || outcome === "Defeat";
    const type: InjuryType = !severe
      ? "Minor Wound"
      : damageRatio >= 0.9
        ? this.random.next() < 0.5 ? "Broken Arm" : "Concussion"
        : this.random.next() < 0.5 ? "Burn" : "Concussion";
    const permanent = outcome === "Defeat" && damageRatio >= 0.92 && this.random.next() < 0.08;
    return this.inflict(hero, type, "Expedition", day, permanent);
  }

  step(heroes: readonly Hero[], gameMinutes: number): void {
    heroes.forEach((hero) => {
      if (hero.movement.activity !== "Resting") return;
      const recoveryRate = 0.7 + hero.attributes.endurance * 0.035;
      hero.injuries.forEach((injury) => {
        if (injury.permanent || injury.remainingMinutes === null) return;
        injury.remainingMinutes = Math.max(0, injury.remainingMinutes - gameMinutes * recoveryRate * (injury.treated ? 2.25 : 1));
      });
      const recovered = hero.injuries.filter((injury) => !injury.permanent && injury.remainingMinutes === 0);
      if (recovered.length === 0) return;
      hero.injuries.splice(0, hero.injuries.length, ...hero.injuries.filter((injury) => !recovered.includes(injury)));
      hero.recovery.lastOutcome = `${recovered.map((injury) => injury.type).join(" and ")} recovered.`;
      hero.needs.health = Math.min(100, hero.needs.health + recovered.length * 8);
    });
  }

  treat(hero: Hero, injuryId: string, availableMedicine: number): TreatmentResult {
    const injury = hero.injuries.find((candidate) => candidate.id === injuryId);
    if (!injury) return { cost: 0, message: "Injury record is no longer active.", success: false };
    if (injury.treated) return { cost: 0, message: `${injury.type} is already treated.`, success: false };
    const cost = getInjuryDefinition(injury.type).treatmentCost;
    if (availableMedicine < cost) return { cost: 0, message: `Treatment requires ${cost} Medicine.`, success: false };
    injury.treated = true;
    hero.needs.health = Math.min(100, hero.needs.health + 6);
    const message = injury.permanent
      ? `${injury.type} stabilized. Its lasting effect remains.`
      : `${injury.type} treated. Resting recovery is accelerated.`;
    hero.recovery.lastOutcome = message;
    return { cost, message, success: true };
  }

  getTrainingRestriction(hero: Readonly<Hero>, _type: TrainingType): string | null {
    const recovering = hero.injuries.find((injury) => !injury.permanent);
    return recovering ? `Recovery required before training · ${recovering.type}` : null;
  }

  private inflict(hero: Hero, type: InjuryType, source: HeroInjury["source"], day: number, permanent: boolean): HeroInjury {
    const existing = hero.injuries.find((injury) => injury.type === type);
    const definition = getInjuryDefinition(type);
    if (existing) {
      existing.permanent ||= permanent;
      existing.severity = existing.permanent ? "Permanent" : type === "Minor Wound" ? "Minor" : "Serious";
      existing.remainingMinutes = existing.permanent ? null : Math.max(existing.remainingMinutes ?? 0, definition.recoveryMinutes);
      existing.totalRecoveryMinutes = existing.permanent ? null : definition.recoveryMinutes;
      existing.treated = false;
      hero.recovery.lastOutcome = `${type} aggravated.`;
      return existing;
    }
    const injury: HeroInjury = {
      acquiredDay: day,
      id: crypto.randomUUID(),
      permanent,
      remainingMinutes: permanent ? null : definition.recoveryMinutes,
      severity: permanent ? "Permanent" : type === "Minor Wound" ? "Minor" : "Serious",
      source,
      totalRecoveryMinutes: permanent ? null : definition.recoveryMinutes,
      treated: false,
      type,
    };
    hero.injuries.push(injury);
    hero.recovery.lastOutcome = `${injury.severity} ${type.toLowerCase()} sustained.`;
    return injury;
  }
}
