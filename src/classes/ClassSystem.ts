import type { EquipmentModifiers } from "../equipment/EquipmentSystem";
import type { BasicHeroClass, Hero, HeroClass } from "../heroes/Hero";

export interface ClassModifiers {
  attack: number;
  defense: number;
  healing: number;
  maxHp: number;
  range: number;
  speed: number;
}

export interface ClassDefinition {
  bonuses: string;
  description: string;
  id: BasicHeroClass;
}

export interface ClassRequirementResult {
  detail: string;
  id: string;
  label: string;
  met: boolean;
}

export interface ClassOption {
  definition: Readonly<ClassDefinition>;
  requirements: readonly Readonly<ClassRequirementResult>[];
  unlocked: boolean;
}

const NONE: Readonly<ClassModifiers> = Object.freeze({
  attack: 0, defense: 0, healing: 0, maxHp: 0, range: 0, speed: 0,
});

export const CLASS_DEFINITIONS: readonly Readonly<ClassDefinition>[] = Object.freeze([
  Object.freeze({ id: "Fighter", description: "A disciplined close-range combatant built through strength and weapon practice.", bonuses: "+2 Attack · +5 HP" }),
  Object.freeze({ id: "Guardian", description: "A durable protector who combines endurance, defense training, and shield discipline.", bonuses: "+3 Defense · +12 HP" }),
  Object.freeze({ id: "Archer", description: "A mobile ranged specialist shaped by agility, field experience, and a ranged weapon.", bonuses: "+2 Attack · +1.5 Range" }),
  Object.freeze({ id: "Medic", description: "A calm support specialist trained to keep allies alive under pressure.", bonuses: "+3 Healing · +0.5 Range" }),
  Object.freeze({ id: "Scout", description: "An observant pathfinder who reads danger and moves ahead of the squad.", bonuses: "+0.25 Speed · +0.5 Range" }),
]);

const MODIFIERS: Readonly<Record<HeroClass, Readonly<ClassModifiers>>> = Object.freeze({
  Archer: Object.freeze({ ...NONE, attack: 2, range: 1.5 }),
  Fighter: Object.freeze({ ...NONE, attack: 2, maxHp: 5 }),
  Guardian: Object.freeze({ ...NONE, defense: 3, maxHp: 12 }),
  Medic: Object.freeze({ ...NONE, healing: 3, range: 0.5 }),
  Scout: Object.freeze({ ...NONE, range: 0.5, speed: 0.25 }),
  Unclassified: NONE,
});

export class ClassSystem {
  evaluate(hero: Readonly<Hero>, equipment: Readonly<EquipmentModifiers>): readonly Readonly<ClassOption>[] {
    return CLASS_DEFINITIONS.map((definition) => {
      const requirements = this.getRequirements(definition.id, hero, equipment);
      return Object.freeze({
        definition,
        requirements: Object.freeze(requirements),
        unlocked: requirements.every((requirement) => requirement.met),
      });
    });
  }

  select(hero: Hero, target: BasicHeroClass, equipment: Readonly<EquipmentModifiers>): boolean {
    if (hero.heroClass === target) return false;
    const option = this.evaluate(hero, equipment).find((candidate) => candidate.definition.id === target);
    if (!option?.unlocked) return false;
    hero.heroClass = target;
    return true;
  }

  getModifiers(heroClass: HeroClass): Readonly<ClassModifiers> {
    return MODIFIERS[heroClass];
  }

  private getRequirements(
    heroClass: BasicHeroClass,
    hero: Readonly<Hero>,
    equipment: Readonly<EquipmentModifiers>,
  ): ClassRequirementResult[] {
    const knownLevel = (id: string): number => hero.skillForge.known[id]?.level ?? 0;
    const origin = hero.origin.category;
    const evidence = (id: string, label: string, met: boolean, detail: string): ClassRequirementResult => ({ id, label, met, detail });
    if (heroClass === "Fighter") {
      const weapon = Math.max(hero.skills.sword, hero.skills.spear);
      const weaponTraining = hero.training.lastOutcome?.includes("Weapon") === true;
      const fieldEvidence = hero.career.kills >= 1 || origin === "Military" || weaponTraining;
      const fieldDetail = hero.career.kills >= 1
        ? `${hero.career.kills} expedition kills`
        : origin === "Military"
          ? `${hero.origin.occupation} origin`
          : weaponTraining
            ? "Weapon training completed"
            : "No martial field evidence";
      return [
        evidence("strength", "Strength 5", hero.attributes.strength >= 5, `Current ${hero.attributes.strength}`),
        evidence("weapon", "Sword or Spear 3", weapon >= 3, `Current ${weapon}`),
        evidence("field", "Martial experience", fieldEvidence, fieldDetail),
      ];
    }
    if (heroClass === "Guardian") {
      const shieldEvidence = equipment.offHandType === "Shield" || knownLevel("shield_mastery") >= 1;
      return [
        evidence("endurance", "Endurance 5", hero.attributes.endurance >= 5, `Current ${hero.attributes.endurance}`),
        evidence("defense", "Defense 3", hero.skills.defense >= 3, `Current ${hero.skills.defense}`),
        evidence("shield", "Shield discipline", shieldEvidence, equipment.offHandType === "Shield" ? "Shield equipped" : `Shield Mastery ${knownLevel("shield_mastery")}`),
      ];
    }
    if (heroClass === "Archer") {
      const rangedWeapon = equipment.mainHandType === "Bow" || equipment.mainHandType === "Crossbow";
      const scoutingLevel = knownLevel("scouting");
      const fieldEvidence = hero.career.expeditions >= 1 || origin === "Wilderness" || scoutingLevel >= 1;
      const fieldDetail = hero.career.expeditions >= 1
        ? `${hero.career.expeditions} expeditions`
        : origin === "Wilderness"
          ? `${hero.origin.occupation} origin`
          : scoutingLevel >= 1
            ? `Scouting ${scoutingLevel}`
            : "No expedition or scouting evidence";
      return [
        evidence("agility", "Agility 5", hero.attributes.agility >= 5, `Current ${hero.attributes.agility}`),
        evidence("ranged", "Ranged weapon discipline", rangedWeapon, equipment.mainHandType ? `${equipment.mainHandType} equipped` : "No ranged weapon equipped"),
        evidence("field", "Field awareness", fieldEvidence, fieldDetail),
      ];
    }
    if (heroClass === "Medic") {
      const care = hero.personality.empathy >= 0.5 || knownLevel("field_treatment") >= 1;
      return [
        evidence("intelligence", "Intelligence 4", hero.attributes.intelligence >= 4, `Current ${hero.attributes.intelligence}`),
        evidence("medicine", "Medicine 2", hero.skills.medicine >= 2, `Current ${hero.skills.medicine}`),
        evidence("care", "Care under pressure", care, knownLevel("field_treatment") >= 1 ? "Field Treatment known" : `Empathy ${Math.round(hero.personality.empathy * 100)}%`),
      ];
    }
    const pathfinding = knownLevel("tracking") >= 1 || knownLevel("scouting") >= 1 || origin === "Wilderness" || origin === "Underworld";
    return [
      evidence("agility", "Agility 5", hero.attributes.agility >= 5, `Current ${hero.attributes.agility}`),
      evidence("discipline", "Discipline 40%", hero.personality.discipline >= 0.4, `Current ${Math.round(hero.personality.discipline * 100)}%`),
      evidence("pathfinding", "Pathfinding evidence", pathfinding, pathfinding ? `${hero.origin.occupation} experience or known field skill` : "No tracking or scouting evidence"),
    ];
  }
}

const defaultClassSystem = new ClassSystem();

export function getClassModifiers(heroClass: HeroClass): Readonly<ClassModifiers> {
  return defaultClassSystem.getModifiers(heroClass);
}
