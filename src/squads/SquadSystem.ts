import type { Hero } from "../heroes/Hero";
import type {
  FormationPosition,
  Squad,
  SquadChemistry,
  SquadEvaluation,
  SquadRole,
} from "./Squad";
import { getInjuryModifiers, hasRecoveringInjury } from "../heroes/InjurySystem";
import type { EquipmentModifiers } from "../equipment/EquipmentSystem";

export const SQUAD_SIZE = 3;

const DEFAULT_FORMATIONS: readonly FormationPosition[] = ["Front", "Middle", "Back"];
const DEFAULT_ROLES: readonly SquadRole[] = ["Vanguard", "Damage", "Support"];

export class SquadSystem {
  private readonly squad: Squad = {
    doctrine: "Balanced",
    id: crypto.randomUUID(),
    members: [],
    name: "Squad Alpha",
  };

  getSquad(): Readonly<Squad> {
    return this.squad;
  }

  rename(name: string): void {
    const normalized = name.trim().replace(/\s+/g, " ").slice(0, 28);
    if (normalized) {
      this.squad.name = normalized;
    }
  }

  addHero(heroId: string, heroes: readonly Readonly<Hero>[]): boolean {
    if (
      this.squad.members.length >= SQUAD_SIZE ||
      this.squad.members.some((member) => member.heroId === heroId) ||
      !heroes.some((hero) => hero.id === heroId)
    ) {
      return false;
    }

    const slot = this.squad.members.length;
    const formation = DEFAULT_FORMATIONS[slot];
    const role = DEFAULT_ROLES[slot];
    if (!formation || !role) {
      return false;
    }
    this.squad.members.push({ formation, heroId, role });
    return true;
  }

  removeHero(heroId: string): boolean {
    const index = this.squad.members.findIndex((member) => member.heroId === heroId);
    if (index < 0) {
      return false;
    }
    this.squad.members.splice(index, 1);
    return true;
  }

  removeMissingHeroes(heroes: readonly Readonly<Hero>[]): readonly string[] {
    const activeIds = new Set(heroes.map((hero) => hero.id));
    const removed = this.squad.members
      .filter((member) => !activeIds.has(member.heroId))
      .map((member) => member.heroId);
    if (removed.length > 0) {
      this.squad.members.splice(
        0,
        this.squad.members.length,
        ...this.squad.members.filter((member) => activeIds.has(member.heroId)),
      );
    }
    return removed;
  }

  setFormation(heroId: string, formation: FormationPosition): boolean {
    const member = this.squad.members.find((candidate) => candidate.heroId === heroId);
    if (!member) {
      return false;
    }
    member.formation = formation;
    return true;
  }

  moveHeroToFormation(heroId: string, formation: FormationPosition): boolean {
    const member = this.squad.members.find((candidate) => candidate.heroId === heroId);
    if (!member || member.formation === formation) {
      return member !== undefined;
    }
    const occupied = this.squad.members.find((candidate) => candidate.formation === formation);
    const previousFormation = member.formation;
    member.formation = formation;
    if (occupied) {
      occupied.formation = previousFormation;
    }
    return true;
  }

  setRole(heroId: string, role: SquadRole): boolean {
    const member = this.squad.members.find((candidate) => candidate.heroId === heroId);
    if (!member) {
      return false;
    }
    member.role = role;
    return true;
  }

  evaluate(
    heroes: readonly Readonly<Hero>[],
    getEquipment: (heroId: string) => Readonly<EquipmentModifiers> = () => ({
      damage: 0, defense: 0, mainHandType: null, offHandType: null, range: 0,
    }),
  ): SquadEvaluation {
    const members = this.squad.members
      .map(({ heroId }) => heroes.find((hero) => hero.id === heroId))
      .filter((hero): hero is Readonly<Hero> => hero !== undefined);
    if (members.length === 0) {
      return {
        averageLevel: 0,
        chemistry: "Unformed",
        cohesion: 0,
        combatPower: 0,
        defense: 0,
        healing: 0,
        isComplete: false,
        isReady: false,
        recoveringMembers: 0,
        trust: 0,
      };
    }

    const totals = members.reduce(
      (result, hero) => {
        const injury = getInjuryModifiers(hero);
        const equipment = getEquipment(hero.id);
        result.level += hero.level;
        result.combatPower += (
          hero.attributes.strength * 4 +
          hero.attributes.agility * 2 +
          Math.max(hero.skills.sword, hero.skills.spear) * 5 +
          hero.level * 10 + equipment.damage * 8 + equipment.range * 3) * injury.attack;
        result.healing += hero.skills.medicine * 10 + hero.attributes.intelligence * 2;
        result.defense += (hero.skills.defense * 8 + hero.attributes.endurance * 3 + equipment.defense * 8) * injury.defense;
        result.recoveringMembers += Number(hasRecoveringInjury(hero));
        return result;
      },
      { combatPower: 0, defense: 0, healing: 0, level: 0, recoveringMembers: 0 },
    );

    const social = this.evaluateChemistry(members);
    return {
      averageLevel: totals.level / members.length,
      chemistry: this.getChemistryLabel(social.cohesion, members.length),
      cohesion: social.cohesion,
      combatPower: Math.round(totals.combatPower),
      defense: Math.round(totals.defense),
      healing: Math.round(totals.healing),
      isComplete: members.length === SQUAD_SIZE,
      isReady: members.length === SQUAD_SIZE && totals.recoveringMembers === 0,
      recoveringMembers: totals.recoveringMembers,
      trust: social.trust,
    };
  }

  private evaluateChemistry(members: readonly Readonly<Hero>[]): { cohesion: number; trust: number } {
    if (members.length < 2) {
      return { cohesion: 0, trust: 0 };
    }
    const profiles = members.flatMap((hero) =>
      members
        .filter((other) => other.id !== hero.id)
        .map((other) => hero.relationships[other.id])
        .filter((profile) => profile !== undefined),
    );
    if (profiles.length === 0) {
      return { cohesion: 0, trust: 0 };
    }
    const totals = profiles.reduce(
      (result, profile) => {
        const { affinity, fear, jealousy, respect, trust } = profile.metrics;
        const normalizedAffinity = (affinity + 100) / 2;
        result.cohesion +=
          normalizedAffinity * 0.25 +
          trust * 0.35 +
          respect * 0.25 +
          (100 - fear) * 0.15 -
          jealousy * 0.1;
        result.trust += trust;
        return result;
      },
      { cohesion: 0, trust: 0 },
    );
    return {
      cohesion: this.clampPercentage(Math.round(totals.cohesion / profiles.length)),
      trust: this.clampPercentage(Math.round(totals.trust / profiles.length)),
    };
  }

  private getChemistryLabel(cohesion: number, memberCount: number): SquadChemistry {
    if (memberCount < 2) {
      return "Unformed";
    }
    if (cohesion >= 80) {
      return "Bound";
    }
    if (cohesion >= 65) {
      return "Cohesive";
    }
    if (cohesion >= 45) {
      return "Developing";
    }
    return "Fragile";
  }

  private clampPercentage(value: number): number {
    return Math.min(100, Math.max(0, value));
  }
}
