export type HairStyle = "bald" | "bun" | "cropped" | "mohawk" | "swept";

export interface HeroAppearance {
  bodyWidth: number;
  clothingColor: string;
  hairColor: string;
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

export type OriginCategory =
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
  hiddenPotential: HiddenPotential;
  heroClass: HeroClass;
  id: string;
  level: number;
  movement: HeroMovement;
  name: string;
  needs: HeroNeeds;
  origin: HeroOrigin;
  personality: Personality;
  rank: number;
  relationships: Record<string, RelationshipProfile>;
  reputation: HeroReputation;
  skills: HeroSkills;
  socialRole: SocialRole;
  traits: string[];
  training: HeroTraining;
}
