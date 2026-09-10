import type { CombatantSnapshot } from "../combat/Combat";
import type { FallenHeroRecord, Hero, HeroLossMemory } from "./Hero";
import { getRelationshipLabel } from "./RelationshipSystem";

export interface LegacyReaction {
  fallenHeroId: string;
  moraleLoss: number;
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
      if (!profile) {
        return [];
      }
      const relationship = getRelationshipLabel(profile);
      if (relationship !== "Friend" && relationship !== "Trusted Friend" && relationship !== "Companion") {
        return [];
      }
      const moraleLoss = relationship === "Trusted Friend" ? 18 : relationship === "Friend" ? 12 : 8;
      survivor.needs.morale = Math.max(0, survivor.needs.morale - moraleLoss);
      const memory: HeroLossMemory = {
        day,
        fallenHeroId: fallen.heroId,
        fallenHeroName: fallen.name,
        relationship,
        summary: `${fallen.name} died during an expedition.`,
      };
      survivor.lossMemories.unshift(memory);
      survivor.lossMemories.splice(MAX_LOSS_MEMORIES);
      return [{
        fallenHeroId: fallen.heroId,
        moraleLoss,
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
