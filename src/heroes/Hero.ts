export type HairStyle = "bald" | "bun" | "cropped" | "mohawk" | "swept";

export interface HeroAppearance {
  bodyWidth: number;
  clothingColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  height: number;
  skinTone: string;
}

export type HeroSkills = Record<string, number>;
export type Personality = Record<string, number>;

export interface Hero {
  age: number;
  appearance: HeroAppearance;
  health: number;
  id: string;
  level: number;
  morale: number;
  name: string;
  personality: Personality;
  rank: number;
  relationships: Record<string, number>;
  skills: HeroSkills;
  traits: string[];
}
