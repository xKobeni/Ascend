import { createInitialMovement } from "../base/NavigationPoints";
import type { FallenHeroRecord, Hero } from "./Hero";
import { HeroGenerator } from "./HeroGenerator";
import { NeedsSystem } from "./NeedsSystem";
import { getRelationshipLabel, RelationshipSystem } from "./RelationshipSystem";
import { HeroRoutineSystem } from "./HeroRoutineSystem";
import { TrainingSystem } from "./TrainingSystem";
import type { TrainingType } from "./Hero";
import { SkillDiscoverySystem } from "../skills/SkillDiscoverySystem";
import { SkillLoadoutSystem } from "../skills/SkillLoadoutSystem";
import { SkillProgressionSystem } from "../skills/SkillProgressionSystem";
import type { SkillProgressionResult, SkillUsageEvent } from "../skills/Skill";
import type { CombatSnapshot } from "../combat/Combat";
import type { ExpeditionConsequence, ExpeditionReport } from "../expeditions/Expedition";
import type { Squad } from "../squads/Squad";
import { InjurySystem, type TreatmentResult } from "./InjurySystem";
import { LegacySystem } from "./LegacySystem";
import type { CombatMemoryEvent } from "../memories/HeroMemory";
import { MemorySystem } from "../memories/MemorySystem";
import { TraitEvolutionSystem } from "./TraitEvolutionSystem";
import { Random } from "../core/Random";
import type { RestRecoveryModifiers } from "./NeedsSystem";
import type { RefugeLayoutSnapshot } from "../refuge/RefugeLayoutSystem";
import type { ConstructionSnapshot } from "../refuge/ConstructionSystem";

export class HeroManager {
  private readonly heroes = new Map<string, Hero>();
  private readonly injurySystem = new InjurySystem();
  private readonly legacySystem = new LegacySystem();
  private readonly memorySystem = new MemorySystem();
  private readonly needsSystem = new NeedsSystem();
  private readonly relationshipSystem = new RelationshipSystem();
  private readonly routineSystem = new HeroRoutineSystem();
  private readonly skillDiscovery = new SkillDiscoverySystem();
  private readonly skillLoadout = new SkillLoadoutSystem();
  private readonly skillProgression = new SkillProgressionSystem();
  private readonly trainingSystem = new TrainingSystem(
    this.skillProgression,
    this.skillDiscovery,
    this.skillLoadout,
    this.injurySystem,
  );
  private readonly traitEvolutionSystem = new TraitEvolutionSystem();
  private readonly usedNames = new Set<string>();

  constructor(private readonly generator = new HeroGenerator()) {}

  generateInitialRoster(count: number): readonly Hero[] {
    while (this.heroes.size < count) {
      const hero = this.generator.generate(
        createInitialMovement(this.heroes.size),
        this.heroes.size,
        this.usedNames,
      );
      this.usedNames.add(hero.name);
      this.heroes.set(hero.id, hero);
    }
    const heroes = this.getAll();
    this.relationshipSystem.initialize(heroes);
    return heroes;
  }

  recruit(seed: number, day: number, rank: 1 | 2 | 3): Readonly<Hero> {
    const generator = new HeroGenerator(new Random(seed));
    const hero = generator.generate(
      createInitialMovement(this.heroes.size),
      this.heroes.size,
      this.usedNames,
      seed,
    );
    hero.career.joinedDay = Math.max(1, Math.floor(day));
    hero.rank = rank;
    this.usedNames.add(hero.name);
    this.heroes.set(hero.id, hero);
    this.relationshipSystem.initialize(this.getAll());
    return hero;
  }

  getAll(): readonly Hero[] {
    return [...this.heroes.values()];
  }

  getById(id: string): Readonly<Hero> | undefined {
    return this.heroes.get(id);
  }

  getFallen(): readonly Readonly<FallenHeroRecord>[] {
    return this.legacySystem.getFallen();
  }

  getFallenByHeroId(heroId: string): Readonly<FallenHeroRecord> | undefined {
    return this.legacySystem.getByHeroId(heroId);
  }

  queueTraining(heroId: string, type: TrainingType): boolean {
    const hero = this.heroes.get(heroId);
    return hero ? this.trainingSystem.queueTraining(hero, type) : false;
  }

  toggleSkillLoadout(heroId: string, definitionId: string): boolean {
    const hero = this.heroes.get(heroId);
    return hero ? this.skillLoadout.toggle(hero, definitionId) : false;
  }

  recordSkillUsage(event: Readonly<SkillUsageEvent>): SkillProgressionResult | null {
    const hero = this.heroes.get(event.heroId);
    if (!hero) {
      return null;
    }
    const result = this.skillProgression.recordUsage(hero, event);
    if (!result) {
      return null;
    }
    this.skillDiscovery.evaluateProgression(hero, event.definitionId, event.source).forEach((skill) => {
      this.skillLoadout.autoPrepare(hero, skill.definitionId);
    });
    return result;
  }

  recordCombatMemory(event: Readonly<CombatMemoryEvent>, day: number, minuteOfDay = 0): void {
    this.memorySystem.recordCombatEvent(this.getAll(), event, day, minuteOfDay);
    const actor = this.heroes.get(event.actorId);
    const target = this.heroes.get(event.targetId);
    if (actor) {
      this.traitEvolutionSystem.evaluate(actor, day);
    }
    if (target) {
      this.traitEvolutionSystem.evaluate(target, day);
    }
  }

  recordExpeditionExperience(squad: Readonly<Squad>, successful: boolean): void {
    squad.members.forEach((member) => {
      const survivalSkill = member.formation === "Back" ? "scouting" : "tracking";
      this.recordExpeditionSkill(
        member.heroId,
        survivalSkill,
        successful,
        member.formation === "Back"
          ? "Read the expedition route and identified threats from the rear line."
          : "Tracked Rift movement through the expedition zone.",
      );
      if (member.role === "Support") {
        this.recordExpeditionSkill(
          member.heroId,
          "medicine",
          successful,
          "Managed the squad's condition during deployment.",
        );
        this.recordExpeditionSkill(
          member.heroId,
          "field_treatment",
          successful,
          "Applied field treatment under expedition pressure.",
        );
      }
    });
  }

  applyExpeditionConsequences(
    squad: Readonly<Squad>,
    combat: Readonly<CombatSnapshot>,
    outcome: ExpeditionReport["outcome"],
    day: number,
  ): readonly ExpeditionConsequence[] {
    const successful = outcome === "Victory";
    squad.members.forEach((member) => {
      const hero = this.heroes.get(member.heroId);
      if (hero) {
        this.legacySystem.recordExpedition(
          hero,
          combat.combatants.find((entry) => entry.id === hero.id),
          successful,
        );
      }
    });
    const fallenHeroes = squad.members.flatMap((member) => {
      const hero = this.heroes.get(member.heroId);
      const combatant = combat.combatants.find((entry) => entry.id === member.heroId);
      return hero && combatant && combatant.hp <= 0 ? [{ combatant, hero }] : [];
    });
    const fallenRecords = fallenHeroes.map(({ combatant, hero }) => this.legacySystem.memorialize(
      hero,
      day,
      combatant.defeatedBy ?? "Rift exposure",
      squad.name,
    ));
    const fallenIds = new Set(fallenRecords.map((record) => record.heroId));
    const reactions = this.legacySystem.applyRelationshipReactions(
      this.getAll().filter((hero) => !fallenIds.has(hero.id)),
      fallenRecords,
      day,
    );

    // Apply base death stress to all survivors (scales with death count and outcome)
    if (fallenIds.size > 0) {
      const survivorHeroes = this.getAll().filter((hero) => !fallenIds.has(hero.id));
      this.needsSystem.applyDeathStress(survivorHeroes, fallenIds.size, outcome === "Defeat");
    }
    fallenHeroes.forEach(({ hero: fallen }) => {
      this.getAll()
        .filter((survivor) => !fallenIds.has(survivor.id))
        .forEach((survivor) => {
          const profile = survivor.relationships[fallen.id];
          const relationship = profile ? getRelationshipLabel(profile) : "Neutral";
          this.memorySystem.recordAllyDeath(survivor, fallen, relationship, day);
        });
    });
    fallenIds.forEach((heroId) => this.heroes.delete(heroId));

    const consequences = squad.members.flatMap<ExpeditionConsequence>((member) => {
      const fallen = fallenRecords.find((record) => record.heroId === member.heroId);
      if (fallen) {
        const affected = reactions.filter((reaction) => reaction.fallenHeroId === fallen.heroId).length;
        return [{
          detail: `Fallen · ${fallen.causeOfDeath}${affected ? ` · ${affected} friend${affected === 1 ? "" : "s"} grieving` : ""}`,
          heroId: fallen.heroId,
          heroName: fallen.name,
          permanent: true,
        }];
      }
      const hero = this.heroes.get(member.heroId);
      if (!hero) {
        return [];
      }
      if (successful) {
        return [];
      }
      const combatant = combat.combatants.find((entry) => entry.id === member.heroId);
      const damageRatio = combatant
        ? 1 - Math.max(0, combatant.hp) / combatant.stats.maxHp
        : 1;
      const healthLoss = (outcome === "Defeat" ? 24 : 10) + Math.round(damageRatio * 12);
      const moraleLoss = (outcome === "Defeat" ? 14 : 7) + Math.round(damageRatio * 5);
      hero.needs.health = Math.max(0, hero.needs.health - healthLoss);
      hero.needs.morale = Math.max(0, hero.needs.morale - moraleLoss);
      hero.needs.fatigue = Math.min(100, hero.needs.fatigue + 18);
      const injury = this.injurySystem.inflictExpeditionInjury(
        hero,
        outcome === "Defeat" ? "Defeat" : "Withdrawn",
        damageRatio,
        day,
      );
      if (injury.severity !== "Minor" || damageRatio >= 0.72) {
        this.memorySystem.recordCriticalInjury(hero, injury.type, day);
      }
      return [{
        detail: `${injury.severity} ${injury.type} · Health -${healthLoss} · Morale -${moraleLoss}`,
        heroId: hero.id,
        heroName: hero.name,
        permanent: false,
      }];
    });
    this.getAll().forEach((hero) => this.traitEvolutionSystem.evaluate(hero, day));
    return consequences;
  }

  treatInjury(heroId: string, injuryId: string, availableMedicine: number): TreatmentResult {
    const hero = this.heroes.get(heroId);
    return hero
      ? this.injurySystem.treat(hero, injuryId, availableMedicine)
      : { cost: 0, message: "Hero record is unavailable.", success: false };
  }

  step(
    deltaSeconds: number,
    gameMinutes: number,
    day: number,
    minuteOfDay: number,
    layout: Readonly<RefugeLayoutSnapshot>,
    construction: Readonly<ConstructionSnapshot>,
    restRecovery?: Readonly<RestRecoveryModifiers>,
    facilityEffects: Readonly<{ injuryRecoveryMultiplier: number; trainingMultiplier: number }> = {
      injuryRecoveryMultiplier: 1,
      trainingMultiplier: 1,
    },
  ): void {
    const heroes = [...this.heroes.values()];
    this.trainingSystem.prepare(heroes);
    this.needsSystem.step(heroes, gameMinutes, restRecovery);
    this.routineSystem.step(
      heroes,
      deltaSeconds,
      minuteOfDay,
      this.needsSystem,
      this.trainingSystem,
      layout,
      construction,
    );
    this.trainingSystem.step(heroes, gameMinutes, this.needsSystem, day, facilityEffects.trainingMultiplier);
    this.injurySystem.step(heroes, gameMinutes, facilityEffects.injuryRecoveryMultiplier);
    this.memorySystem.step(heroes, gameMinutes);
    this.relationshipSystem.step(heroes, gameMinutes, day, minuteOfDay);
  }

  getSocialEvents() {
    return this.relationshipSystem.getEvents();
  }

  getDayPeriod(minuteOfDay: number) {
    return this.routineSystem.getDayPeriod(minuteOfDay);
  }

  private recordExpeditionSkill(
    heroId: string,
    definitionId: string,
    successful: boolean,
    reason: string,
  ): void {
    const hero = this.heroes.get(heroId);
    if (!hero) {
      return;
    }
    const discovered = this.skillDiscovery.tryDiscover(hero, definitionId, "expedition");
    if (discovered) {
      this.skillLoadout.autoPrepare(hero, definitionId);
    }
    this.recordSkillUsage({
      baseXp: 18,
      definitionId,
      difficulty: 1.2,
      heroId,
      reason,
      source: "expedition",
      successful,
    });
  }
}
