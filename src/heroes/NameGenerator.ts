import type { Random } from "../core/Random";

const FIRST_NAMES = [
  "Ari",
  "Cassia",
  "Damon",
  "Elias",
  "Ilyan",
  "Juno",
  "Kara",
  "Lena",
  "Mara",
  "Nia",
  "Orin",
  "Ren",
  "Rhea",
  "Sable",
  "Tarin",
  "Vale",
] as const;

const LAST_NAMES = [
  "Arden",
  "Ash",
  "Calder",
  "Dane",
  "Ember",
  "Hale",
  "Ives",
  "Kestrel",
  "Morrow",
  "Reyes",
  "Rowan",
  "Thorne",
  "Vale",
  "Voss",
  "Ward",
  "Wren",
] as const;

export class NameGenerator {
  constructor(private readonly random: Random) {}

  generate(): string {
    return `${this.random.pick(FIRST_NAMES)} ${this.random.pick(LAST_NAMES)}`;
  }
}
