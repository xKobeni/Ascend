import { Random } from "../core/Random";
import type { Hero, HeroInjury, InjuryType, TrainingType } from "./Hero";

export interface InjuryDefinition {
  attackMultiplier: number;
  defenseMultiplier: number;
  description: string;
  recoveryMinutes: number;
  stackable?: boolean;
  maxStacks?: number;
  permanentChance?: number;
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
const BASE_PERMANENT_CHANCE = 0.08;

const DEFINITIONS: Readonly<Record<InjuryType, Readonly<InjuryDefinition>>> = Object.freeze({
  // ── Minor ──────────────────────────────────────────────────────────────

  "Minor Wound": Object.freeze({
    attackMultiplier: 0.95, defenseMultiplier: 0.96,
    description: "Light trauma reduces combat readiness and training pace.",
    recoveryMinutes: 18 * HOUR, trainingMultiplier: 0.88, treatmentCost: 1,
  }),
  "Sprain": Object.freeze({
    attackMultiplier: 0.97, defenseMultiplier: 0.94,
    description: "A twisted joint restricts movement. Defense -6% · Training speed -8%.",
    recoveryMinutes: 12 * HOUR, trainingMultiplier: 0.92, treatmentCost: 1,
  }),

  // ── Moderate ───────────────────────────────────────────────────────────

  "Bleed": Object.freeze({
    attackMultiplier: 0.94, defenseMultiplier: 0.97,
    description: "An open wound that worsens with exertion. Stacks up to 3 times.",
    recoveryMinutes: 24 * HOUR, stackable: true, maxStacks: 3,
    trainingMultiplier: 0.90, treatmentCost: 1,
  }),
  "Burn": Object.freeze({
    attackMultiplier: 0.92, defenseMultiplier: 0.82,
    description: "Defense -18% · Training speed -25%.",
    recoveryMinutes: 48 * HOUR, trainingMultiplier: 0.75, treatmentCost: 2,
  }),
  "Fracture": Object.freeze({
    attackMultiplier: 0.85, defenseMultiplier: 0.88,
    description: "A severe bone break. Attack -15% · Defense -12% · Training speed -28%.",
    recoveryMinutes: 54 * HOUR, trainingMultiplier: 0.72, treatmentCost: 2,
  }),
  "Poison": Object.freeze({
    attackMultiplier: 0.90, defenseMultiplier: 0.92,
    description: "Toxins weaken the body. Attack -10% · Defense -8% · Training speed -20%.",
    recoveryMinutes: 36 * HOUR, trainingMultiplier: 0.80, treatmentCost: 2,
  }),
  "Broken Arm": Object.freeze({
    attackMultiplier: 0.80, defenseMultiplier: 0.90,
    description: "Attack -20% · Defense -10% · Training speed -30%.",
    recoveryMinutes: 72 * HOUR, trainingMultiplier: 0.70, treatmentCost: 3,
  }),
  "Concussion": Object.freeze({
    attackMultiplier: 0.88, defenseMultiplier: 0.88,
    description: "Attack -12% · Defense -12% · Training speed -35%.",
    recoveryMinutes: 60 * HOUR, trainingMultiplier: 0.65, treatmentCost: 2,
  }),

  // ── Severe ─────────────────────────────────────────────────────────────

  "Burns (Severe)": Object.freeze({
    attackMultiplier: 0.86, defenseMultiplier: 0.80,
    description: "Devastating burns across the body. Attack -14% · Defense -20% · Training speed -30%.",
    recoveryMinutes: 54 * HOUR, permanentChance: 0.12,
    trainingMultiplier: 0.70, treatmentCost: 3,
  }),
  "Concussion (Severe)": Object.freeze({
    attackMultiplier: 0.82, defenseMultiplier: 0.82,
    description: "A traumatic head injury. Attack -18% · Defense -18% · Training speed -40%.",
    recoveryMinutes: 72 * HOUR, permanentChance: 0.12,
    trainingMultiplier: 0.60, treatmentCost: 3,
  }),
  "Internal Bleeding": Object.freeze({
    attackMultiplier: 0.82, defenseMultiplier: 0.85,
    description: "Internal hemorrhaging threatens vital organs. Attack -18% · Defense -15% · Training speed -35%.",
    recoveryMinutes: 66 * HOUR, permanentChance: 0.15,
    trainingMultiplier: 0.65, treatmentCost: 3,
  }),
});

export const getInjuryDefinition = (type: InjuryType): Readonly<InjuryDefinition> => DEFINITIONS[type];

export const hasRecoveringInjury = (hero: Readonly<Hero>): boolean =>
  hero.injuries.some((injury) => !injury.permanent);

export const getStackCount = (hero: Readonly<Hero>, type: InjuryType): number =>
  hero.injuries.filter((injury) => injury.type === type && !injury.permanent).length;

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
    const type: InjuryType = this.random.next() < 0.4 ? "Sprain" : "Minor Wound";
    return this.inflict(hero, type, "Training", day, false);
  }

  inflictExpeditionInjury(hero: Hero, outcome: "Defeat" | "Withdrawn", damageRatio: number, day: number): HeroInjury {
    const type = this.pickExpeditionInjury(damageRatio, outcome);
    const permanentChance = DEFINITIONS[type].permanentChance ?? BASE_PERMANENT_CHANCE;
    const permanent = outcome === "Defeat" && damageRatio >= 0.92 && this.random.next() < permanentChance;
    return this.inflict(hero, type, "Expedition", day, permanent);
  }

  step(heroes: readonly Hero[], gameMinutes: number, facilityMultiplier = 1): void {
    heroes.forEach((hero) => {
      if (hero.movement.activity !== "Resting") return;
      const recoveryRate = 0.7 + hero.attributes.endurance * 0.035;
      hero.injuries.forEach((injury) => {
        if (injury.permanent || injury.remainingMinutes === null) return;
        injury.remainingMinutes = Math.max(0, injury.remainingMinutes - gameMinutes * recoveryRate *
          (injury.treated ? 2.25 : 1) * Math.max(1, facilityMultiplier));
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

  private pickExpeditionInjury(damageRatio: number, outcome: "Defeat" | "Withdrawn"): InjuryType {
    const severe = damageRatio >= 0.72 || outcome === "Defeat";
    if (!severe) {
      return this.random.pick(["Minor Wound", "Sprain", "Bleed"]);
    }
    if (damageRatio >= 0.92) {
      return this.random.pick([
        "Broken Arm", "Concussion", "Internal Bleeding",
        "Burns (Severe)", "Concussion (Severe)", "Fracture",
      ]);
    }
    if (damageRatio >= 0.85) {
      return this.random.pick([
        "Burn", "Concussion", "Fracture", "Internal Bleeding",
        "Burns (Severe)", "Concussion (Severe)",
      ]);
    }
    if (damageRatio >= 0.72) {
      return this.random.pick([
        "Bleed", "Burn", "Fracture", "Concussion", "Poison",
      ]);
    }
    return this.random.pick(["Minor Wound", "Bleed", "Sprain", "Fracture"]);
  }

  private inflict(hero: Hero, type: InjuryType, source: HeroInjury["source"], day: number, permanent: boolean): HeroInjury {
    const definition = getInjuryDefinition(type);

    // Bleed and other stackable injuries: add a new instance
    if (definition.stackable) {
      const currentStacks = hero.injuries.filter((inj) => inj.type === type && !inj.permanent).length;
      const maxStacks = definition.maxStacks ?? 3;
      if (currentStacks >= maxStacks) {
        // Aggravate the oldest stack instead
        const oldest = hero.injuries.find((inj) => inj.type === type && !inj.permanent);
        if (oldest) {
          oldest.remainingMinutes = oldest.permanent ? null : Math.max(oldest.remainingMinutes ?? 0, definition.recoveryMinutes);
          oldest.treated = false;
          hero.recovery.lastOutcome = `${type} aggravated (${currentStacks} stacks).`;
          return oldest;
        }
      }
      const injury: HeroInjury = {
        acquiredDay: day,
        id: crypto.randomUUID(),
        permanent: false,
        remainingMinutes: definition.recoveryMinutes,
        severity: "Minor",
        source,
        totalRecoveryMinutes: definition.recoveryMinutes,
        treated: false,
        type,
      };
      hero.injuries.push(injury);
      const newStacks = hero.injuries.filter((inj) => inj.type === type && !inj.permanent).length;
      hero.recovery.lastOutcome = `${type} sustained (${newStacks} stacks).`;
      return injury;
    }

    // Non-stackable: merge if exists
    const existing = hero.injuries.find((injury) => injury.type === type);
    if (existing) {
      existing.permanent ||= permanent;
      existing.severity = existing.permanent ? "Permanent" : this.getSeverity(type);
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
      severity: permanent ? "Permanent" : this.getSeverity(type),
      source,
      totalRecoveryMinutes: permanent ? null : definition.recoveryMinutes,
      treated: false,
      type,
    };
    hero.injuries.push(injury);
    hero.recovery.lastOutcome = `${injury.severity} ${type.toLowerCase()} sustained.`;
    return injury;
  }

  private getSeverity(type: InjuryType): "Minor" | "Serious" {
    if (type === "Minor Wound" || type === "Sprain") return "Minor";
    return "Serious";
  }
}
