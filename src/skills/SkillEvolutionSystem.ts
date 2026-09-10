import type { Hero } from "../heroes/Hero";
import type { SkillDefinition } from "./Skill";
import { skillDefinitionRegistry } from "./SkillDefinitionRegistry";

export class SkillEvolutionSystem {
  getAvailableEvolutions(hero: Readonly<Hero>, definitionId: string): readonly Readonly<SkillDefinition>[] {
    const skill = hero.skillForge.known[definitionId];
    if (!skill?.mastery) {
      return [];
    }
    const definition = skillDefinitionRegistry.get(definitionId);
    return (definition?.evolutions ?? [])
      .map((evolutionId) => skillDefinitionRegistry.get(evolutionId))
      .filter((candidate): candidate is Readonly<SkillDefinition> => candidate !== undefined);
  }
}
