import type { Hero } from "../heroes/Hero";
import type { Squad } from "../squads/Squad";
import type {
  CombatAction,
  CombatantSnapshot,
  CombatLogEntry,
  CombatPosition,
  CombatResult,
  CombatSnapshot,
  CombatStats,
} from "./Combat";
import { scoreCombatActions } from "./UtilityAI";
import {
  applyFormationStats,
  getFormationStart,
  getPreferredRange,
  getTacticalRole,
} from "./FormationSystem";
import type { SkillUsageEvent } from "../skills/Skill";
import { skillDefinitionRegistry } from "../skills/SkillDefinitionRegistry";

interface Combatant extends CombatantSnapshot {
  attackCooldown: number;
  medicine: number;
  personality: Hero["personality"];
  preparedSkillIds: ReadonlySet<string>;
  relationships: Hero["relationships"];
  retreatLogged: boolean;
  traits: readonly string[];
  weaponSkillId: "spear_mastery" | "sword_mastery" | null;
}

interface PlannedAction {
  action: CombatAction;
  actor: Combatant;
  target: Combatant | null;
}

const COMBAT_TICK_SECONDS = 0.1;
const MAX_STEPS_PER_FRAME = 10;
const MAX_LOG_ENTRIES = 10;

export class CombatSimulation {
  private accumulatorSeconds = 0;
  private readonly combatants: Combatant[] = [];
  private readonly lastSkillUsageTicks = new Map<string, number>();
  private readonly log: CombatLogEntry[] = [];
  private nextLogId = 1;
  private result: CombatResult = "Idle";
  private tick = 0;
  private encounterLabel = "Sandbox";

  constructor(
    private readonly onSkillUsage: (event: Readonly<SkillUsageEvent>) => void = () => undefined,
  ) {}

  start(
    squad: Readonly<Squad>,
    heroes: readonly Readonly<Hero>[],
    encounterLabel = "Sandbox",
    enemyStrength = 1,
  ): boolean {
    if (squad.members.length !== 3) {
      return false;
    }
    const selectedHeroes = squad.members.map((member) => {
      const hero = heroes.find((candidate) => candidate.id === member.heroId);
      return hero ? { hero, member } : null;
    });
    if (selectedHeroes.some((entry) => entry === null)) {
      return false;
    }

    this.reset();
    this.encounterLabel = encounterLabel;
    selectedHeroes.forEach((entry, index) => {
      if (!entry) {
        return;
      }
      const lane = (index - 1) * 4.2;
      const tacticalRole = getTacticalRole(entry.member.role, entry.member.formation);
      const stats = applyFormationStats(this.getHeroStats(entry.hero, entry.member.role), tacticalRole);
      const reactionSkills = Object.keys(entry.hero.skillForge.known).filter(
        (definitionId) => skillDefinitionRegistry.get(definitionId)?.type === "reaction",
      );
      this.combatants.push({
        action: "Idle",
        actionScores: [],
        attackCooldown: index * 0.12,
        decisionReason: "Awaiting first evaluation",
        defending: false,
        formation: entry.member.formation,
        hp: stats.maxHp,
        id: entry.hero.id,
        label: entry.hero.name,
        medicine: entry.hero.skills.medicine,
        personality: entry.hero.personality,
        position: getFormationStart(entry.member.formation, lane),
        preparedSkillIds: new Set([
          ...entry.hero.skillForge.loadout.active,
          ...entry.hero.skillForge.loadout.passive,
          ...reactionSkills,
        ]),
        retreatLogged: false,
        relationships: entry.hero.relationships,
        role: entry.member.role,
        stats,
        tacticalRole,
        team: "Hero",
        traits: entry.hero.traits,
        weaponSkillId: entry.hero.skills.spear >= entry.hero.skills.sword
          ? "spear_mastery"
          : "sword_mastery",
      });
    });

    const enemyNames = ["Rift Stalker", "Rift Stalker II", "Rift Stalker III"];
    enemyNames.forEach((label, index) => {
      const stats: CombatStats = {
        attack: 28 * enemyStrength,
        defense: 8 * enemyStrength,
        maxHp: 74 * enemyStrength,
        range: 1.75,
        speed: 1.8 * Math.max(0.85, enemyStrength),
      };
      this.combatants.push({
        action: "Idle",
        actionScores: [],
        attackCooldown: 0.2 + index * 0.12,
        decisionReason: "Simple enemy behavior",
        defending: false,
        formation: "Front",
        hp: stats.maxHp,
        id: `rift-stalker-${index + 1}`,
        label,
        medicine: 0,
        personality: {
          aggression: 0.7,
          ambition: 0,
          bravery: 0.7,
          discipline: 0.45,
          empathy: 0,
          loyalty: 0,
        },
        position: { x: 7.5 + index * 0.6, z: (index - 1) * 4.2 },
        preparedSkillIds: new Set(),
        retreatLogged: false,
        relationships: {},
        role: "Skirmisher",
        stats,
        tacticalRole: "Skirmisher",
        team: "Enemy",
        traits: [],
        weaponSkillId: null,
      });
    });
    this.result = "Running";
    const formationSummary = this.combatants
      .filter((combatant) => combatant.team === "Hero")
      .map((combatant) => `${combatant.formation} ${combatant.tacticalRole}`)
      .join(" · ");
    this.addLog(`Formation locked · ${formationSummary}.`, "neutral");
    this.addLog(`${this.encounterLabel} started · 3 heroes versus 3 Rift Stalkers.`, "neutral");
    return true;
  }

  step(deltaSeconds: number): void {
    if (this.result !== "Running") {
      return;
    }
    this.accumulatorSeconds += Math.min(deltaSeconds, 0.25);
    let steps = 0;
    while (this.accumulatorSeconds >= COMBAT_TICK_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.accumulatorSeconds -= COMBAT_TICK_SECONDS;
      this.advanceTick();
      steps += 1;
    }
  }

  stop(): void {
    this.reset();
  }

  getSnapshot(): Readonly<CombatSnapshot> {
    return {
      combatants: this.combatants,
      log: this.log,
      result: this.result,
      tick: this.tick,
    };
  }

  private advanceTick(): void {
    this.tick += 1;
    this.combatants.forEach((combatant) => {
      combatant.attackCooldown = Math.max(0, combatant.attackCooldown - COMBAT_TICK_SECONDS);
      combatant.defending = false;
    });

    const plans = this.combatants
      .filter((combatant) => combatant.hp > 0)
      .map((combatant, index) => this.planAction(combatant, index));

    plans.forEach((plan) => {
      if (plan.action === "Defend" && plan.actor.action !== "Defend") {
        this.addLog(`${plan.actor.label} braced to reduce incoming damage.`, "neutral");
        this.recordCombatUsage(plan.actor, "brace", true, 2, "Braced against an immediate threat.");
      }
      if (plan.action === "Protect" && plan.actor.action !== "Protect" && plan.target) {
        this.addLog(`${plan.actor.label} moved to protect ${plan.target.label}.`, "success");
        const protectionSkill = plan.actor.preparedSkillIds.has("interpose")
          ? "interpose"
          : "protective_instinct";
        this.recordCombatUsage(
          plan.actor,
          protectionSkill,
          true,
          3,
          `Protected ${plan.target.label}.`,
        );
      }
      plan.actor.action = plan.action;
      plan.actor.defending = plan.action === "Defend" || plan.action === "Protect";
    });
    plans.forEach((plan) => this.executePlan(plan));
    this.updateResult();
  }

  private planAction(actor: Combatant, index: number): PlannedAction {
    if (actor.team === "Hero") {
      const allies = this.combatants.filter((candidate) => candidate.team === actor.team);
      const opponents = this.combatants.filter((candidate) => candidate.team !== actor.team);
      const decision = scoreCombatActions(actor, allies, opponents);
      actor.actionScores = decision.scores;
      actor.decisionReason = decision.reason;
      return {
        action: decision.action,
        actor,
        target: this.combatants.find((candidate) => candidate.id === decision.targetId) ?? null,
      };
    }
    return this.planSimpleEnemyAction(actor, index);
  }

  private planSimpleEnemyAction(actor: Combatant, index: number): PlannedAction {
    const target = this.findNearestOpponent(actor);
    if (!target) {
      return { action: "Idle", actor, target: null };
    }
    const distance = this.getDistance(actor.position, target.position);
    if (distance > actor.stats.range) {
      return { action: "Move", actor, target };
    }
    const shouldDefend =
      actor.hp / actor.stats.maxHp <= 0.52 && (this.tick + index * 5) % 32 < 6;
    return { action: shouldDefend ? "Defend" : "Attack", actor, target };
  }

  private executePlan(plan: PlannedAction): void {
    const { actor, target } = plan;
    if (actor.hp <= 0) {
      return;
    }
    if (plan.action === "Retreat") {
      actor.position.x -= actor.stats.speed * COMBAT_TICK_SECONDS;
      if (!actor.retreatLogged) {
        actor.retreatLogged = true;
        this.addLog(`${actor.label} began retreating at ${Math.ceil(actor.hp)} HP.`, "danger");
      }
      if (actor.position.x <= -15) {
        actor.position.x = -15;
      }
      return;
    }
    if (plan.action === "Move" && target) {
      this.moveToward(actor, target.position);
      return;
    }
    if (plan.action === "Reposition" && target) {
      this.moveToPreferredRange(actor, target.position);
      return;
    }
    if (plan.action === "Protect" && target && target.hp > 0) {
      if (this.getDistance(actor.position, target.position) > 1.65) {
        this.moveToward(actor, target.position);
      }
      return;
    }
    if (plan.action === "Heal" && target && target.hp > 0) {
      const healRange = Math.max(2.5, actor.stats.range);
      if (this.getDistance(actor.position, target.position) > healRange) {
        this.moveToward(actor, target.position);
        return;
      }
      if (actor.attackCooldown <= 0) {
        const healing = Math.max(5, Math.round(5 + actor.medicine * 2.5));
        const restored = Math.min(healing, target.stats.maxHp - target.hp);
        target.hp += restored;
        actor.attackCooldown = 1.1;
        this.addLog(`${actor.label} restored ${restored} HP to ${target.label}.`, "success");
        this.recordCombatUsage(
          actor,
          "field_treatment",
          restored > 0,
          4,
          `Treated ${target.label} during combat.`,
        );
      }
      return;
    }
    if (plan.action !== "Attack" || !target || target.hp <= 0 || actor.attackCooldown > 0) {
      return;
    }
    const damage = this.calculateDamage(actor, target);
    target.hp = Math.max(0, target.hp - damage);
    actor.attackCooldown = 0.75;
    this.addLog(`${actor.label} hit ${target.label} for ${damage}.`, actor.team === "Hero" ? "success" : "danger");
    if (actor.weaponSkillId) {
      this.recordCombatUsage(
        actor,
        actor.weaponSkillId,
        damage > 0,
        3,
        `Landed a weapon attack against ${target.label}.`,
        target.stats.attack / Math.max(1, actor.stats.attack),
      );
    }
    if (target.hp === 0) {
      target.action = "Dead";
      target.defending = false;
      this.addLog(`${target.label} was defeated.`, target.team === "Enemy" ? "success" : "danger");
    }
  }

  private moveToward(actor: Combatant, target: Readonly<CombatPosition>): void {
    const dx = target.x - actor.position.x;
    const dz = target.z - actor.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0) {
      return;
    }
    const distanceToMove = Math.min(actor.stats.speed * COMBAT_TICK_SECONDS, distance);
    actor.position.x += (dx / distance) * distanceToMove;
    actor.position.z += (dz / distance) * distanceToMove;
  }

  private moveToPreferredRange(actor: Combatant, target: Readonly<CombatPosition>): void {
    const dx = target.x - actor.position.x;
    const dz = target.z - actor.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0) {
      return;
    }
    const preferredRange = getPreferredRange(actor.tacticalRole);
    const direction = distance > preferredRange ? 1 : -1;
    const distanceToMove = Math.min(actor.stats.speed * COMBAT_TICK_SECONDS, Math.abs(distance - preferredRange));
    actor.position.x += (dx / distance) * distanceToMove * direction;
    actor.position.z += (dz / distance) * distanceToMove * direction;
    const maximumX = actor.tacticalRole === "Defender" ? 1.5 : 14;
    actor.position.x = Math.min(maximumX, Math.max(-14, actor.position.x));
    actor.position.z = Math.min(15, Math.max(-15, actor.position.z));
  }

  private calculateDamage(attacker: Readonly<Combatant>, target: Readonly<Combatant>): number {
    const hasProtector = this.combatants.some(
      (candidate) =>
        candidate.team === target.team &&
        candidate.id !== target.id &&
        candidate.hp > 0 &&
        candidate.action === "Protect" &&
        this.getDistance(candidate.position, target.position) <= 2.4,
    );
    const hasFrontlineCover =
      target.team === "Hero" &&
      target.formation !== "Front" &&
      this.combatants.some(
        (candidate) =>
          candidate.team === target.team &&
          candidate.tacticalRole === "Defender" &&
          candidate.hp > 0 &&
          candidate.position.x > target.position.x &&
          this.getDistance(candidate.position, target.position) <= 8,
      );
    const defenseMultiplier =
      (target.defending ? 1.65 : 1) + (hasProtector ? 0.45 : 0) + (hasFrontlineCover ? 0.3 : 0);
    const effectiveDefense = target.stats.defense * defenseMultiplier;
    return Math.max(1, Math.round(attacker.stats.attack - effectiveDefense * 0.72));
  }

  private findNearestOpponent(actor: Readonly<Combatant>): Combatant | null {
    return (
      this.combatants
        .filter(
          (candidate) =>
            candidate.team !== actor.team &&
            candidate.hp > 0 &&
            !(candidate.action === "Retreat" && candidate.position.x <= -15),
        )
        .sort(
          (left, right) =>
            this.getDistance(actor.position, left.position) -
            this.getDistance(actor.position, right.position),
        )[0] ?? null
    );
  }

  private updateResult(): void {
    const activeEnemies = this.combatants.some(
      (combatant) => combatant.team === "Enemy" && combatant.hp > 0,
    );
    const activeHeroes = this.combatants.some(
      (combatant) =>
        combatant.team === "Hero" &&
        combatant.hp > 0 &&
        !(combatant.action === "Retreat" && combatant.position.x <= -15),
    );
    if (!activeEnemies) {
      this.result = "Victory";
      this.combatants
        .filter((combatant) => combatant.hp > 0 && combatant.action !== "Retreat")
        .forEach((combatant) => {
          combatant.action = "Idle";
        });
      this.addLog(`${this.encounterLabel} victory · all hostiles defeated.`, "success");
      return;
    }
    if (!activeHeroes) {
      const anyRetreated = this.combatants.some(
        (combatant) => combatant.team === "Hero" && combatant.hp > 0,
      );
      this.result = anyRetreated ? "Withdrawn" : "Defeat";
      this.combatants
        .filter((combatant) => combatant.team === "Enemy" && combatant.hp > 0)
        .forEach((combatant) => {
          combatant.action = "Idle";
        });
      this.addLog(
        anyRetreated
          ? `The surviving heroes withdrew from the ${this.encounterLabel.toLowerCase()}.`
          : `${this.encounterLabel} defeat · no heroes remain.`,
        "danger",
      );
    }
  }

  private getHeroStats(hero: Readonly<Hero>, role: string): CombatStats {
    const weaponSkill = Math.max(hero.skills.sword, hero.skills.spear);
    const roleHp = role === "Vanguard" ? 16 : 0;
    const roleAttack = role === "Damage" ? 4 : 0;
    const roleDefense = role === "Vanguard" ? 3 : 0;
    const roleRange = role === "Support" ? 2.2 : 1.8;
    return {
      attack: 10 + hero.attributes.strength * 2 + weaponSkill * 2.5 + roleAttack,
      defense: 4 + hero.attributes.endurance + hero.skills.defense * 1.5 + roleDefense,
      maxHp: 58 + hero.attributes.endurance * 7 + hero.level * 5 + roleHp,
      range: roleRange,
      speed: 1.45 + hero.attributes.agility * 0.08,
    };
  }

  private addLog(message: string, tone: CombatLogEntry["tone"]): void {
    this.log.unshift({ id: this.nextLogId, message, tick: this.tick, tone });
    this.nextLogId += 1;
    this.log.splice(MAX_LOG_ENTRIES);
  }

  private recordCombatUsage(
    actor: Readonly<Combatant>,
    definitionId: string,
    successful: boolean,
    baseXp: number,
    reason: string,
    difficulty = 1,
  ): void {
    if (actor.team !== "Hero" || !actor.preparedSkillIds.has(definitionId)) {
      return;
    }
    const usageKey = `${actor.id}:${definitionId}`;
    const minimumTickGap = definitionId === "brace" || definitionId === "interpose" || definitionId === "protective_instinct"
      ? 20
      : 0;
    const lastUsageTick = this.lastSkillUsageTicks.get(usageKey);
    if (lastUsageTick !== undefined && this.tick - lastUsageTick < minimumTickGap) {
      return;
    }
    this.lastSkillUsageTicks.set(usageKey, this.tick);
    this.onSkillUsage({
      baseXp,
      definitionId,
      difficulty,
      heroId: actor.id,
      reason,
      source: "combat",
      successful,
    });
  }

  private getDistance(left: Readonly<CombatPosition>, right: Readonly<CombatPosition>): number {
    return Math.hypot(left.x - right.x, left.z - right.z);
  }

  private reset(): void {
    this.accumulatorSeconds = 0;
    this.combatants.splice(0);
    this.log.splice(0);
    this.lastSkillUsageTicks.clear();
    this.nextLogId = 1;
    this.result = "Idle";
    this.tick = 0;
    this.encounterLabel = "Sandbox";
  }
}
