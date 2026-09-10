import type { Hero, HeroTraitRecord, Personality } from "./Hero";

interface TraitRule {
  applies: (hero: Readonly<Hero>) => boolean;
  drift: Partial<Personality>;
  id: string;
  name: string;
  reason: (hero: Readonly<Hero>) => string;
}

const TRAIT_RULES: readonly TraitRule[] = [
  {
    applies: (hero) => hero.career.expeditions >= 5 && (
      hero.career.kills >= 5 || hero.memories.some((memory) => memory.type === "CRITICAL_INJURY")
    ),
    drift: { bravery: 0.04, discipline: 0.02 },
    id: "battle-hardened",
    name: "Battle-Hardened",
    reason: (hero) => `Earned after surviving ${hero.career.expeditions} expeditions under sustained combat pressure.`,
  },
  {
    applies: (hero) => hero.career.expeditions >= 10,
    drift: { bravery: 0.03, discipline: 0.03 },
    id: "veteran",
    name: "Veteran",
    reason: (hero) => `Earned after surviving ${hero.career.expeditions} expeditions.`,
  },
  {
    applies: (hero) => hero.memories.some((memory) => memory.type === "ALLY_DIED"),
    drift: { bravery: -0.03, empathy: 0.04, loyalty: 0.02 },
    id: "survivors-guilt",
    name: "Survivor's Guilt",
    reason: (hero) => {
      const memory = hero.memories.find((entry) => entry.type === "ALLY_DIED");
      return memory
        ? `Earned after ${memory.summary.charAt(0).toLowerCase()}${memory.summary.slice(1)}`
        : "Earned after surviving the loss of an ally.";
    },
  },
  {
    applies: (hero) => hero.memories.some((memory) => (
      memory.type === "SAVED_ALLY" && memory.lastReinforcedDay > memory.createdDay
    )),
    drift: { aggression: -0.02, empathy: 0.03, loyalty: 0.04 },
    id: "protective",
    name: "Protective",
    reason: () => "Earned after repeatedly protecting or treating the same ally in combat.",
  },
  {
    applies: (hero) => hero.career.kills >= 10 && hero.personality.empathy <= 0.35,
    drift: { aggression: 0.04, empathy: -0.05, loyalty: -0.01 },
    id: "ruthless",
    name: "Ruthless",
    reason: (hero) => `Earned after ${hero.career.kills} expedition kills while showing little empathy.`,
  },
];

const clampPersonality = (value: number): number => Math.min(0.98, Math.max(0.04, value));

export class TraitEvolutionSystem {
  evaluate(hero: Hero, day: number): readonly HeroTraitRecord[] {
    const awarded: HeroTraitRecord[] = [];
    TRAIT_RULES.forEach((rule) => {
      if (hero.traits.includes(rule.name) || !rule.applies(hero)) {
        return;
      }
      const record: HeroTraitRecord = {
        acquiredDay: Math.max(1, Math.floor(day)),
        id: rule.id,
        name: rule.name,
        reason: rule.reason(hero),
        source: "Earned",
      };
      hero.traits.push(rule.name);
      hero.traitHistory.push(record);
      this.applyDrift(hero, rule.drift);
      awarded.push(record);
    });
    return awarded;
  }

  private applyDrift(hero: Hero, drift: Readonly<Partial<Personality>>): void {
    (Object.keys(drift) as Array<keyof Personality>).forEach((key) => {
      hero.personality[key] = clampPersonality(hero.personality[key] + (drift[key] ?? 0));
    });
  }
}
