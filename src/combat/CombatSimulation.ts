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
import { getInjuryModifiers } from "../heroes/InjurySystem";
import type { CombatMemoryEvent } from "../memories/HeroMemory";

interface Combatant extends CombatantSnapshot {
  attackCooldown: number;
  bleedDamage: number;
  bleedTicks: number;
  damageMultiplier: number;
  defense: number;
  defenseMultiplier: number;
  leadership: number;
  medicine: number;
  memories: Hero["memories"];
  personality: Hero["personality"];
  preparedSkillIds: ReadonlySet<string>;
  relationships: Hero["relationships"];
  retreatLogged: boolean;
  traits: readonly string[];
  weaponSkillId: "spear_mastery" | "sword_mastery" | null;
  attributes: Hero["attributes"];
}

interface PlannedAction {
  action: CombatAction;
  actor: Combatant;
  target: Combatant | null;
}

const COMBAT_TICK_SECONDS = 0.1;
const MAX_STEPS_PER_FRAME = 10;
const MAX_LOG_ENTRIES = 10;
const MAX_COMBAT_TICKS = 600;

export class CombatSimulation {
  private accumulatorSeconds = 0;
  private readonly combatants: Combatant[] = [];
  private focusTargetId: string | null = null;
  private focusTargetTicks = 0;
  private readonly lastSkillUsageTicks = new Map<string, number>();
  private readonly log: CombatLogEntry[] = [];
  private nextLogId = 1;
  private result: CombatResult = "Idle";
  private tick = 0;
  private encounterLabel = "Sandbox";

  constructor(
    private readonly onSkillUsage: (event: Readonly<SkillUsageEvent>) => void = () => undefined,
    private readonly onMemoryEvent: (event: Readonly<CombatMemoryEvent>) => void = () => undefined,
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
        assistBoost: 1,
        attackCooldown: index * 0.12,
        attributes: { ...entry.hero.attributes },
        berserkTicks: 0,
        bleedDamage: 0,
        bleedTicks: 0,
        buffStat: null,
        buffTicks: 0,
        damageMultiplier: 1,
        decisionReason: "Awaiting first evaluation",
        defeatedBy: null,
        defending: false,
        defense: stats.defense,
        defenseMultiplier: 1,
        flanking: 0,
        focusTargetId: null,
        focusTargetTicks: 0,
        formation: entry.member.formation,
        hardenTicks: 0,
        hasBodyBlock: false,
        hasCover: false,
        hp: stats.maxHp,
        id: entry.hero.id,
        isTaunting: false,
        kills: 0,
        label: entry.hero.name,
        leadership: entry.hero.attributes.leadership,
        medicine: entry.hero.skills.medicine,
        memories: entry.hero.memories,
        panicTicks: 0,
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
        stunTicks: 0,
        suppressTicks: 0,
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
        assistBoost: 1,
        attackCooldown: 0.2 + index * 0.12,
        attributes: {
          agility: 3,
          endurance: 3,
          intelligence: 2,
          leadership: 0,
          strength: 4,
          willpower: 3,
        },
        berserkTicks: 0,
        bleedDamage: 0,
        bleedTicks: 0,
        buffStat: null,
        buffTicks: 0,
        damageMultiplier: 1,
        decisionReason: "Simple enemy behavior",
        defeatedBy: null,
        defending: false,
        defense: stats.defense,
        defenseMultiplier: 1,
        flanking: 0,
        focusTargetId: null,
        focusTargetTicks: 0,
        formation: "Front",
        hardenTicks: 0,
        hasBodyBlock: false,
        hasCover: false,
        hp: stats.maxHp,
        id: `rift-stalker-${index + 1}`,
        isTaunting: false,
        kills: 0,
        label,
        leadership: 0,
        medicine: 0,
        memories: [],
        panicTicks: 0,
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
        stunTicks: 0,
        suppressTicks: 0,
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

    // Process focus target decay
    if (this.focusTargetTicks > 0) {
      this.focusTargetTicks -= 1;
      if (this.focusTargetTicks === 0) this.focusTargetId = null;
    }

    this.combatants.forEach((combatant) => {
      combatant.attackCooldown = Math.max(0, combatant.attackCooldown - COMBAT_TICK_SECONDS);
      combatant.defending = false;

      // Process status effect ticks
      if (combatant.bleedTicks > 0 && combatant.hp > 0) {
        const bleedDmg = Math.max(1, Math.round(combatant.bleedDamage));
        combatant.hp = Math.max(0, combatant.hp - bleedDmg);
        combatant.bleedTicks -= 1;
        this.addLog(`${combatant.label} bleeds for ${bleedDmg}.`, combatant.team === "Hero" ? "danger" : "success");
        if (combatant.hp === 0) {
          combatant.action = "Dead";
          combatant.defeatedBy = "Bleed";
          combatant.defending = false;
          this.addLog(`${combatant.label} bled out.`, combatant.team === "Enemy" ? "success" : "danger");
        }
      }

      // Stun — skip all actions
      if (combatant.stunTicks > 0 && combatant.hp > 0) {
        combatant.stunTicks -= 1;
        combatant.action = "Idle";
        combatant.attackCooldown = 1.5;
        return;
      }

      // Panic — random uncontrollable actions
      if (combatant.panicTicks > 0 && combatant.hp > 0) {
        combatant.panicTicks -= 1;
        const roll = Math.random();
        if (roll < 0.5) {
          const nearest = this.findNearestOpponent(combatant);
          if (nearest) {
            combatant.action = "Attack";
            this.executeAttack(combatant, nearest);
          }
        } else if (roll < 0.8) {
          combatant.position.x -= combatant.stats.speed * 2.0 * COMBAT_TICK_SECONDS;
          if (!combatant.retreatLogged) {
            combatant.retreatLogged = true;
            this.addLog(`${combatant.label} panicked and fled!`, combatant.team === "Hero" ? "danger" : "success");
          }
        }
        return;
      }

      // Suppress — reduce damage output
      if (combatant.suppressTicks > 0 && combatant.hp > 0) {
        combatant.suppressTicks -= 1;
        combatant.damageMultiplier = 0.8;
      } else {
        combatant.damageMultiplier = 1;
      }

      // Buff — enhance stat
      if (combatant.buffTicks > 0 && combatant.hp > 0) {
        combatant.buffTicks -= 1;
      }

      // Berserk — enhance attack, reduce defense
      if (combatant.berserkTicks > 0 && combatant.hp > 0) {
        combatant.berserkTicks -= 1;
        combatant.damageMultiplier *= 1.3;
        combatant.defenseMultiplier = 0.7;
        if (combatant.berserkTicks === 0) combatant.defenseMultiplier = 1;
      }

      // Flanking bonus
      if (combatant.flanking > 0 && combatant.hp > 0) {
        combatant.flanking -= 1;
      }

      // Hardened (Taunt/Hesitate) — extra defense
      if (combatant.hardenTicks > 0 && combatant.hp > 0) {
        combatant.hardenTicks -= 1;
      }

      // Taunt expires
      if (combatant.isTaunting && combatant.hardenTicks === 0) {
        combatant.isTaunting = false;
      }

      // Assist boost decays
      if (combatant.assistBoost > 1) {
        combatant.assistBoost = 1;
      }
    });

    // Reaction processing: BodyBlock, TakeCover, Evade
    this.combatants.forEach((combatant) => {
      if (combatant.hp <= 0 || combatant.team !== "Hero") return;

      // Auto-activate cover if targeted by ranged
      const targetedByRanged = this.combatants.some(
        (c) => c.team !== combatant.team && c.hp > 0 &&
          c.stats.range > 3 && c.action === "Attack" &&
          this.getDistance(c.position, combatant.position) > 3,
      );
      combatant.hasCover = targetedByRanged && combatant.tacticalRole !== "Defender";
    });

    // Process enemies trying to taunt
    this.combatants.forEach((combatant) => {
      if (combatant.hp <= 0) return;
      if (combatant.isTaunting && combatant.team === "Enemy") {
        // Force heroes to target taunting enemies
        this.combatants
          .filter((c) => c.team === "Hero" && c.hp > 0 && c.action === "Attack")
          .forEach((hero) => {
            if (this.getDistance(hero.position, combatant.position) <= 6) {
              hero.focusTargetId = combatant.id;
              hero.focusTargetTicks = 1;
            }
          });
      }
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
        this.recordMemoryEvent(plan.actor, plan.target, "PROTECTED_ALLY");
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
      if (plan.action === "Taunt" && plan.actor.action !== "Taunt") {
        this.addLog(`${plan.actor.label} taunted enemies to attack them!`, "neutral");
        plan.actor.isTaunting = true;
        plan.actor.hardenTicks = 3;
      }
      if (plan.action === "Berserk" && plan.actor.action !== "Berserk") {
        this.addLog(`${plan.actor.label} enters a berserk rage!`, "danger");
        plan.actor.berserkTicks = 3;
        this.recordCombatUsage(plan.actor, "berserk_rage", true, 3, "Entered berserk rage.");
      }
      if (plan.action === "Hesitate" && plan.actor.action !== "Hesitate") {
        this.addLog(`${plan.actor.label} hesitates, steeling their defenses.`, "neutral");
        plan.actor.hardenTicks = 2;
      }
      if (plan.action === "Flee" && plan.actor.action !== "Flee") {
        if (!plan.actor.retreatLogged) {
          plan.actor.retreatLogged = true;
          this.addLog(`${plan.actor.label} panicked and fled!`, "danger");
        }
      }
      if (plan.action === "FocusTarget" && plan.actor.action !== "FocusTarget" && plan.target) {
        this.focusTargetId = plan.target.id;
        this.focusTargetTicks = 4;
        this.addLog(`${plan.actor.label} designated ${plan.target.label} as priority target.`, "success");
      }
      if (plan.action === "Assist" && plan.actor.action !== "Assist" && plan.target) {
        plan.target.assistBoost = 1.2;
        this.addLog(`${plan.actor.label} prepared to assist ${plan.target.label}.`, "success");
        this.recordMemoryEvent(plan.actor, plan.target, "ASSISTED_ALLY");
      }
      if (plan.action === "Regroup" && plan.actor.action !== "Regroup") {
        this.addLog(`${plan.actor.label} is regrouping with allies.`, "neutral");
        this.recordCombatUsage(plan.actor, "regroup", true, 1, "Regrouping with squad.");
      }
      if (plan.action === "MaintainFormation" && plan.actor.action !== "MaintainFormation") {
        this.addLog(`${plan.actor.label} returns to formation position.`, "neutral");
      }
      if (plan.action === "FollowLeader" && plan.actor.action !== "FollowLeader") {
        this.addLog(`${plan.actor.label} follows the squad leader.`, "neutral");
      }
      if (plan.action === "Flank" && plan.actor.action !== "Flank") {
        this.addLog(`${plan.actor.label} moves to flank the enemy.`, "success");
        plan.actor.flanking = 3;
        this.recordCombatUsage(plan.actor, "flanking_manoeuvre", true, 2, "Flanking manoeuvre.");
      }
      if (plan.action === "Kite" && plan.actor.action !== "Kite") {
        this.addLog(`${plan.actor.label} kites to maintain range.`, "neutral");
      }
      if (plan.action === "FallBack" && plan.actor.action !== "FallBack") {
        this.addLog(`${plan.actor.label} falls back tactically.`, "neutral");
      }
      if (plan.action === "Advance" && plan.actor.action !== "Advance") {
        this.addLog(`${plan.actor.label} advances aggressively.`, "success");
      }
      if (plan.action === "Recover" && plan.actor.action !== "Recover") {
        const healing = Math.max(8, Math.round(8 + plan.actor.stats.defense * 0.3 + plan.actor.personality.discipline * 2));
        const restored = Math.min(healing, plan.actor.stats.maxHp - plan.actor.hp);
        plan.actor.hp += restored;
        plan.actor.attackCooldown = 1.5;
        this.addLog(`${plan.actor.label} recovered ${restored} HP.`, "success");
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
      const decision = scoreCombatActions(
        actor as unknown as import("./UtilityAI").UtilityActor,
        allies as unknown as import("./UtilityAI").UtilityTarget[],
        opponents as unknown as import("./UtilityAI").UtilityTarget[],
      );
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

    // Flank — try to move around frontline to attack backline
    if (distance <= 4 && Math.random() < 0.2 && actor.stats.speed > 1.5) {
      const backline = this.combatants.find(c =>
        c.team !== actor.team && c.hp > 0 && c.formation === "Back",
      );
      if (backline) {
        return { action: "Flank", actor, target: backline };
      }
    }

    // Taunt — high aggression enemies challenge
    if (actor.personality.aggression > 0.7 && distance <= 3 && actor.hp / actor.stats.maxHp > 0.5) {
      return { action: "Taunt", actor, target };
    }

    // Regroup — pull back when isolated
    const nearbyAllies = this.combatants.filter(c =>
      c.team === actor.team && c.hp > 0 && this.getDistance(c.position, actor.position) < 6,
    );
    if (nearbyAllies.length === 0 && actor.hp / actor.stats.maxHp < 0.6) {
      return { action: "Regroup", actor, target: null };
    }

    // Defend periodically when low
    const health = actor.hp / actor.stats.maxHp;
    if (distance <= actor.stats.range) {
      const shouldDefend = health <= 0.52 && (this.tick + index * 5) % 32 < 6;
      return { action: shouldDefend ? "Defend" : "Attack", actor, target };
    }

    return { action: "Move", actor, target };
  }

  private executePlan(plan: PlannedAction): void {
    const { actor, target } = plan;
    if (actor.hp <= 0) {
      return;
    }

    // ── Retreat ──
    if (plan.action === "Retreat") {
      actor.position.x -= actor.stats.speed * COMBAT_TICK_SECONDS;
      if (!actor.retreatLogged) {
        actor.retreatLogged = true;
        this.addLog(`${actor.label} began retreating at ${Math.ceil(actor.hp)} HP.`, "danger");
      }
      if (actor.position.x <= -15) actor.position.x = -15;
      return;
    }

    // ── Flee (panic-driven, faster than Retreat) ──
    if (plan.action === "Flee") {
      actor.position.x -= actor.stats.speed * 2.0 * COMBAT_TICK_SECONDS;
      if (!actor.retreatLogged) {
        actor.retreatLogged = true;
        this.addLog(`${actor.label} panicked and fled!`, "danger");
      }
      if (actor.position.x <= -15) actor.position.x = -15;
      return;
    }

    // ── Move ──
    if (plan.action === "Move" && target) {
      this.moveToward(actor, target.position);
      return;
    }

    // ── Reposition (move to preferred range) ──
    if (plan.action === "Reposition" && target) {
      this.moveToPreferredRange(actor, target.position);
      return;
    }

    // ── Protect ──
    if (plan.action === "Protect" && target && target.hp > 0) {
      if (this.getDistance(actor.position, target.position) > 1.65) {
        this.moveToward(actor, target.position);
      }
      return;
    }

    // ── Heal ──
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

        // Cleanse: remove one negative effect
        if (target.stunTicks > 0) {
          target.stunTicks = 0;
          this.addLog(`${actor.label} cleansed ${target.label}'s stun.`, "success");
        } else if (target.suppressTicks > 0) {
          target.suppressTicks = 0;
          this.addLog(`${actor.label} cleansed ${target.label}'s suppression.`, "success");
        } else if (target.bleedTicks > 0) {
          target.bleedTicks = 0;
          this.addLog(`${actor.label} cleansed ${target.label}'s bleed.`, "success");
        }

        if (restored > 0) {
          this.recordMemoryEvent(actor, target, "HEALED_ALLY");
        }
        this.recordCombatUsage(actor, "field_treatment", restored > 0, 4, `Treated ${target.label} during combat.`);
      }
      return;
    }

    // ── Advance (fast approach) ──
    if (plan.action === "Advance" && target) {
      const speed = actor.stats.speed * 1.5;
      const dx = target.position.x - actor.position.x;
      const dz = target.position.z - actor.position.z;
      const dist = Math.hypot(dx, dz);
      const step = Math.min(speed * COMBAT_TICK_SECONDS, Math.max(0, dist - 2.0));
      if (dist > 0) {
        actor.position.x += (dx / dist) * step;
        actor.position.z += (dz / dist) * step;
      }
      return;
    }

    // ── FallBack (tactical withdrawal) ──
    if (plan.action === "FallBack") {
      actor.position.x -= actor.stats.speed * 0.8 * COMBAT_TICK_SECONDS;
      return;
    }

    // ── Flank (lateral movement) ──
    if (plan.action === "Flank" && target) {
      const dz = target.position.z - actor.position.z;
      const sign = dz >= 0 ? -1 : 1;
      const step = Math.min(actor.stats.speed * 1.2 * COMBAT_TICK_SECONDS, 4);
      actor.position.z += sign * step;
      return;
    }

    // ── Kite (maintain range while retreating) ──
    if (plan.action === "Kite" && target) {
      const preferredRange = getPreferredRange(actor.tacticalRole);
      const dist = this.getDistance(actor.position, target.position);
      if (dist < preferredRange) {
        const dx = target.position.x - actor.position.x;
        const dz = target.position.z - actor.position.z;
        const distH = Math.hypot(dx, dz);
        if (distH > 0) {
          const step = Math.min(actor.stats.speed * 0.6 * COMBAT_TICK_SECONDS, Math.max(0, dist - preferredRange));
          actor.position.x -= (dx / distH) * step;
          actor.position.z -= (dz / distH) * step;
        }
      }
      return;
    }

    // ── Taunt ──
    if (plan.action === "Taunt") {
      actor.isTaunting = true;
      actor.hardenTicks = 3;
      return;
    }

    // ── Berserk ──
    if (plan.action === "Berserk") {
      actor.berserkTicks = 3;
      return;
    }

    // ── Hesitate ──
    if (plan.action === "Hesitate") {
      actor.hardenTicks = 2;
      actor.attackCooldown = 1.5;
      return;
    }

    // ── FocusTarget ──
    if (plan.action === "FocusTarget" && target) {
      this.focusTargetId = target.id;
      this.focusTargetTicks = 4;
      return;
    }

    // ── Assist ──
    if (plan.action === "Assist" && target && target.hp > 0) {
      target.assistBoost = 1.2;
      return;
    }

    // ── Recover (self-heal) ──
    if (plan.action === "Recover") {
      const healing = Math.max(8, Math.round(8 + actor.stats.defense * 0.3 + actor.personality.discipline * 2));
      const restored = Math.min(healing, actor.stats.maxHp - actor.hp);
      actor.hp += restored;
      actor.attackCooldown = 1.5;
      if (restored > 0) {
        this.addLog(`${actor.label} recovered ${restored} HP.`, "success");
      }
      return;
    }

    // ── Regroup (move toward ally center) ──
    if (plan.action === "Regroup") {
      const allies = this.combatants.filter(c => c.team === actor.team && c.hp > 0 && c.id !== actor.id);
      if (allies.length > 0) {
        const avgX = allies.reduce((s, a) => s + a.position.x, 0) / allies.length;
        const avgZ = allies.reduce((s, a) => s + a.position.z, 0) / allies.length;
        this.moveToward(actor, { x: avgX, z: avgZ });
      }
      return;
    }

    // ── MaintainFormation ──
    if (plan.action === "MaintainFormation") {
      const lane = this.combatants.filter(c => c.team === actor.team).indexOf(actor);
      const targetPos = getFormationStart(actor.formation as "Front" | "Middle" | "Back", (lane - 1) * 4.2);
      this.moveToward(actor, targetPos);
      return;
    }

    // ── FollowLeader ──
    if (plan.action === "FollowLeader") {
      const leader = this.combatants
        .filter(c => c.team === actor.team && c.hp > 0 && c.id !== actor.id && c.leadership > actor.leadership)
        .sort((a, b) => b.leadership - a.leadership)[0];
      if (leader) this.moveToward(actor, leader.position);
      return;
    }

    // ── BodyBlock (react to ally being targeted) ──
    if (plan.action === "BodyBlock" && target && target.hp > 0) {
      if (this.getDistance(actor.position, target.position) > 1.5) {
        this.moveToward(actor, target.position);
      }
      actor.hasBodyBlock = true;
      return;
    }

    // ── RescueAlly (move to intercept) ──
    if (plan.action === "RescueAlly" && target && target.hp > 0) {
      this.moveToward(actor, target.position);
      actor.hasBodyBlock = true;
      return;
    }

    // ── UseSkill ──
    if (plan.action === "UseSkill" && target) {
      // Interrupt check
      const interrupters = this.combatants.filter(c =>
        c.team !== actor.team && c.hp > 0 &&
        c.preparedSkillIds.has("interrupt_skill") &&
        this.getDistance(c.position, actor.position) <= 4,
      );
      if (interrupters.length > 0 && Math.random() < 0.4) {
        const interrupter = interrupters[0];
        if (interrupter) this.addLog(`${interrupter.label} interrupted ${actor.label}!`, "danger");
        return;
      }
      const skillId = this.chooseBestSkill(actor, target);
      if (skillId) {
        this.executeSkill(actor, target, skillId);
        return;
      }
      // Fallback to Attack
      plan.action = "Attack";
    }

    // ── UseUltimate (mastered skill at 2x power) ──
    if (plan.action === "UseUltimate" && target) {
      const mastered = [...actor.preparedSkillIds].find(id => {
        const def = skillDefinitionRegistry.get(id);
        return def && def.type === "active";
      });
      if (mastered) {
        this.executeSkill(actor, target, mastered, 2.0);
        this.addLog(`${actor.label} used ${mastered} at full power!`, "success");
        return;
      }
      plan.action = "Attack";
    }

    // ── SwitchWeapon ──
    if (plan.action === "SwitchWeapon") {
      const alt = actor.weaponSkillId === "sword_mastery" ? "spear_mastery" : "sword_mastery";
      actor.weaponSkillId = alt;
      this.addLog(`${actor.label} switched to ${alt === "sword_mastery" ? "sword" : "spear"}.`, "neutral");
      actor.attackCooldown = 0.5;
      return;
    }

    // ── CounterAttack (free attack after parry/brace) ──
    if (plan.action === "CounterAttack" && target && target.hp > 0) {
      if (actor.attackCooldown <= 0) {
        const counterDmg = Math.round(this.calculateDamage(actor, target) * 0.8);
        target.hp = Math.max(0, target.hp - counterDmg);
        this.addLog(`${actor.label} counter-attacked ${target.label} for ${counterDmg}!`, "success");
        actor.attackCooldown = 0.75;
        if (target.hp === 0) {
          target.action = "Dead";
          target.defeatedBy = actor.label;
          actor.kills += 1;
          this.addLog(`${target.label} was defeated.`, target.team === "Enemy" ? "success" : "danger");
        }
      }
      return;
    }

    // ── Revive (placeholder for future skill/item system) ──
    // if (plan.action === "Revive" && target && target.hp <= 0) {
    //   target.hp = 1;
    //   target.action = "Idle";
    //   target.defeatedBy = null;
    //   this.addLog(`${actor.label} revived ${target.label}!`, "success");
    //   this.recordMemoryEvent(actor, target, "REVIVED_ALLY");
    //   return;
    // }

    // ── Attack ──
    if (plan.action !== "Attack" || !target || target.hp <= 0 || actor.attackCooldown > 0) {
      return;
    }

    // Evade check
    if (target.action !== "Defend" && target.stunTicks === 0) {
      const evadeChance = this.evadeChance(target, actor);
      if (Math.random() < evadeChance) {
        this.addLog(`${target.label} evaded the attack!`, "neutral");
        actor.attackCooldown = 0.75;
        return;
      }
    }

    this.executeAttack(actor, target);
  }

  private executeAttack(actor: Combatant, target: Combatant): void {
    if (actor.hp <= 0 || target.hp <= 0 || actor.attackCooldown > 0) return;

    // BodyBlock: redirect 50% damage to body blocker
    let actualTarget = target;
    let redirectedTo: Combatant | null = null;
    if (target.team === "Hero") {
      const bodyBlocker = this.combatants.find(c =>
        c.team === target.team && c.hp > 0 && c.hasBodyBlock &&
        c.id !== target.id && this.getDistance(c.position, target.position) <= 1.5,
      );
      if (bodyBlocker) {
        redirectedTo = bodyBlocker;
      }
    }

    const damage = this.calculateDamage(actor, actualTarget);
    const finalDamage = Math.round(damage * (actor.damageMultiplier ?? 1));

    // TakeCover: -40% ranged damage
    let reducedDamage = finalDamage;
    if (actualTarget.hasCover && this.getDistance(actor.position, actualTarget.position) > 3 && actor.stats.range > 3) {
      reducedDamage = Math.round(finalDamage * 0.6);
    }

    actualTarget.hp = Math.max(0, actualTarget.hp - reducedDamage);
    actor.attackCooldown = 0.75;

    // Flanking bonus log
    if (actor.flanking > 0) {
      this.addLog(`${actor.label} flanks for +15% damage!`, "success");
    }

    // Focus target bonus
    if (this.focusTargetId === actualTarget.id && this.focusTargetTicks > 0 && actor.team === "Hero") {
      this.addLog(`${actor.label} strikes the focus target!`, "success");
    }

    // Assist bonus log
    if ((actor.assistBoost ?? 1) > 1) {
      this.addLog(`${actor.label} attacks with assistance!`, "success");
    }

    this.addLog(`${actor.label} hit ${actualTarget.label} for ${reducedDamage}.`, actor.team === "Hero" ? "success" : "danger");

    // BodyBlock damage
    if (redirectedTo && reducedDamage > 0) {
      const blockDmg = Math.round(reducedDamage * 0.5);
      redirectedTo.hp = Math.max(0, redirectedTo.hp - blockDmg);
      this.addLog(`${redirectedTo.label} blocked ${blockDmg} damage for ${actualTarget.label}!`, "success");
      if (redirectedTo.hp === 0) {
        redirectedTo.action = "Dead";
        redirectedTo.defeatedBy = actor.label;
        this.addLog(`${redirectedTo.label} was defeated.`, "danger");
      }
    }

    // Bleed chance on hit
    if (reducedDamage > 0 && actualTarget.hp > 0 && !actualTarget.bleedTicks) {
      const bleedChance = Math.min(0.15, 0.05 + (actor.stats.attack * 0.002));
      if (Math.random() < bleedChance) {
        const bleedDamage = Math.max(1, Math.round(actor.stats.attack * 0.08));
        actualTarget.bleedDamage = bleedDamage;
        actualTarget.bleedTicks = 3;
        this.addLog(`${actualTarget.label} starts bleeding!`, actor.team === "Hero" ? "success" : "danger");
      }
    }

    if (actor.weaponSkillId) {
      this.recordCombatUsage(
        actor,
        actor.weaponSkillId,
        reducedDamage > 0,
        3,
        `Landed a weapon attack against ${actualTarget.label}.`,
        actualTarget.stats.attack / Math.max(1, actor.stats.attack),
      );
    }
    if (actualTarget.hp === 0) {
      actualTarget.action = "Dead";
      actualTarget.defeatedBy = actor.label;
      actualTarget.defending = false;
      actor.kills += 1;
      this.addLog(`${actualTarget.label} was defeated.`, actualTarget.team === "Enemy" ? "success" : "danger");
    }
  }

  private executeSkill(actor: Combatant, target: Combatant, skillId: string, multiplier = 1.0): void {
    if (actor.attackCooldown > 0) return;
    const def = skillDefinitionRegistry.get(skillId);
    if (!def) return;
    const damage = Math.round(this.calculateDamage(actor, target) * multiplier * (actor.damageMultiplier ?? 1));
    target.hp = Math.max(0, target.hp - damage);
    actor.attackCooldown = 1.2;
    this.addLog(`${actor.label} used ${skillId} on ${target.label} for ${damage}!`, actor.team === "Hero" ? "success" : "danger");
    this.recordCombatUsage(actor, skillId, damage > 0, 4, `Used ${skillId} on ${target.label}.`);
    if (target.hp === 0) {
      target.action = "Dead";
      target.defeatedBy = actor.label;
      actor.kills += 1;
      this.addLog(`${target.label} was defeated.`, target.team === "Enemy" ? "success" : "danger");
    }
  }

  private chooseBestSkill(actor: Combatant, _target: Combatant): string | null {
    const actives = [...actor.preparedSkillIds].filter(id => {
      const def = skillDefinitionRegistry.get(id);
      return def && def.type === "active";
    });
    if (actives.length === 0) return null;
    // Pick lowest cooldown or highest value skill
    return actives[0] ?? null;
  }

  private evadeChance(dodger: Readonly<Combatant>, attacker: Readonly<Combatant>): number {
    const agilityDiff = (dodger.attributes.agility - attacker.attributes.agility) * 0.03;
    return Math.min(0.35, Math.max(0, 0.08 + agilityDiff + (dodger.action === "Reposition" ? 0.12 : 0)));
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

    // Defense multiplier from actions
    let defenseMultiplier = (target.defending ? 1.65 : 1);
    if (hasProtector) defenseMultiplier += 0.45;
    if (hasFrontlineCover) defenseMultiplier += 0.3;
    // Taunt/Hesitate hardened bonus
    if (target.hardenTicks > 0) defenseMultiplier += target.isTaunting ? 0.35 : 0.40;
    // Berserk defense penalty for attacker (applied to target's effective defense)
    const attackerBerserkPenalty = attacker.berserkTicks > 0 ? 0.7 : 1;

    const effectiveDefense = target.stats.defense * defenseMultiplier * attackerBerserkPenalty;

    let baseDamage = Math.max(1, Math.round(attacker.stats.attack - effectiveDefense * 0.72));

    // Flanking bonus: +15%
    if (attacker.flanking > 0) baseDamage = Math.round(baseDamage * 1.15);

    // Berserk attack bonus already handled by damageMultiplier in executeAttack

    // Focus target bonus: +15%
    if (this.focusTargetId === target.id && this.focusTargetTicks > 0 && attacker.team === "Hero") {
      baseDamage = Math.round(baseDamage * 1.15);
    }

    // Assist boost
    if ((attacker.assistBoost ?? 1) > 1) {
      baseDamage = Math.round(baseDamage * attacker.assistBoost);
    }

    // Taunt forces attacker to target taunter (handled in advanceTick)

    return baseDamage;
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
      return;
    }
    if (this.tick >= MAX_COMBAT_TICKS) {
      this.result = "Withdrawn";
      this.combatants
        .filter((combatant) => combatant.hp > 0)
        .forEach((combatant) => {
          combatant.action = "Idle";
        });
      this.addLog(
        `The ${this.encounterLabel.toLowerCase()} reached a stalemate. The squad withdrew before it was surrounded.`,
        "danger",
      );
    }
  }

  private getHeroStats(hero: Readonly<Hero>, role: string): CombatStats {
    const injury = getInjuryModifiers(hero);
    const weaponSkill = Math.max(hero.skills.sword, hero.skills.spear);
    const roleHp = role === "Vanguard" ? 16 : 0;
    const roleAttack = role === "Damage" ? 4 : 0;
    const roleDefense = role === "Vanguard" ? 3 : 0;
    const roleRange = role === "Support" ? 2.2 : 1.8;
    return {
      attack: (10 + hero.attributes.strength * 2 + weaponSkill * 2.5 + roleAttack) * injury.attack,
      defense: (4 + hero.attributes.endurance + hero.skills.defense * 1.5 + roleDefense) * injury.defense,
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

  private recordMemoryEvent(
    actor: Readonly<Combatant>,
    target: Readonly<Combatant>,
    type: CombatMemoryEvent["type"],
  ): void {
    if (actor.team === "Hero" && target.team === "Hero") {
      this.onMemoryEvent({ actorId: actor.id, targetId: target.id, type });
    }
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
