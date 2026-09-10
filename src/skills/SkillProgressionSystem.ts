import type { Hero } from "../heroes/Hero";
import type { SkillProgressionResult, SkillUsageEvent } from "./Skill";
import { skillDefinitionRegistry } from "./SkillDefinitionRegistry";

export class SkillProgressionSystem {
  recordUsage(hero: Hero, event: Readonly<SkillUsageEvent>): SkillProgressionResult | null {
    const skill = hero.skillForge.known[event.definitionId];
    const definition = skillDefinitionRegistry.get(event.definitionId);
    if (!skill || !definition || skill.mastery) {
      return null;
    }
    const levelBefore = skill.level;
    const affinity = hero.skillForge.affinities[definition.affinity];
    const successModifier = event.successful ? 1.15 : 0.7;
    const difficultyModifier = 1 + Math.max(0, event.difficulty - 1) * 0.2;
    const gainedXp = Math.max(1, Math.round(event.baseXp * (0.72 + affinity * 0.56) * successModifier * difficultyModifier));
    skill.xp += gainedXp;
    hero.skillForge.usageCounts[event.definitionId] = (hero.skillForge.usageCounts[event.definitionId] ?? 0) + 1;
    skill.proficiency = Math.min(1, skill.proficiency + 0.006 + affinity * 0.004);
    while (skill.level < definition.maxLevel && skill.xp >= this.getXpToNextLevel(skill.level)) {
      skill.xp -= this.getXpToNextLevel(skill.level);
      skill.level += 1;
    }
    skill.mastery = skill.level >= definition.maxLevel;
    this.syncLegacyValue(hero, definition.legacySkill, skill.level);
    return {
      definitionId: event.definitionId,
      gainedXp,
      levelAfter: skill.level,
      levelBefore,
      mastered: skill.mastery,
      proficiencyAfter: skill.proficiency,
    };
  }

  recordTrainingCompletion(hero: Hero, definitionId: string, reason: string): SkillProgressionResult | null {
    const skill = hero.skillForge.known[definitionId];
    if (!skill) {
      return null;
    }
    return this.recordUsage(hero, {
      baseXp: this.getXpToNextLevel(skill.level),
      definitionId,
      difficulty: 1,
      heroId: hero.id,
      reason,
      source: "training",
      successful: true,
    });
  }

  getXpToNextLevel(level: number): number {
    return getSkillXpToNextLevel(level);
  }

  private syncLegacyValue(
    hero: Hero,
    legacySkill: "defense" | "leadership" | "medicine" | "spear" | "sword" | undefined,
    level: number,
  ): void {
    if (legacySkill) {
      hero.skills[legacySkill] = level;
    }
  }
}

export function getSkillXpToNextLevel(level: number): number {
  return 48 + level * 18;
}
