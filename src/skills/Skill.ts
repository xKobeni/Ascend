import type { HeroAttributes } from "../heroes/Hero";

export type SkillType = "active" | "passive" | "reaction" | "utility";
export type SkillCategory = "weapon" | "combat" | "survival" | "support" | "mental" | "unique";
export type SkillRarity = "common" | "uncommon" | "rare" | "elite" | "unique" | "legendary";
export type SkillSource = "innate" | "training" | "combat" | "expedition" | "mentor" | "awakening";
export type SkillAffinity = "defense" | "magic" | "spear" | "support" | "survival" | "sword";

export type SkillRequirement =
  | { attribute: keyof HeroAttributes; kind: "attribute"; minimum: number }
  | { definitionId: string; kind: "skill"; level: number }
  | { kind: "trait"; trait: string };

export interface SkillDefinition {
  affinity: SkillAffinity;
  category: SkillCategory;
  description: string;
  evolutions?: readonly string[];
  id: string;
  legacySkill?: "defense" | "leadership" | "medicine" | "spear" | "sword";
  maxLevel: number;
  name: string;
  prerequisites?: readonly SkillRequirement[];
  rarity: SkillRarity;
  type: SkillType;
}

export interface HeroSkill {
  definitionId: string;
  discoveryReason: string;
  level: number;
  mastery: boolean;
  proficiency: number;
  source: SkillSource;
  xp: number;
}

export interface SkillLoadout {
  active: string[];
  passive: string[];
}

export interface SkillDiscoveryRecord {
  definitionId: string;
  reason: string;
  source: SkillSource;
}

export interface HeroSkillForge {
  affinities: Record<SkillAffinity, number>;
  discoveryLog: SkillDiscoveryRecord[];
  hiddenPotentialSlots: number;
  known: Record<string, HeroSkill>;
  loadout: SkillLoadout;
  usageCounts: Record<string, number>;
}

export interface SkillUsageEvent {
  baseXp: number;
  definitionId: string;
  difficulty: number;
  heroId: string;
  reason: string;
  source: "combat" | "expedition" | "training";
  successful: boolean;
}

export interface SkillProgressionResult {
  definitionId: string;
  gainedXp: number;
  levelAfter: number;
  levelBefore: number;
  mastered: boolean;
  proficiencyAfter: number;
}
