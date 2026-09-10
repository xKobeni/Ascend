import type { HairLength, HairStyle, HeroAppearance, HeroGender } from "./Hero";

const HAIR_LENGTHS: readonly HairLength[] = ["short", "medium", "long"];
const HAIR_STYLES: readonly HairStyle[] = [
  "bald", "braided", "bun", "cropped", "curly", "long",
  "mohawk", "ponytail", "short", "slicked", "swept", "wild",
];
const GENDERS: readonly HeroGender[] = ["female", "male"];
const COLOR = /^#[0-9a-f]{6}$/i;

const isNumberInRange = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;

export function validateHeroAppearanceConfig(value: unknown): HeroAppearance | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = value as Record<string, unknown>;
  if (
    !isNumberInRange(input.armLength, 0.7, 1.35) ||
    !isNumberInRange(input.bodyWidth, 0.65, 1.55) ||
    !isNumberInRange(input.headScale, 0.7, 1.4) ||
    !isNumberInRange(input.height, 0.7, 1.35) ||
    !isNumberInRange(input.legLength, 0.7, 1.35) ||
    !isNumberInRange(input.shoulderWidth, 0.65, 1.45) ||
    typeof input.clothingColor !== "string" || !COLOR.test(input.clothingColor) ||
    typeof input.hairColor !== "string" || !COLOR.test(input.hairColor) ||
    typeof input.skinTone !== "string" || !COLOR.test(input.skinTone) ||
    !GENDERS.includes(input.gender as HeroGender) ||
    !HAIR_LENGTHS.includes(input.hairLength as HairLength) ||
    !HAIR_STYLES.includes(input.hairStyle as HairStyle)
  ) {
    return null;
  }
  return {
    armLength: input.armLength,
    bodyWidth: input.bodyWidth,
    clothingColor: input.clothingColor,
    gender: input.gender as HeroGender,
    hairColor: input.hairColor,
    hairLength: input.hairLength as HairLength,
    hairStyle: input.hairStyle as HairStyle,
    headScale: input.headScale,
    height: input.height,
    legLength: input.legLength,
    shoulderWidth: input.shoulderWidth,
    skinTone: input.skinTone,
  };
}

export function getHeroAppearanceSignature(appearance: Readonly<HeroAppearance>): string {
  return JSON.stringify(appearance);
}
