import type { HeroSkillForge } from "../skills/Skill";
import type { HeroMemory } from "../memories/HeroMemory";

export type HairStyle =
  | "bald"
  | "braided"
  | "bun"
  | "cropped"
  | "curly"
  | "long"
  | "mohawk"
  | "ponytail"
  | "short"
  | "slicked"
  | "swept"
  | "wild";

export type HairLength = "short" | "medium" | "long";

export type HeroGender = "female" | "male";

export interface HeroAppearance {
  bodyWidth: number;
  clothingColor: string;
  gender: HeroGender;
  hairColor: string;
  hairLength: HairLength;
  hairStyle: HairStyle;
  height: number;
  skinTone: string;
}

export interface HeroAttributes {
  agility: number;
  endurance: number;
  intelligence: number;
  leadership: number;
  strength: number;
  willpower: number;
}

export interface HeroSkills {
  defense: number;
  leadership: number;
  medicine: number;
  spear: number;
  sword: number;
}

export interface Personality {
  aggression: number;
  ambition: number;
  bravery: number;
  discipline: number;
  empathy: number;
  loyalty: number;
}

export type HeroTraitSource = "Earned" | "Generated";

export interface HeroTraitRecord {
  acquiredDay: number;
  id: string;
  name: string;
  reason: string;
  source: HeroTraitSource;
}

export type OriginCategory =
  | "Arcane"
  | "Civilian"
  | "Leadership"
  | "Military"
  | "Rare"
  | "Skilled"
  | "Underworld"
  | "Wilderness";

export type OriginRarity = "Common" | "Rare" | "Specialized";

export interface HeroOrigin {
  aptitudes: string[];
  category: OriginCategory;
  occupation: string;
  rarity: OriginRarity;
}

export type HeroClass = "Unclassified";
export type SocialRole = "Resident";

export interface HeroReputation {
  renown: number;
  title: string | null;
}

export type RelationshipEventType = "argument" | "conversation" | "help" | "training";

export interface RelationshipHistoryEntry {
  day: number;
  minuteOfDay: number;
  summary: string;
  type: RelationshipEventType;
}

export interface RelationshipMetrics {
  affinity: number;
  fear: number;
  jealousy: number;
  respect: number;
  rivalry: number;
  trust: number;
}

export interface RelationshipProfile {
  history: RelationshipHistoryEntry[];
  metrics: RelationshipMetrics;
}

export type HiddenPotential = Record<keyof HeroAttributes, number>;

export interface HeroNeeds {
  fatigue: number;
  health: number;
  hunger: number;
  morale: number;
  social: number;
  stress: number;
}

export type InjuryType =
  | "Bleed"
  | "Broken Arm"
  | "Burn"
  | "Burns (Severe)"
  | "Concussion"
  | "Concussion (Severe)"
  | "Fracture"
  | "Internal Bleeding"
  | "Minor Wound"
  | "Poison"
  | "Sprain";
export type InjurySeverity = "Minor" | "Permanent" | "Serious";
export type InjurySource = "Expedition" | "Training";

export interface HeroInjury {
  acquiredDay: number;
  id: string;
  permanent: boolean;
  remainingMinutes: number | null;
  severity: InjurySeverity;
  source: InjurySource;
  totalRecoveryMinutes: number | null;
  treated: boolean;
  type: InjuryType;
}

export interface HeroRecovery {
  lastOutcome: string | null;
}

export interface HeroCareer {
  expeditions: number;
  joinedDay: number;
  kills: number;
  victories: number;
}

export interface HeroLossMemory {
  day: number;
  fallenHeroId: string;
  fallenHeroName: string;
  relationship: "Companion" | "Friend" | "Trusted Friend";
  summary: string;
}

export interface FallenHeroRecord {
  age: number;
  causeOfDeath: string;
  daysAlive: number;
  diedDay: number;
  expeditions: number;
  finalSquadName: string;
  heroId: string;
  joinedDay: number;
  kills: number;
  level: number;
  name: string;
  occupation: string;
  rank: number;
  victories: number;
}

export type TrainingType = "Defense Training" | "Strength Training" | "Weapon Training";

export interface TrainingAssignment {
  progress: number;
  type: TrainingType;
}

export interface HeroTraining {
  active: TrainingAssignment | null;
  injuryCheckMinutes: number;
  lastOutcome: string | null;
  queue: TrainingType[];
}

export type HeroActivity =
  | "Eating"
  | "Idle"
  | "Resting"
  | "Socializing"
  | "Training"
  | "Walking";

export interface HeroMovement {
  activity: HeroActivity;
  decisionReason: string | null;
  decisionSource: "Need" | "Schedule" | "Training";
  destinationId: string | null;
  destinationLabel: string | null;
  facingRadians: number;
  position: {
    x: number;
    z: number;
  };
  targetActivity: Exclude<HeroActivity, "Walking">;
}

export interface Hero {
  age: number;
  appearance: HeroAppearance;
  attributes: HeroAttributes;
  career: HeroCareer;
  hiddenPotential: HiddenPotential;
  heroClass: HeroClass;
  id: string;
  injuries: HeroInjury[];
  level: number;
  lossMemories: HeroLossMemory[];
  memories: HeroMemory[];
  movement: HeroMovement;
  name: string;
  needs: HeroNeeds;
  origin: HeroOrigin;
  personality: Personality;
  rank: number;
  relationships: Record<string, RelationshipProfile>;
  reputation: HeroReputation;
  recovery: HeroRecovery;
  skillForge: HeroSkillForge;
  skills: HeroSkills;
  socialRole: SocialRole;
  traitHistory: HeroTraitRecord[];
  traits: string[];
  training: HeroTraining;
}
