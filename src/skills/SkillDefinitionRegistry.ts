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

  // ── Survival / Exploration ──────────────────────────────────────────────

  { affinity: "survival", category: "survival", description: "Identify edible plants, medicinal roots, and useful natural resources in the wild.", id: "foraging", maxLevel: 10, name: "Foraging", rarity: "common", type: "utility" },
  { affinity: "survival", category: "survival", description: "Notice details others miss — footprints, traps, hidden passages, and subtle threats.", id: "observation", maxLevel: 10, name: "Observation", rarity: "common", type: "passive", evolutions: ["ambush"] },
  { affinity: "survival", category: "combat", description: "Strike from concealment with devastating timing against an unsuspecting target.", id: "ambush", maxLevel: 10, name: "Ambush", prerequisites: [{ definitionId: "observation", kind: "skill", level: 2 }, { attribute: "agility", kind: "attribute", minimum: 3 }], rarity: "uncommon", type: "active" },
  { affinity: "survival", category: "survival", description: "Sense the safest and fastest routes through treacherous or unfamiliar terrain.", id: "pathfinding", maxLevel: 10, name: "Pathfinding", prerequisites: [{ definitionId: "tracking", kind: "skill", level: 2 }], rarity: "uncommon", type: "utility" },

  // ── Support / Crafting ──────────────────────────────────────────────────

  { affinity: "support", category: "support", description: "Shape raw materials into functional tools, repairs, and improvised equipment.", id: "crafting", maxLevel: 10, name: "Crafting", rarity: "common", type: "passive", evolutions: ["tinker"] },
  { affinity: "support", category: "support", description: "Improvise complex devices and modifications from limited resources under pressure.", id: "tinker", maxLevel: 10, name: "Tinker", prerequisites: [{ definitionId: "crafting", kind: "skill", level: 2 }, { attribute: "intelligence", kind: "attribute", minimum: 3 }], rarity: "uncommon", type: "active" },
  { affinity: "support", category: "support", description: "Read people, find common ground, and reach favorable agreements through dialogue.", id: "negotiation", maxLevel: 10, name: "Negotiation", rarity: "common", type: "passive", evolutions: ["intimidation"] },
  { affinity: "support", category: "support", description: "Project dominance and fear to coerce compliance without direct violence.", id: "intimidation", maxLevel: 10, name: "Intimidation", prerequisites: [{ definitionId: "negotiation", kind: "skill", level: 1 }, { attribute: "willpower", kind: "attribute", minimum: 3 }], rarity: "uncommon", type: "passive" },

  // ── Mental / Tactical ──────────────────────────────────────────────────

  { affinity: "defense", category: "mental", description: "Unshakable resolve that resists fear, despair, and psychological pressure.", id: "iron_will", maxLevel: 10, name: "Iron Will", prerequisites: [{ attribute: "willpower", kind: "attribute", minimum: 4 }], rarity: "uncommon", type: "passive" },
  { affinity: "support", category: "mental", description: "Analyze battlefield conditions and coordinate squad positioning for maximum effect.", id: "tactical_knowledge", maxLevel: 10, name: "Tactical Knowledge", prerequisites: [{ attribute: "intelligence", kind: "attribute", minimum: 3 }, { attribute: "leadership", kind: "attribute", minimum: 2 }], rarity: "uncommon", type: "passive" },
  { affinity: "defense", category: "combat", description: "A surge of combat instinct that triggers when death seems near, granting a brief power boost.", id: "adrenaline_rush", maxLevel: 10, name: "Adrenaline Rush", prerequisites: [{ attribute: "endurance", kind: "attribute", minimum: 4 }, { kind: "trait", trait: "Reckless" }], rarity: "rare", type: "reaction" },
  { affinity: "defense", category: "combat", description: "Push past physical limits to keep fighting when the body should have collapsed.", id: "second_wind", maxLevel: 10, name: "Second Wind", prerequisites: [{ attribute: "endurance", kind: "attribute", minimum: 5 }, { attribute: "willpower", kind: "attribute", minimum: 3 }], rarity: "rare", type: "reaction" },

  // ── Magic ──────────────────────────────────────────────────────────────

  { affinity: "magic", category: "unique", description: "An innate sensitivity to magical energies that permeate the environment and living beings.", id: "mana_sense", maxLevel: 10, name: "Mana Sense", rarity: "common", type: "passive", evolutions: ["arcane_bolt", "mana_shield"] },
  { affinity: "magic", category: "combat", description: "Channel concentrated mana into a bolt of raw arcane force directed at a target.", id: "arcane_bolt", maxLevel: 10, name: "Arcane Bolt", prerequisites: [{ definitionId: "mana_sense", kind: "skill", level: 1 }, { attribute: "intelligence", kind: "attribute", minimum: 3 }], rarity: "uncommon", type: "active", evolutions: ["spellweaving"] },
  { affinity: "magic", category: "combat", description: "Manifest a barrier of pure mana that absorbs incoming damage at the cost of mental focus.", id: "mana_shield", maxLevel: 10, name: "Mana Shield", prerequisites: [{ definitionId: "mana_sense", kind: "skill", level: 2 }, { attribute: "willpower", kind: "attribute", minimum: 4 }], rarity: "uncommon", type: "reaction" },
  { affinity: "magic", category: "unique", description: "Attune to a specific element, amplifying its power and granting resistance to its opposite.", id: "elemental_attunement", maxLevel: 10, name: "Elemental Attunement", prerequisites: [{ definitionId: "mana_sense", kind: "skill", level: 2 }, { attribute: "intelligence", kind: "attribute", minimum: 4 }], rarity: "rare", type: "passive" },
  { affinity: "magic", category: "unique", description: "Weave multiple magical threads into complex, evolving spell patterns of escalating power.", id: "spellweaving", maxLevel: 10, name: "Spellweaving", prerequisites: [{ definitionId: "arcane_bolt", kind: "skill", level: 3 }, { attribute: "intelligence", kind: "attribute", minimum: 5 }], rarity: "rare", type: "passive" },

  // ── Weapon Expansion ───────────────────────────────────────────────────

  { affinity: "defense", category: "weapon", description: "Expertise with shields — block angles, bash timing, and defensive wall formation.", id: "shield_mastery", maxLevel: 10, name: "Shield Mastery", prerequisites: [{ attribute: "endurance", kind: "attribute", minimum: 3 }], rarity: "common", type: "passive" },
  { affinity: "sword", category: "combat", description: "Counter-attack immediately after a successful parry, turning defense into offense.", id: "riposte", maxLevel: 10, name: "Riposte", prerequisites: [{ definitionId: "parry", kind: "skill", level: 2 }, { attribute: "agility", kind: "attribute", minimum: 3 }], rarity: "uncommon", type: "active" },
  { affinity: "sword", category: "combat", description: "A wide arcing slash that can strike multiple adjacent enemies at once.", id: "cleave", maxLevel: 10, name: "Cleave", prerequisites: [{ definitionId: "sword_mastery", kind: "skill", level: 3 }, { attribute: "strength", kind: "attribute", minimum: 4 }], rarity: "uncommon", type: "active" },
  { affinity: "spear", category: "combat", description: "A rapid sequence of thrusts and repositions to harass multiple targets at reach.", id: "skirmish", maxLevel: 10, name: "Skirmish", prerequisites: [{ definitionId: "lunge", kind: "skill", level: 2 }, { attribute: "agility", kind: "attribute", minimum: 3 }], rarity: "uncommon", type: "active" },
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
