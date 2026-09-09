import type { Random } from "../core/Random";

const FIRST_NAMES = [
  "Ari",
  "Asha",
  "Caelum",
  "Cassia",
  "Damon",
  "Draven",
  "Elias",
  "Elowen",
  "Faelan",
  "Fenris",
  "Gael",
  "Ilyan",
  "Juno",
  "Kael",
  "Kara",
  "Lena",
  "Lyria",
  "Mara",
  "Miren",
  "Nia",
  "Orin",
  "Quinn",
  "Ren",
  "Rhea",
  "Sable",
  "Sorin",
  "Tarin",
  "Theron",
  "Vale",
  "Zara",
  "Aldric",
  "Bren",
  "Cerys",
  "Dain",
  "Eira",
  "Falk",
  "Gwen",
  "Hale",
  "Iris",
  "Jarek",
  "Kira",
  "Loric",
  "Mael",
  "Nerys",
  "Oryn",
  "Pell",
  "Rhosyn",
  "Seris",
  "Tova",
  "Ursa",
  "Venn",
  "Wren",
  "Yara",
  "Zephyr",
  "Aldis",
  "Briar",
  "Caspian",
  "Delia",
  "Eryndor",
  "Fable",
  "Greer",
  "Heron",
  "Isolde",
  "Jareth",
] as const;

const LAST_NAMES = [
  "Arden",
  "Ash",
  "Ashwood",
  "Blackthorn",
  "Calder",
  "Dane",
  "Ember",
  "Emberly",
  "Frostborne",
  "Gloomveil",
  "Hale",
  "Holloway",
  "Ironhart",
  "Ives",
  "Kestrel",
  "Morrow",
  "Nightvale",
  "Ravenscar",
  "Reyes",
  "Rowan",
  "Shadowmere",
  "Stonefall",
  "Thorne",
  "Thornwood",
  "Valdris",
  "Vane",
  "Voss",
  "Ward",
  "Wyrmwood",
  "Wren",
  "Aldridge",
  "Brightwood",
  "Cloudvale",
  "Darkhollow",
  "Ebonhart",
  "Flintlock",
  "Gravehold",
  "Highvale",
  "Ironwood",
  "Jaycrest",
  "Kingsward",
  "Longshadow",
  "Moonveil",
  "Nighthollow",
  "Oakenshield",
  "Pinecrest",
  "Queensguard",
  "Redmoor",
  "Starfall",
  "Thornfield",
  "Undergrove",
  "Valewood",
  "Windemere",
  "Ashborne",
  "Briarwood",
  "Crestfall",
  "Duskveil",
  "Elmheart",
  "Fablewind",
  "Galecrest",
  "Hearthstone",
] as const;

const SYLLABLES = [
  "aer",
  "al",
  "an",
  "ar",
  "bel",
  "bor",
  "bra",
  "cael",
  "cor",
  "dal",
  "dra",
  "el",
  "en",
  "er",
  "eth",
  "fae",
  "fen",
  "gal",
  "gor",
  "hal",
  "hel",
  "ith",
  "jal",
  "kael",
  "kor",
  "lar",
  "lor",
  "mal",
  "mel",
  "mir",
  "mor",
  "nal",
  "nor",
  "orn",
  "pel",
  "quel",
  "ral",
  "ren",
  "rin",
  "ror",
  "sal",
  "sel",
  "sor",
  "thal",
  "ther",
  "tor",
  "val",
  "ven",
  "vor",
  "wen",
  "xor",
  "yal",
  "zen",
  "zor",
  "ash",
  "cen",
  "dyn",
  "fyn",
  "gry",
  "ion",
  "ix",
  "lyr",
  "nyx",
  "oph",
  "pyr",
  "rhos",
  "ryx",
  "syn",
  "tryn",
  "vyx",
  "wyn",
  "xen",
  "zyn",
] as const;

const MAX_RETRIES = 8;

export class NameGenerator {
  constructor(private readonly random: Random) {}

  generate(usedNames?: ReadonlySet<string>): string {
    if (!usedNames || usedNames.size === 0) {
      return this.randomPick();
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const candidate = this.randomPick();
      if (!usedNames.has(candidate)) {
        return candidate;
      }
    }

    return this.syllableGenerate(usedNames);
  }

  private randomPick(): string {
    return `${this.random.pick(FIRST_NAMES)} ${this.random.pick(LAST_NAMES)}`;
  }

  private syllableGenerate(usedNames: ReadonlySet<string>): string {
    for (let attempt = 0; attempt < MAX_RETRIES * 2; attempt++) {
      const firstName = this.buildSyllableName(2, 3);
      const lastName = this.buildSyllableName(1, 3);
      const full = `${firstName} ${lastName}`;
      if (!usedNames.has(full)) {
        return full;
      }
    }
    return `${this.buildSyllableName(2, 2)} ${this.buildSyllableName(2, 2)}-${this.random.integer(1, 99)}`;
  }

  private buildSyllableName(minSyllables: number, maxSyllables: number): string {
    const count = this.random.integer(minSyllables, maxSyllables);
    let raw = "";
    for (let i = 0; i < count; i++) {
      raw += this.random.pick(SYLLABLES);
    }
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}
