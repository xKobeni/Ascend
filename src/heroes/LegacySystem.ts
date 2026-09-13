import type { CombatantSnapshot } from "../combat/Combat";
import type { FallenHeroRecord, Hero, HeroLossMemory } from "./Hero";
import { getRelationshipLabel } from "./RelationshipSystem";

export interface LegacyReaction {
  fallenHeroId: string;
  moraleLoss: number;
  stressGain: number;
  survivorId: string;
  survivorName: string;
}

const MAX_LOSS_MEMORIES = 12;

export class LegacySystem {
  private readonly fallen: FallenHeroRecord[] = [];

  recordExpedition(
    hero: Hero,
    combatant: Readonly<CombatantSnapshot> | undefined,
    successful: boolean,
  ): void {
    hero.career.expeditions += 1;
    hero.career.victories += Number(successful);
    hero.career.kills += combatant?.kills ?? 0;
  }

  memorialize(
    hero: Readonly<Hero>,
    day: number,
    causeOfDeath: string,
    finalSquadName: string,
  ): Readonly<FallenHeroRecord> {
    const record: FallenHeroRecord = {
      age: hero.age,
      causeOfDeath,
      daysAlive: Math.max(1, day - hero.career.joinedDay + 1),
      diedDay: day,
      expeditions: hero.career.expeditions,
      finalSquadName,
      heroId: hero.id,
      heroClass: hero.heroClass,
      joinedDay: hero.career.joinedDay,
      kills: hero.career.kills,
      level: hero.level,
      name: hero.name,
      occupation: hero.origin.occupation,
      rank: hero.rank,
      victories: hero.career.victories,
    };
    this.fallen.unshift(record);
    return record;
  }

  applyRelationshipReactions(
    survivors: readonly Hero[],
    fallenHeroes: readonly Readonly<FallenHeroRecord>[],
    day: number,
  ): readonly LegacyReaction[] {
    return survivors.flatMap((survivor) => fallenHeroes.flatMap((fallen) => {
      const profile = survivor.relationships[fallen.heroId];
      const relationship = profile ? getRelationshipLabel(profile) : "Neutral";

      let moraleLoss = 0;
      let stressGain = 0;

      if (relationship === "Trusted Friend") {
        moraleLoss = 18;
        stressGain = 30;
      } else if (relationship === "Friend") {
        moraleLoss = 12;
        stressGain = 22;
      } else if (relationship === "Companion") {
        moraleLoss = 8;
        stressGain = 15;
      } else if (relationship === "Neutral") {
        moraleLoss = 4;
        stressGain = 10;
      } else {
        // Enemy or Rival — minimal grief, but still stressful to witness death
        stressGain = 6;
      }

      if (moraleLoss > 0) {
        survivor.needs.morale = Math.max(0, survivor.needs.morale - moraleLoss);
      }
      if (stressGain > 0) {
        survivor.needs.stress = Math.min(100, survivor.needs.stress + stressGain);
      }

      if (relationship !== "Neutral" && relationship !== "Enemy" && relationship !== "Rival" && relationship !== "Distrust") {
        const memory: HeroLossMemory = {
          day,
          fallenHeroId: fallen.heroId,
          fallenHeroName: fallen.name,
          relationship: relationship as "Companion" | "Friend" | "Trusted Friend",
          summary: `${fallen.name} died during an expedition.`,
        };
        survivor.lossMemories.unshift(memory);
        survivor.lossMemories.splice(MAX_LOSS_MEMORIES);
      }

      return [{
        fallenHeroId: fallen.heroId,
        moraleLoss,
        stressGain,
        survivorId: survivor.id,
        survivorName: survivor.name,
      }];
    }));
  }

  getFallen(): readonly Readonly<FallenHeroRecord>[] {
    return this.fallen;
  }

  getByHeroId(heroId: string): Readonly<FallenHeroRecord> | undefined {
    return this.fallen.find((record) => record.heroId === heroId);
  }
}
