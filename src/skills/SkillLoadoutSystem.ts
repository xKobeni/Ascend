import type { Hero } from "../heroes/Hero";
import { skillDefinitionRegistry } from "./SkillDefinitionRegistry";

export const ACTIVE_SKILL_SLOTS = 4;
export const PASSIVE_SKILL_SLOTS = 4;

export class SkillLoadoutSystem {
  toggle(hero: Hero, definitionId: string): boolean {
    if (!hero.skillForge.known[definitionId]) {
      return false;
    }
    const definition = skillDefinitionRegistry.require(definitionId);
    if (definition.type === "reaction") {
      return false;
    }
    const slot = definition.type === "passive" ? hero.skillForge.loadout.passive : hero.skillForge.loadout.active;
    const index = slot.indexOf(definitionId);
    if (index >= 0) {
      slot.splice(index, 1);
      return true;
    }
    const capacity = definition.type === "passive" ? PASSIVE_SKILL_SLOTS : ACTIVE_SKILL_SLOTS;
    if (slot.length >= capacity) {
      return false;
    }
    slot.push(definitionId);
    return true;
  }

  autoPrepare(hero: Hero, definitionId: string): void {
    const definition = skillDefinitionRegistry.require(definitionId);
    if (definition.type === "reaction") {
      return;
    }
    const slot = definition.type === "passive" ? hero.skillForge.loadout.passive : hero.skillForge.loadout.active;
    const capacity = definition.type === "passive" ? PASSIVE_SKILL_SLOTS : ACTIVE_SKILL_SLOTS;
    if (!slot.includes(definitionId) && slot.length < capacity) {
      slot.push(definitionId);
    }
  }

  isPrepared(hero: Readonly<Hero>, definitionId: string): boolean {
    const definition = skillDefinitionRegistry.get(definitionId);
    if (!definition || !hero.skillForge.known[definitionId]) {
      return false;
    }
    return definition.type === "reaction" ||
      hero.skillForge.loadout.active.includes(definitionId) ||
      hero.skillForge.loadout.passive.includes(definitionId);
  }
}
