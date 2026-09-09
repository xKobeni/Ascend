import type { Personality, RelationshipProfile } from "../heroes/Hero";
import type {
  ActionScoreSnapshot,
  CombatAction,
  CombatPosition,
  CombatStats,
  UtilityAction,
} from "./Combat";

export interface UtilityTarget {
  action: CombatAction;
  hp: number;
  id: string;
  position: Readonly<CombatPosition>;
  stats: Readonly<CombatStats>;
}

export interface UtilityActor extends UtilityTarget {
  medicine: number;
  personality: Readonly<Personality>;
  relationships: Readonly<Record<string, Readonly<RelationshipProfile>>>;
  role: string;
  traits: readonly string[];
}

export interface UtilityDecision {
  action: UtilityAction;
  reason: string;
  scores: readonly Readonly<ActionScoreSnapshot>[];
  targetId: string | null;
}

const ACTION_ORDER: readonly UtilityAction[] = [
  "Attack",
  "Defend",
  "Retreat",
  "Protect",
  "Heal",
  "Reposition",
];

export function scoreCombatActions(
  actor: Readonly<UtilityActor>,
  allies: readonly Readonly<UtilityTarget>[],
  opponents: readonly Readonly<UtilityTarget>[],
): UtilityDecision {
  const livingAllies = allies.filter((ally) => ally.hp > 0 && ally.action !== "Retreat");
  const livingOpponents = opponents.filter((opponent) => opponent.hp > 0 && opponent.action !== "Retreat");
  const nearestEnemy = nearest(actor.position, livingOpponents);
  const vulnerableAlly = [...livingAllies]
    .filter((ally) => ally.id !== actor.id)
    .sort((left, right) => allyDanger(right, livingOpponents) - allyDanger(left, livingOpponents))[0] ?? null;
  const woundedAlly = [...livingAllies]
    .filter((ally) => ally.hp / ally.stats.maxHp < 0.92)
    .sort((left, right) => left.hp / left.stats.maxHp - right.hp / right.stats.maxHp)[0] ?? null;

  const health = ratio(actor.hp, actor.stats.maxHp);
  const missingHealth = 1 - health;
  const enemyDistance = nearestEnemy ? distance(actor.position, nearestEnemy.position) : Number.POSITIVE_INFINITY;
  const proximity = nearestEnemy ? clamp01(1 - enemyDistance / 12) : 0;
  const threat = nearestEnemy ? clamp01(nearestEnemy.stats.attack / Math.max(1, actor.stats.defense * 3.2)) : 0;
  const bravery = actor.personality.bravery;
  const aggression = actor.personality.aggression;
  const discipline = actor.personality.discipline;
  const empathy = actor.personality.empathy;
  const loyalty = actor.personality.loyalty;
  const isProtective = actor.traits.includes("Protective");
  const isCowardly = actor.traits.includes("Cowardly");
  const isReckless = actor.traits.includes("Reckless");
  const allyRisk = vulnerableAlly ? allyDanger(vulnerableAlly, livingOpponents) : 0;
  const bond = vulnerableAlly ? relationshipBond(actor.relationships[vulnerableAlly.id]) : 0;
  const woundedRatio = woundedAlly ? 1 - ratio(woundedAlly.hp, woundedAlly.stats.maxHp) : 0;

  const raw: Record<UtilityAction, { reason: string; score: number; targetId: string | null; valid: boolean }> = {
    Attack: {
      reason: dominantReason([
        [aggression * 24, "aggression"],
        [bravery * 18, "bravery"],
        [actor.role === "Damage" ? 22 : 0, "damage role"],
        [proximity * 18, "close target"],
      ]),
      score: 24 + aggression * 24 + bravery * 18 + (actor.role === "Damage" ? 22 : 0) + proximity * 18 + (isReckless ? 9 : 0),
      targetId: nearestEnemy?.id ?? null,
      valid: Boolean(nearestEnemy && enemyDistance <= actor.stats.range),
    },
    Defend: {
      reason: dominantReason([
        [missingHealth * 42, "low health"],
        [threat * 24, "enemy threat"],
        [discipline * 18, "discipline"],
        [actor.role === "Vanguard" ? 12 : 0, "vanguard role"],
      ]),
      score: 10 + missingHealth * 42 + threat * 24 + discipline * 18 + (actor.role === "Vanguard" ? 12 : 0),
      targetId: null,
      valid: Boolean(nearestEnemy && enemyDistance <= actor.stats.range * 1.35),
    },
    Retreat: {
      reason: dominantReason([
        [missingHealth * 72, "low health"],
        [(1 - bravery) * 34, "low bravery"],
        [threat * 16, "enemy threat"],
        [isCowardly ? 16 : 0, "cowardly trait"],
      ]),
      score: 2 + missingHealth * 72 + (1 - bravery) * 34 + threat * 16 + (isCowardly ? 16 : 0) - loyalty * 8,
      targetId: null,
      valid: Boolean(
        nearestEnemy &&
        (health <= (isCowardly ? 0.82 : 0.68) || (threat >= 0.92 && health < 0.9)),
      ),
    },
    Protect: {
      reason: dominantReason([
        [allyRisk * 44, "ally in danger"],
        [bond * 24, "relationship bond"],
        [empathy * 18, "empathy"],
        [loyalty * 16, "loyalty"],
        [isProtective ? 22 : 0, "protective trait"],
      ]),
      score: 4 + allyRisk * 44 + bond * 24 + empathy * 18 + loyalty * 16 + (isProtective ? 22 : 0) + (actor.role === "Vanguard" ? 12 : 0),
      targetId: vulnerableAlly?.id ?? null,
      valid: Boolean(vulnerableAlly && (allyRisk >= 0.3 || isProtective)),
    },
    Heal: {
      reason: dominantReason([
        [woundedRatio * 62, "wounded ally"],
        [actor.medicine * 5, "medicine skill"],
        [actor.role === "Support" ? 30 : 0, "support role"],
        [empathy * 14, "empathy"],
      ]),
      score: woundedRatio * 62 + actor.medicine * 5 + (actor.role === "Support" ? 30 : 0) + empathy * 14,
      targetId: woundedAlly?.id ?? null,
      valid: Boolean(woundedAlly && actor.medicine > 0),
    },
    Reposition: {
      reason: dominantReason([
        [Math.min(enemyDistance, 12) * 4.6, "target distance"],
        [actor.personality.discipline * 14, "discipline"],
        [actor.stats.speed * 5, "mobility"],
      ]),
      score: 34 + Math.min(enemyDistance, 12) * 4.6 + actor.personality.discipline * 14 + actor.stats.speed * 5,
      targetId: nearestEnemy?.id ?? null,
      valid: Boolean(nearestEnemy && enemyDistance > actor.stats.range * 0.9),
    },
  };

  const scores = ACTION_ORDER.map((action) => ({
    action,
    reason: raw[action].reason,
    score: Math.round(clamp(raw[action].score, 0, 100)),
    valid: raw[action].valid,
  }));
  const chosen = [...scores]
    .filter((entry) => entry.valid)
    .sort((left, right) => right.score - left.score || ACTION_ORDER.indexOf(left.action) - ACTION_ORDER.indexOf(right.action))[0];
  const action = chosen?.action ?? "Defend";
  return {
    action,
    reason: chosen ? `${chosen.reason} · ${chosen.score}` : "no valid action",
    scores,
    targetId: raw[action].targetId,
  };
}

function allyDanger(ally: Readonly<UtilityTarget>, opponents: readonly Readonly<UtilityTarget>[]): number {
  const healthRisk = 1 - ratio(ally.hp, ally.stats.maxHp);
  const closest = nearest(ally.position, opponents);
  const proximityRisk = closest ? clamp01(1 - distance(ally.position, closest.position) / 8) : 0;
  return healthRisk * 0.72 + proximityRisk * 0.28;
}

function relationshipBond(profile: Readonly<RelationshipProfile> | undefined): number {
  if (!profile) {
    return 0;
  }
  return clamp01(
    ((profile.metrics.affinity + 100) / 200) * 0.35 +
      (profile.metrics.trust / 100) * 0.4 +
      (profile.metrics.respect / 100) * 0.25,
  );
}

function nearest<T extends UtilityTarget>(position: Readonly<CombatPosition>, targets: readonly Readonly<T>[]): Readonly<T> | null {
  return [...targets].sort((left, right) => distance(position, left.position) - distance(position, right.position))[0] ?? null;
}

function dominantReason(factors: readonly (readonly [number, string])[]): string {
  return [...factors].sort((left, right) => right[0] - left[0])[0]?.[1] ?? "context";
}

function distance(left: Readonly<CombatPosition>, right: Readonly<CombatPosition>): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function ratio(value: number, maximum: number): number {
  return clamp01(value / Math.max(1, maximum));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
