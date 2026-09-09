import type { Hero } from "../heroes/Hero";
import type {
  FormationPosition,
  Squad,
  SquadEvaluation,
  SquadRole,
} from "./Squad";

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

  setFormation(heroId: string, formation: FormationPosition): boolean {
    const member = this.squad.members.find((candidate) => candidate.heroId === heroId);
    if (!member) {
      return false;
    }
    member.formation = formation;
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

  evaluate(heroes: readonly Readonly<Hero>[]): SquadEvaluation {
    const members = this.squad.members
      .map(({ heroId }) => heroes.find((hero) => hero.id === heroId))
      .filter((hero): hero is Readonly<Hero> => hero !== undefined);
    if (members.length === 0) {
      return { averageLevel: 0, combatPower: 0, defense: 0, healing: 0, isComplete: false };
    }

    const totals = members.reduce(
      (result, hero) => {
        result.level += hero.level;
        result.combatPower +=
          hero.attributes.strength * 4 +
          hero.attributes.agility * 2 +
          Math.max(hero.skills.sword, hero.skills.spear) * 5 +
          hero.level * 10;
        result.healing += hero.skills.medicine * 10 + hero.attributes.intelligence * 2;
        result.defense += hero.skills.defense * 8 + hero.attributes.endurance * 3;
        return result;
      },
      { combatPower: 0, defense: 0, healing: 0, level: 0 },
    );

    return {
      averageLevel: totals.level / members.length,
      combatPower: Math.round(totals.combatPower),
      defense: Math.round(totals.defense),
      healing: Math.round(totals.healing),
      isComplete: members.length === SQUAD_SIZE,
    };
  }
}
