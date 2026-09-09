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

export type HiddenPotential = Record<keyof HeroAttributes, number>;

export interface HeroNeeds {
  fatigue: number;
  health: number;
  hunger: number;
  morale: number;
  social: number;
  stress: number;
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
  decisionSource: "Need" | "Schedule";
  destinationId: string | null;
  destinationLabel: string | null;
  facingRadians: number;
  position: {
    x: number;
    z: number;
  };
  targetActivity: Exclude<HeroActivity, "Walking">;
}

export type PreviousOccupation =
  | "Farmer"
  | "Hunter"
  | "Mechanic"
  | "Nurse"
  | "Soldier"
  | "Student"
  | "Teacher";

export interface Hero {
  age: number;
  appearance: HeroAppearance;
  attributes: HeroAttributes;
  hiddenPotential: HiddenPotential;
  id: string;
  level: number;
  movement: HeroMovement;
  name: string;
  needs: HeroNeeds;
  personality: Personality;
  previousOccupation: PreviousOccupation;
  rank: number;
  relationships: Record<string, number>;
  skills: HeroSkills;
  traits: string[];
}
