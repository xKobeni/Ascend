import type { SkillDefinition } from "./Skill";

const DEFINITIONS: readonly SkillDefinition[] = [
  { affinity: "sword", category: "weapon", description: "Fundamental control and confidence with swords.", id: "sword_mastery", legacySkill: "sword", maxLevel: 10, name: "Sword Mastery", rarity: "common", type: "passive", evolutions: ["parry"] },
  { affinity: "spear", category: "weapon", description: "Reach, timing, and formation use with spears.", id: "spear_mastery", legacySkill: "spear", maxLevel: 10, name: "Spear Mastery", rarity: "common", type: "passive", evolutions: ["lunge"] },
  { affinity: "spear", category: "combat", description: "A reliable forward spear attack.", id: "basic_thrust", maxLevel: 10, name: "Basic Thrust", prerequisites: [{ definitionId: "spear_mastery", kind: "skill", level: 1 }], rarity: "common", type: "active", evolutions: ["lunge"] },
  { affinity: "spear", category: "combat", description: "Close distance with a committed piercing attack.", id: "lunge", maxLevel: 10, name: "Lunge", prerequisites: [{ definitionId: "spear_mastery", kind: "skill", level: 3 }], rarity: "uncommon", type: "active" },
  { affinity: "defense", category: "combat", description: "Brace under pressure and reduce incoming force.", id: "brace", legacySkill: "defense", maxLevel: 10, name: "Brace", prerequisites: [{ attribute: "endurance", kind: "attribute", minimum: 3 }], rarity: "common", type: "reaction" },
  { affinity: "sword", category: "combat", description: "Turn weapon control into a timed defensive response.", id: "parry", maxLevel: 10, name: "Parry", prerequisites: [{ definitionId: "sword_mastery", kind: "skill", level: 2 }], rarity: "uncommon", type: "reaction" },
  { affinity: "defense", category: "combat", description: "Move into danger to shield a threatened ally.", id: "interpose", maxLevel: 10, name: "Interpose", prerequisites: [{ kind: "trait", trait: "Protective" }], rarity: "rare", type: "active" },
  { affinity: "support", category: "support", description: "Practical medical knowledge and treatment judgment.", id: "medicine", legacySkill: "medicine", maxLevel: 10, name: "Medicine", rarity: "common", type: "passive", evolutions: ["field_treatment"] },
  { affinity: "support", category: "support", description: "Stabilize and restore an ally during combat.", id: "field_treatment", maxLevel: 10, name: "Field Treatment", prerequisites: [{ definitionId: "medicine", kind: "skill", level: 1 }], rarity: "uncommon", type: "active" },
  { affinity: "survival", category: "survival", description: "Read trails and signs left by creatures or people.", id: "tracking", maxLevel: 10, name: "Tracking", rarity: "common", type: "utility" },
  { affinity: "survival", category: "survival", description: "Recognize threats and useful paths before engagement.", id: "scouting", maxLevel: 10, name: "Scouting", rarity: "common", type: "utility" },
  { affinity: "defense", category: "mental", description: "Remain functional while fear is rising.", id: "fear_resistance", maxLevel: 10, name: "Fear Resistance", rarity: "uncommon", type: "passive" },
  { affinity: "defense", category: "mental", description: "Sustain deliberate action under combat pressure.", id: "battle_focus", maxLevel: 10, name: "Battle Focus", rarity: "uncommon", type: "passive" },
  { affinity: "defense", category: "mental", description: "React automatically when a vulnerable ally is threatened.", id: "protective_instinct", maxLevel: 10, name: "Protective Instinct", prerequisites: [{ kind: "trait", trait: "Protective" }], rarity: "rare", type: "reaction" },
  { affinity: "support", category: "support", description: "Guide allies through clear decisions and example.", id: "leadership", legacySkill: "leadership", maxLevel: 10, name: "Leadership", rarity: "common", type: "passive" },
];

const BY_ID = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));

export class SkillDefinitionRegistry {
  getAll(): readonly Readonly<SkillDefinition>[] {
    return DEFINITIONS;
  }

  get(id: string): Readonly<SkillDefinition> | undefined {
    return BY_ID.get(id);
  }

  require(id: string): Readonly<SkillDefinition> {
    const definition = this.get(id);
    if (!definition) {
      throw new Error(`Unknown skill definition: ${id}`);
    }
    return definition;
  }
}

export const skillDefinitionRegistry = new SkillDefinitionRegistry();
