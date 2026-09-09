import { Random } from "../core/Random";
import type { HairStyle, Hero, HeroAppearance } from "./Hero";
import { NameGenerator } from "./NameGenerator";

const SKIN_TONES = ["#6d4434", "#8e5b42", "#ad7453", "#c88e68", "#dbad87", "#f0c9a6"] as const;
const HAIR_COLORS = ["#171412", "#38271f", "#6b4830", "#9b754f", "#b8a38c", "#6d2f27"] as const;
const HAIR_STYLES: readonly HairStyle[] = ["bald", "bun", "cropped", "mohawk", "swept"];
const CLOTHING_COLORS = ["#456b72", "#596b4d", "#76545b", "#6b5e82", "#8a673f", "#3f607e"] as const;

export class HeroGenerator {
  private readonly names: NameGenerator;

  constructor(private readonly random = Random.fromEntropy()) {
    this.names = new NameGenerator(random);
  }

  generate(): Hero {
    return {
      age: this.random.integer(18, 58),
      appearance: this.generateAppearance(),
      health: 100,
      id: crypto.randomUUID(),
      level: 1,
      morale: 100,
      name: this.names.generate(),
      personality: {},
      rank: 1,
      relationships: {},
      skills: {},
      traits: [],
    };
  }

  private generateAppearance(): HeroAppearance {
    return {
      bodyWidth: this.random.float(0.82, 1.2),
      clothingColor: this.random.pick(CLOTHING_COLORS),
      hairColor: this.random.pick(HAIR_COLORS),
      hairStyle: this.random.pick(HAIR_STYLES),
      height: this.random.float(0.9, 1.12),
      skinTone: this.random.pick(SKIN_TONES),
    };
  }
}
