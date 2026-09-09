import { Random } from "../core/Random";
import type {
  HairStyle,
  Hero,
  HeroAppearance,
  HeroAttributes,
  HeroSkills,
  HiddenPotential,
  Personality,
} from "./Hero";
import { NameGenerator } from "./NameGenerator";
import { OCCUPATIONS, type OccupationDefinition } from "./OccupationDefinitions";

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
    const occupation = this.random.pick(OCCUPATIONS);
    const attributes = this.generateAttributes(occupation);
    const skills = this.generateSkills(occupation);
    const personality = this.generatePersonality();

    return {
      age: this.random.integer(18, 58),
      appearance: this.generateAppearance(),
      attributes,
      health: 100,
      hiddenPotential: this.generateHiddenPotential(),
      id: crypto.randomUUID(),
      level: 1,
      morale: 100,
      name: this.names.generate(),
      personality,
      previousOccupation: occupation.name,
      rank: 1,
      relationships: {},
      skills,
      traits: this.generateTraits(attributes, personality),
    };
  }

  private generateAttributes(occupation: OccupationDefinition): HeroAttributes {
    const attributes: HeroAttributes = {
      agility: this.random.integer(2, 7),
      endurance: this.random.integer(2, 7),
      intelligence: this.random.integer(2, 7),
      leadership: this.random.integer(1, 6),
      strength: this.random.integer(2, 7),
      willpower: this.random.integer(2, 7),
    };
    this.applyModifiers(attributes, occupation.attributeModifiers);
    return attributes;
  }

  private generateSkills(occupation: OccupationDefinition): HeroSkills {
    const skills: HeroSkills = {
      defense: this.random.integer(0, 3),
      leadership: this.random.integer(0, 2),
      medicine: this.random.integer(0, 2),
      spear: this.random.integer(0, 3),
      sword: this.random.integer(0, 3),
    };
    this.applyModifiers(skills, occupation.skillModifiers);
    return skills;
  }

  private generatePersonality(): Personality {
    return {
      aggression: this.random.float(0.12, 0.9),
      ambition: this.random.float(0.12, 0.9),
      bravery: this.random.float(0.12, 0.9),
      discipline: this.random.float(0.12, 0.9),
      empathy: this.random.float(0.12, 0.9),
      loyalty: this.random.float(0.12, 0.9),
    };
  }

  private generateHiddenPotential(): HiddenPotential {
    return {
      agility: this.random.float(0.25, 0.98),
      endurance: this.random.float(0.25, 0.98),
      intelligence: this.random.float(0.25, 0.98),
      leadership: this.random.float(0.25, 0.98),
      strength: this.random.float(0.25, 0.98),
      willpower: this.random.float(0.25, 0.98),
    };
  }

  private generateTraits(attributes: HeroAttributes, personality: Personality): string[] {
    const scoredTraits = [
      { label: "Hard Worker", score: personality.discipline },
      { label: "Cowardly", score: 1 - personality.bravery },
      { label: "Protective", score: (personality.empathy + personality.loyalty) / 2 },
      { label: "Reckless", score: (personality.aggression + (1 - personality.discipline)) / 2 },
      { label: "Patient", score: (personality.discipline + (1 - personality.aggression)) / 2 },
      { label: "Loyal", score: personality.loyalty },
      { label: "Ambitious", score: personality.ambition },
      {
        label: "Natural Leader",
        score: (attributes.leadership / 10 + personality.bravery + personality.ambition) / 3,
      },
    ].sort((left, right) => right.score - left.score);

    return scoredTraits.slice(0, this.random.integer(1, 3)).map(({ label }) => label);
  }

  private applyModifiers<Values extends Record<keyof Values, number>>(
    values: Values,
    modifiers: Partial<Values>,
  ): void {
    (Object.keys(modifiers) as Array<keyof Values>).forEach((key) => {
      Reflect.set(values, key, Math.min(10, values[key] + (modifiers[key] ?? 0)));
    });
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
