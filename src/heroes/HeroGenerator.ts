import { Random } from "../core/Random";
import type {
  HairLength,
  HairStyle,
  Hero,
  HeroAppearance,
  HeroAttributes,
  HeroGender,
  HeroMovement,
  HeroNeeds,
  HeroSkills,
  HiddenPotential,
  Personality,
} from "./Hero";
import { NameGenerator } from "./NameGenerator";
import { OCCUPATIONS, type OccupationDefinition } from "./OccupationDefinitions";
import { HeroSkillGenerator } from "../skills/HeroSkillGenerator";

const SKIN_TONES = ["#6d4434", "#8e5b42", "#ad7453", "#c88e68", "#dbad87", "#f0c9a6"] as const;
const HAIR_COLORS = ["#171412", "#38271f", "#6b4830", "#9b754f", "#b8a38c", "#6d2f27"] as const;
const GRAY_HAIR_COLORS = ["#8a8a8a", "#b0b0b0", "#6e6e6e", "#a0a0a0"] as const;
const MALE_STYLES: readonly HairStyle[] = ["cropped", "short", "mohawk", "slicked", "bald", "wild"];
const FEMALE_STYLES: readonly HairStyle[] = ["long", "ponytail", "braided", "bun", "curly", "swept"];
const CLOTHING_COLORS = ["#456b72", "#596b4d", "#76545b", "#6b5e82", "#8a673f", "#3f607e"] as const;

export class HeroGenerator {
  private readonly names: NameGenerator;
  private readonly skillGenerator: HeroSkillGenerator;

  constructor(private readonly random = Random.fromEntropy()) {
    this.names = new NameGenerator(random);
    this.skillGenerator = new HeroSkillGenerator(random);
  }

  generate(
    initialMovement: HeroMovement,
    rosterIndex: number,
    usedNames?: ReadonlySet<string>,
  ): Hero {
    const occupation = this.pickOccupation();
    const attributes = this.generateAttributes(occupation);
    const skills = this.generateSkills(occupation);
    const personality = this.generatePersonality();
    const hiddenPotential = this.generateHiddenPotential();
    const traits = this.generateTraits(attributes, personality);
    const origin = {
      aptitudes: [...occupation.aptitudes],
      category: occupation.category,
      occupation: occupation.name,
      rarity: occupation.rarity,
    };
    const skillForge = this.skillGenerator.generate({
      attributes,
      hiddenPotential,
      origin,
      personality,
      skills,
      traits,
    });

    const age = this.random.integer(18, 58);

    return {
      age,
      appearance: this.generateAppearance(attributes, age),
      attributes,
      career: { expeditions: 0, joinedDay: 1, kills: 0, victories: 0 },
      hiddenPotential,
      heroClass: "Unclassified",
      id: crypto.randomUUID(),
      injuries: [],
      level: 1,
      lossMemories: [],
      memories: [],
      movement: initialMovement,
      name: this.names.generate(usedNames),
      needs: this.generateNeeds(rosterIndex),
      origin,
      personality,
      rank: 1,
      relationships: {},
      reputation: { renown: 0, title: null },
      recovery: { lastOutcome: null },
      skillForge,
      skills,
      socialRole: "Resident",
      traits,
      training: {
        active: null,
        injuryCheckMinutes: 0,
        lastOutcome: null,
        queue: [],
      },
    };
  }

  private pickOccupation(): OccupationDefinition {
    const totalWeight = OCCUPATIONS.reduce(
      (total, occupation) => total + occupation.selectionWeight,
      0,
    );
    let roll = this.random.float(0, totalWeight);
    for (const occupation of OCCUPATIONS) {
      roll -= occupation.selectionWeight;
      if (roll <= 0) {
        return occupation;
      }
    }
    const fallback = OCCUPATIONS.at(-1);
    if (!fallback) {
      throw new Error("At least one origin occupation is required.");
    }
    return fallback;
  }

  private generateNeeds(rosterIndex: number): HeroNeeds {
    const profiles: readonly HeroNeeds[] = [
      { fatigue: 26, health: 100, hunger: 34, morale: 68, social: 72, stress: 18 },
      { fatigue: 72, health: 96, hunger: 70, morale: 61, social: 65, stress: 32 },
      { fatigue: 31, health: 100, hunger: 68, morale: 58, social: 32, stress: 25 },
      { fatigue: 24, health: 100, hunger: 74, morale: 76, social: 71, stress: 14 },
      { fatigue: 44, health: 84, hunger: 62, morale: 52, social: 56, stress: 64 },
    ];
    const profile = profiles[rosterIndex % profiles.length];
    if (!profile) {
      throw new Error(`No needs profile exists for hero index ${rosterIndex}.`);
    }
    const vary = (value: number): number =>
      Math.min(100, Math.max(0, value + this.random.float(-3, 3)));
    return {
      fatigue: vary(profile.fatigue),
      health: vary(profile.health),
      hunger: vary(profile.hunger),
      morale: vary(profile.morale),
      social: vary(profile.social),
      stress: vary(profile.stress),
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

  private generateAppearance(attributes: HeroAttributes, age: number): HeroAppearance {
    const gender: HeroGender = this.random.pick(["female", "male"]);
    const isFemale = gender === "female";

    const styles = isFemale ? FEMALE_STYLES : MALE_STYLES;
    const hairStyle = this.random.pick(styles);

    let hairLength: HairLength;
    if (hairStyle === "bald") {
      hairLength = "short";
    } else if (isFemale) {
      hairLength = this.random.pick(["medium", "long", "long"]);
    } else {
      hairLength = this.random.pick(["short", "short", "medium"]);
    }

    const hasGrayHair = age > 40 && this.random.float(0, 1) < (age - 40) / 20;
    const hairColor = hasGrayHair
      ? this.random.pick(GRAY_HAIR_COLORS)
      : this.random.pick(HAIR_COLORS);

    const baseBodyWidth = isFemale ? this.random.float(0.88, 1.15) : this.random.float(0.92, 1.25);
    const strengthBonus = Math.max(0, (attributes.strength - 4) * 0.04);
    const agilityReduction = Math.max(0, (attributes.agility - 4) * 0.03);
    const bodyWidth = Math.min(1.4, Math.max(0.75, baseBodyWidth + strengthBonus - agilityReduction));

    const baseHeight = isFemale ? this.random.float(0.88, 1.08) : this.random.float(0.92, 1.14);
    const ageShrink = age > 50 ? (age - 50) * 0.002 : 0;
    const height = Math.max(0.85, baseHeight - ageShrink);

    return {
      bodyWidth,
      clothingColor: this.random.pick(CLOTHING_COLORS),
      gender,
      hairColor,
      hairLength,
      hairStyle,
      height,
      skinTone: this.random.pick(SKIN_TONES),
    };
  }
}
