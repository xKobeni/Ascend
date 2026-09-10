import type { Hero } from "../heroes/Hero";
import type { HeroSkill, SkillDefinition, SkillSource } from "./Skill";
import { skillDefinitionRegistry } from "./SkillDefinitionRegistry";

export class SkillDiscoverySystem {
  evaluateProgression(
    hero: Hero,
    changedDefinitionId: string,
    source: "combat" | "expedition" | "training",
  ): readonly HeroSkill[] {
    const candidates = changedDefinitionId === "spear_mastery"
      ? ["basic_thrust", "lunge"]
      : changedDefinitionId === "sword_mastery"
        ? ["parry"]
        : changedDefinitionId === "medicine"
          ? ["field_treatment"]
          : [];
    return candidates
      .map((definitionId) => this.tryDiscover(hero, definitionId, source))
      .filter((skill): skill is HeroSkill => skill !== null);
  }

  tryDiscover(hero: Hero, definitionId: string, source: SkillSource): HeroSkill | null {
    if (hero.skillForge.known[definitionId]) {
      return null;
    }
    const definition = skillDefinitionRegistry.get(definitionId);
    if (!definition || !this.meetsRequirements(hero, definition)) {
      return null;
    }
    const reason = this.describeRequirements(definition);
    const skill: HeroSkill = {
      definitionId,
      discoveryReason: reason,
      level: 1,
      mastery: false,
      proficiency: 0.35 + hero.skillForge.affinities[definition.affinity] * 0.35,
      source,
      xp: 0,
    };
    hero.skillForge.known[definitionId] = skill;
    hero.skillForge.discoveryLog.push({ definitionId, reason, source });
    return skill;
  }

  private meetsRequirements(hero: Readonly<Hero>, definition: Readonly<SkillDefinition>): boolean {
    return (definition.prerequisites ?? []).every((requirement) => {
      if (requirement.kind === "attribute") {
        return hero.attributes[requirement.attribute] >= requirement.minimum;
      }
      if (requirement.kind === "trait") {
        return hero.traits.includes(requirement.trait);
      }
      return (hero.skillForge.known[requirement.definitionId]?.level ?? 0) >= requirement.level;
    });
  }

  private describeRequirements(definition: Readonly<SkillDefinition>): string {
    const requirement = definition.prerequisites?.[0];
    if (!requirement) {
      return "Discovered through repeated supported use.";
    }
    if (requirement.kind === "skill") {
      return `${skillDefinitionRegistry.require(requirement.definitionId).name} Lv. ${requirement.level} revealed this technique.`;
    }
    if (requirement.kind === "trait") {
      return `${requirement.trait} behavior revealed this skill.`;
    }
    return `${requirement.attribute} ${requirement.minimum} revealed this skill.`;
  }
}
