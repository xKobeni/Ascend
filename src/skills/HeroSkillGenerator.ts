import { Random } from "../core/Random";
import type {
  HeroAttributes,
  HeroOrigin,
  HeroSkills,
  HiddenPotential,
  Personality,
} from "../heroes/Hero";
import type { HeroSkill, HeroSkillForge, SkillAffinity, SkillSource } from "./Skill";
import { skillDefinitionRegistry } from "./SkillDefinitionRegistry";

interface SkillGenerationContext {
  attributes: Readonly<HeroAttributes>;
  hiddenPotential: Readonly<HiddenPotential>;
  origin: Readonly<HeroOrigin>;
  personality: Readonly<Personality>;
  skills: Readonly<HeroSkills>;
  traits: readonly string[];
}

export class HeroSkillGenerator {
  constructor(private readonly random: Random) {}

  generate(context: Readonly<SkillGenerationContext>): HeroSkillForge {
    const affinities = this.generateAffinities(context);
    const known: Record<string, HeroSkill> = {};
    const discover = (definitionId: string, level: number, reason: string, source: SkillSource = "innate"): void => {
      if (known[definitionId]) {
        return;
      }
      const definition = skillDefinitionRegistry.require(definitionId);
      known[definitionId] = {
        definitionId,
        discoveryReason: reason,
        level: Math.min(definition.maxLevel, Math.max(1, level)),
        mastery: level >= definition.maxLevel,
        proficiency: this.clamp(0.38 + affinities[definition.affinity] * 0.5 + this.random.float(-0.06, 0.06)),
        source,
        xp: 0,
      };
    };

    if (context.skills.sword > 0) {
      discover("sword_mastery", context.skills.sword, `Existing Sword ${context.skills.sword} converted into personal mastery.`);
    }
    if (context.skills.spear > 0) {
      discover("spear_mastery", context.skills.spear, `Existing Spear ${context.skills.spear} converted into personal mastery.`);
    }
    if (context.skills.defense > 0) {
      discover("brace", context.skills.defense, `Existing Defense ${context.skills.defense} converted into Brace.`);
    }
    if (context.skills.medicine > 0) {
      discover("medicine", context.skills.medicine, `Existing Medicine ${context.skills.medicine} converted into personal knowledge.`);
    }
    if (context.skills.leadership > 0) {
      discover("leadership", context.skills.leadership, `Existing Leadership ${context.skills.leadership} converted into personal practice.`);
    }

    const primaryWeapon = affinities.spear + context.skills.spear * 0.05 >= affinities.sword + context.skills.sword * 0.05
      ? "spear"
      : "sword";
    if (primaryWeapon === "spear") {
      discover("spear_mastery", Math.max(1, context.skills.spear), "Innate spear affinity revealed during origin evaluation.");
      discover("basic_thrust", 1, "Discovered from starting Spear Mastery.");
    } else {
      discover("sword_mastery", Math.max(1, context.skills.sword), "Innate sword affinity revealed during origin evaluation.");
      if (context.skills.sword >= 2 || affinities.sword >= 0.68) {
        discover("parry", 1, "Sword control and defensive timing revealed Parry.");
      }
    }

    const aptitudes = context.origin.aptitudes.join(" ").toLowerCase();
    if (aptitudes.includes("track") || aptitudes.includes("survival") || affinities.survival >= 0.72) {
      discover("tracking", 1, `${context.origin.occupation} experience revealed Tracking.`);
    }
    if (aptitudes.includes("scout") || aptitudes.includes("navigation") || affinities.survival >= 0.82) {
      discover("scouting", 1, `${context.origin.occupation} experience revealed Scouting.`);
    }
    if (context.skills.medicine >= 2 || (context.skills.medicine > 0 && affinities.support >= 0.64)) {
      discover("field_treatment", 1, "Medical aptitude revealed an expedition-ready treatment technique.");
    }
    if (context.traits.includes("Protective")) {
      discover("protective_instinct", 1, "Protective personality produced an automatic response.");
      if (context.attributes.endurance >= 4) {
        discover("interpose", 1, "Protective instinct and endurance revealed Interpose.");
      }
    }
    if ((context.personality.bravery + context.personality.discipline) / 2 >= 0.66) {
      discover("battle_focus", 1, "Bravery and discipline revealed Battle Focus.");
    } else if (context.personality.bravery <= 0.38) {
      discover("fear_resistance", 1, "Repeatedly managing low bravery revealed Fear Resistance potential.");
    }

    // ── Survival / Exploration ──────────────────────────────────────────

    if (aptitudes.includes("track") || aptitudes.includes("field") || aptitudes.includes("forag") || affinities.survival >= 0.58) {
      discover("foraging", 1, `${context.origin.occupation} experience revealed Foraging.`);
    }
    if (aptitudes.includes("observ") || aptitudes.includes("scout") || aptitudes.includes("infiltr") || affinities.survival >= 0.62) {
      discover("observation", 1, `${context.origin.occupation} experience revealed Observation.`);
    }
    if (context.attributes.endurance >= 3 || aptitudes.includes("shield") || aptitudes.includes("protection")) {
      discover("shield_mastery", 1, `${context.origin.occupation} experience revealed Shield Mastery.`);
    }

    // ── Support / Crafting ──────────────────────────────────────────────

    if (aptitudes.includes("craft") || aptitudes.includes("metal") || aptitudes.includes("repair") || aptitudes.includes("construct") || (context.attributes.intelligence >= 3 && affinities.support >= 0.5)) {
      discover("crafting", 1, `${context.origin.occupation} experience revealed Crafting.`);
    }
    if (aptitudes.includes("negotiat") || aptitudes.includes("persuas") || aptitudes.includes("diplomat") || context.attributes.leadership >= 3) {
      discover("negotiation", 1, `${context.origin.occupation} experience revealed Negotiation.`);
    }

    // ── Mental / Tactical ──────────────────────────────────────────────

    if (context.attributes.willpower >= 4 && (context.personality.discipline >= 0.5 || context.personality.bravery >= 0.5)) {
      discover("iron_will", 1, "Exceptional willpower and mental fortitude revealed Iron Will.");
    }
    if (context.attributes.intelligence >= 3 && context.attributes.leadership >= 2 && affinities.support >= 0.45) {
      discover("tactical_knowledge", 1, "Analytical mind and command presence revealed Tactical Knowledge.");
    }

    // ── Magic ──────────────────────────────────────────────────────────

    if (affinities.magic >= 0.48 || context.attributes.intelligence >= 4) {
      discover("mana_sense", 1, "Innate magical sensitivity detected during origin evaluation.");
    }

    // ── Weapon Expansion ───────────────────────────────────────────────

    if (context.traits.includes("Reckless") && context.attributes.endurance >= 4) {
      discover("adrenaline_rush", 1, "Reckless nature and physical resilience produced Adrenaline Rush.");
    }
    if (context.attributes.endurance >= 5 && context.attributes.willpower >= 3) {
      discover("second_wind", 1, "Extraordinary endurance and willpower revealed Second Wind.");
    }

    const discoveryLog = Object.values(known).map(({ definitionId, discoveryReason, source }) => ({
      definitionId,
      reason: discoveryReason,
      source,
    }));
    const forge: HeroSkillForge = {
      affinities,
      discoveryLog,
      hiddenPotentialSlots: this.random.integer(2, 4),
      known,
      loadout: { active: [], passive: [] },
      usageCounts: {},
    };
    this.prepareInitialLoadout(forge);
    return forge;
  }

  private generateAffinities(context: Readonly<SkillGenerationContext>): Record<SkillAffinity, number> {
    const averagePotential = Object.values(context.hiddenPotential).reduce((total, value) => total + value, 0) / 6;
    const affinity = (value: number): number => this.clamp(value + this.random.float(-0.1, 0.1));
    return {
      defense: affinity(context.attributes.endurance / 14 + context.personality.discipline * 0.42),
      magic: affinity(context.attributes.intelligence / 20 + context.hiddenPotential.intelligence * 0.24),
      spear: affinity(context.attributes.strength / 20 + context.attributes.endurance / 24 + context.hiddenPotential.strength * 0.28),
      support: affinity(context.attributes.intelligence / 18 + context.personality.empathy * 0.38),
      survival: affinity(context.attributes.agility / 22 + context.hiddenPotential.agility * 0.3 + averagePotential * 0.18),
      sword: affinity(context.attributes.agility / 20 + context.attributes.strength / 24 + context.hiddenPotential.agility * 0.28),
    };
  }

  private prepareInitialLoadout(forge: HeroSkillForge): void {
    Object.keys(forge.known).forEach((definitionId) => {
      const definition = skillDefinitionRegistry.require(definitionId);
      if ((definition.type === "active" || definition.type === "utility") && forge.loadout.active.length < 4) {
        forge.loadout.active.push(definitionId);
      } else if (definition.type === "passive" && forge.loadout.passive.length < 4) {
        forge.loadout.passive.push(definitionId);
      }
    });
  }

  private clamp(value: number): number {
    return Math.min(0.98, Math.max(0.04, value));
  }
}
