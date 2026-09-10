import type { Hero, RelationshipMetrics } from "../heroes/Hero";
import type { RelationshipLabel } from "../heroes/RelationshipSystem";
import type {
  CombatMemoryEvent,
  HeroMemory,
  HeroMemoryType,
  MemoryCombatInfluence,
} from "./HeroMemory";

interface MemoryInput {
  day: number;
  persistent: boolean;
  summary: string;
  targetHeroId?: string | null;
  type: HeroMemoryType;
  weight: number;
}

interface RecordResult {
  changed: boolean;
  memory: HeroMemory;
}

const MAX_MEMORIES = 24;
const MINIMUM_WEIGHT = 5;
const MINOR_DECAY_PER_DAY = 6;

const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value));
const clampSigned = (value: number): number => Math.min(100, Math.max(-100, value));

export class MemorySystem {
  recordCombatEvent(
    heroes: readonly Hero[],
    event: Readonly<CombatMemoryEvent>,
    day: number,
    minuteOfDay = 0,
  ): void {
    const actor = heroes.find((hero) => hero.id === event.actorId);
    const target = heroes.find((hero) => hero.id === event.targetId);
    if (!actor || !target || actor.id === target.id) {
      return;
    }

    const actionMap: Record<CombatMemoryEvent["type"], string> = {
      ASSISTED_ALLY: "assisted",
      HEALED_ALLY: "treated",
      PROTECTED_ALLY: "protected",
      //REVIVED_ALLY: "revived",
    };
    const weightMap: Record<CombatMemoryEvent["type"], number> = {
      ASSISTED_ALLY: 36,
      HEALED_ALLY: 48,
      PROTECTED_ALLY: 44,
      //REVIVED_ALLY: 52,
    };
    const action = actionMap[event.type];
    const weight = weightMap[event.type];
    const saved = this.record(target, {
      day,
      persistent: false,
      summary: `${actor.name} ${action} ${target.name} during combat.`,
      targetHeroId: actor.id,
      type: "WAS_SAVED",
      weight,
    });
    const saver = this.record(actor, {
      day,
      persistent: false,
      summary: `${actor.name} ${action} ${target.name} during combat.`,
      targetHeroId: target.id,
      type: "SAVED_ALLY",
      weight: weight - 4,
    });

    if (!saved.changed && !saver.changed) {
      return;
    }
    target.needs.morale = clampPercentage(target.needs.morale + 2);
    actor.needs.morale = clampPercentage(actor.needs.morale + 1);
    this.adjustRelationship(target, actor.id, { affinity: 2, fear: -2, trust: 4 });
    this.adjustRelationship(actor, target.id, { respect: 2, trust: 1 });
    this.recordRelationshipHistory(target, actor.id, saved.memory.summary, day, minuteOfDay);
    this.recordRelationshipHistory(actor, target.id, saver.memory.summary, day, minuteOfDay);
  }

  recordAllyDeath(
    survivor: Hero,
    fallen: Readonly<Hero>,
    relationship: RelationshipLabel,
    day: number,
  ): HeroMemory {
    const relationshipWeight = relationship === "Trusted Friend"
      ? 92
      : relationship === "Friend"
        ? 78
        : relationship === "Companion"
          ? 66
          : 54;
    return this.record(survivor, {
      day,
      persistent: true,
      summary: `${fallen.name} died during an expedition.`,
      targetHeroId: fallen.id,
      type: "ALLY_DIED",
      weight: relationshipWeight,
    }).memory;
  }

  recordCriticalInjury(hero: Hero, injuryName: string, day: number): HeroMemory {
    return this.record(hero, {
      day,
      persistent: true,
      summary: `${hero.name} suffered ${injuryName.toLowerCase()} during an expedition.`,
      type: "CRITICAL_INJURY",
      weight: 72,
    }).memory;
  }

  step(heroes: readonly Hero[], gameMinutes: number): void {
    const decay = Math.max(0, gameMinutes) / (24 * 60) * MINOR_DECAY_PER_DAY;
    if (decay === 0) {
      return;
    }
    heroes.forEach((hero) => {
      hero.memories.forEach((memory) => {
        if (!memory.persistent) {
          memory.weight = clampPercentage(memory.weight - decay);
        }
      });
      hero.memories.splice(
        0,
        hero.memories.length,
        ...hero.memories.filter((memory) => memory.persistent || memory.weight >= MINIMUM_WEIGHT),
      );
    });
  }

  private record(hero: Hero, input: Readonly<MemoryInput>): RecordResult {
    const targetHeroId = input.targetHeroId ?? null;
    const existing = hero.memories.find(
      (memory) => memory.type === input.type && memory.targetHeroId === targetHeroId,
    );
    if (existing) {
      if (existing.lastReinforcedDay === input.day) {
        return { changed: false, memory: existing };
      }
      existing.lastReinforcedDay = input.day;
      existing.persistent ||= input.persistent;
      existing.summary = input.summary;
      existing.weight = clampPercentage(Math.max(existing.weight, input.weight) + 8);
      return { changed: true, memory: existing };
    }

    const memory: HeroMemory = {
      createdDay: input.day,
      id: crypto.randomUUID(),
      lastReinforcedDay: input.day,
      persistent: input.persistent,
      summary: input.summary,
      targetHeroId,
      type: input.type,
      weight: clampPercentage(input.weight),
    };
    hero.memories.unshift(memory);
    hero.memories.splice(MAX_MEMORIES);
    return { changed: true, memory };
  }

  private adjustRelationship(
    hero: Hero,
    targetHeroId: string,
    changes: Partial<RelationshipMetrics>,
  ): void {
    const profile = hero.relationships[targetHeroId];
    if (!profile) {
      return;
    }
    (Object.keys(changes) as Array<keyof RelationshipMetrics>).forEach((key) => {
      const value = profile.metrics[key] + (changes[key] ?? 0);
      profile.metrics[key] = key === "affinity" ? clampSigned(value) : clampPercentage(value);
    });
  }

  private recordRelationshipHistory(
    hero: Hero,
    targetHeroId: string,
    summary: string,
    day: number,
    minuteOfDay: number,
  ): void {
    const profile = hero.relationships[targetHeroId];
    if (!profile) {
      return;
    }
    profile.history.unshift({ day, minuteOfDay, summary, type: "help" });
    profile.history.splice(8);
  }
}

export function getMemoryCombatInfluence(
  memories: readonly Readonly<HeroMemory>[],
  vulnerableAllyId: string | null,
): MemoryCombatInfluence {
  const influence = memories.reduce<MemoryCombatInfluence>((result, memory) => {
    const strength = clampPercentage(memory.weight) / 100;
    if (memory.type === "ALLY_DIED") {
      result.fear += strength * 0.62;
      result.retreat += strength * 0.5;
    } else if (memory.type === "CRITICAL_INJURY") {
      result.fear += strength * 0.52;
      result.retreat += strength * 0.58;
    } else if (
      vulnerableAllyId &&
      memory.targetHeroId === vulnerableAllyId &&
      (memory.type === "SAVED_ALLY" || memory.type === "WAS_SAVED")
    ) {
      result.protect += strength * (memory.type === "SAVED_ALLY" ? 0.7 : 0.48);
    } else if (memory.type === "WON_BOSS") {
      result.fear -= strength * 0.32;
      result.retreat -= strength * 0.25;
    }
    return result;
  }, { fear: 0, protect: 0, retreat: 0 });

  return {
    fear: Math.min(1, Math.max(0, influence.fear)),
    protect: Math.min(1, Math.max(0, influence.protect)),
    retreat: Math.min(1, Math.max(0, influence.retreat)),
  };
}
