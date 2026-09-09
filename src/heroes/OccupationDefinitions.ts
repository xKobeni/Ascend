import type { HeroAttributes, HeroSkills, PreviousOccupation } from "./Hero";

export interface OccupationDefinition {
  attributeModifiers: Partial<HeroAttributes>;
  name: PreviousOccupation;
  skillModifiers: Partial<HeroSkills>;
}

export const OCCUPATIONS: readonly OccupationDefinition[] = [
  {
    name: "Farmer",
    attributeModifiers: { endurance: 2, strength: 1, willpower: 1 },
    skillModifiers: { defense: 1, spear: 1 },
  },
  {
    name: "Nurse",
    attributeModifiers: { intelligence: 1, willpower: 1 },
    skillModifiers: { medicine: 4 },
  },
  {
    name: "Soldier",
    attributeModifiers: { endurance: 1, leadership: 1, strength: 1 },
    skillModifiers: { defense: 3, leadership: 1, sword: 3 },
  },
  {
    name: "Student",
    attributeModifiers: { intelligence: 2 },
    skillModifiers: { leadership: 1, medicine: 1 },
  },
  {
    name: "Mechanic",
    attributeModifiers: { intelligence: 1, strength: 1 },
    skillModifiers: { defense: 2 },
  },
  {
    name: "Hunter",
    attributeModifiers: { agility: 2, endurance: 1 },
    skillModifiers: { defense: 1, spear: 3 },
  },
  {
    name: "Teacher",
    attributeModifiers: { intelligence: 1, leadership: 2 },
    skillModifiers: { leadership: 3, medicine: 1 },
  },
] as const;
