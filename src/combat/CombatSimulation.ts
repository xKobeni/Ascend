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

interface Combatant extends CombatantSnapshot {
  attackCooldown: number;
  retreatLogged: boolean;
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
  private readonly log: CombatLogEntry[] = [];
  private nextLogId = 1;
  private result: CombatResult = "Idle";
  private tick = 0;

  start(squad: Readonly<Squad>, heroes: readonly Readonly<Hero>[]): boolean {
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
    selectedHeroes.forEach((entry, index) => {
      if (!entry) {
        return;
      }
      const lane = (index - 1) * 4.2;
      const formationX = entry.member.formation === "Front" ? -5.5 : entry.member.formation === "Middle" ? -8 : -10.5;
      this.combatants.push({
        action: "Idle",
        attackCooldown: index * 0.12,
        defending: false,
        hp: this.getHeroStats(entry.hero, entry.member.role).maxHp,
        id: entry.hero.id,
        label: entry.hero.name,
        position: { x: formationX, z: lane },
        retreatLogged: false,
        role: entry.member.role,
        stats: this.getHeroStats(entry.hero, entry.member.role),
        team: "Hero",
      });
    });

    const enemyNames = ["Rift Stalker", "Rift Stalker II", "Rift Stalker III"];
    enemyNames.forEach((label, index) => {
      const stats: CombatStats = {
        attack: 28,
        defense: 8,
        maxHp: 74,
        range: 1.75,
        speed: 1.8,
      };
      this.combatants.push({
        action: "Idle",
        attackCooldown: 0.2 + index * 0.12,
        defending: false,
        hp: stats.maxHp,
        id: `rift-stalker-${index + 1}`,
        label,
        position: { x: 7.5 + index * 0.6, z: (index - 1) * 4.2 },
        retreatLogged: false,
        role: "Skirmisher",
        stats,
        team: "Enemy",
      });
    });
    this.result = "Running";
    this.addLog("Sandbox engagement started · 3 heroes versus 3 Rift Stalkers.", "neutral");
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
      }
      plan.actor.action = plan.action;
      plan.actor.defending = plan.action === "Defend";
    });
    plans.forEach((plan) => this.executePlan(plan));
    this.updateResult();
  }

  private planAction(actor: Combatant, index: number): PlannedAction {
    if (actor.team === "Hero" && actor.hp / actor.stats.maxHp <= 0.45) {
      return { action: "Retreat", actor, target: null };
    }
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
    if (plan.action !== "Attack" || !target || target.hp <= 0 || actor.attackCooldown > 0) {
      return;
    }
    const damage = this.calculateDamage(actor, target);
    target.hp = Math.max(0, target.hp - damage);
    actor.attackCooldown = 0.75;
    this.addLog(`${actor.label} hit ${target.label} for ${damage}.`, actor.team === "Hero" ? "success" : "danger");
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

  private calculateDamage(attacker: Readonly<Combatant>, target: Readonly<Combatant>): number {
    const effectiveDefense = target.stats.defense * (target.defending ? 1.65 : 1);
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
      this.addLog("Sandbox victory · all hostiles defeated.", "success");
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
        anyRetreated ? "The surviving heroes withdrew from the sandbox." : "Sandbox defeat · no heroes remain.",
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

  private getDistance(left: Readonly<CombatPosition>, right: Readonly<CombatPosition>): number {
    return Math.hypot(left.x - right.x, left.z - right.z);
  }

  private reset(): void {
    this.accumulatorSeconds = 0;
    this.combatants.splice(0);
    this.log.splice(0);
    this.nextLogId = 1;
    this.result = "Idle";
    this.tick = 0;
  }
}
