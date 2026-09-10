import type {
  ActionScoreSnapshot,
  CombatPosition,
  TacticalRole,
  UtilityAction,
} from "./Combat";

export const ACTION_ORDER: readonly UtilityAction[] = [
  "Attack",
  "Defend",
  "Retreat",
  "Protect",
  "Heal",
  "Reposition",
  "Advance",
  "FallBack",
  "Flank",
  "Kite",
  "Taunt",
  "Berserk",
  "Hesitate",
  "Flee",
  "FocusTarget",
  "Assist",
  "Recover",
  "Regroup",
  "MaintainFormation",
  "FollowLeader",
];

export interface UtilityDecision {
  action: UtilityAction;
  reason: string;
  scores: readonly Readonly<ActionScoreSnapshot>[];
  targetId: string | null;
}

export interface UtilityTarget {
  action: UtilityAction;
  formation: string;
  hp: number;
  id: string;
  label: string;
  position: CombatPosition;
  stats: { attack: number; defense: number; maxHp: number; range: number; speed: number };
  tacticalRole: TacticalRole;
  team: string;
}

export interface UtilityActor {
  action: UtilityAction;
  attributes: {
    agility: number;
    endurance: number;
    intelligence: number;
    leadership: number;
    strength: number;
    willpower: number;
  };
  defense: number;
  formation: string;
  hasBodyBlock: boolean;
  hasCover: boolean;
  hp: number;
  id: string;
  leadership: number;
  memories: CombatMemory[];
  medicine: number;
  personality: {
    aggression: number;
    bravery: number;
    discipline: number;
    empathy: number;
    loyalty: number;
  };
  position: CombatPosition;
  preparedSkillIds: ReadonlySet<string>;
  relationships: Record<string, { metrics: { trust: number; respect: number; affinity: number } } | undefined>;
  role: string;
  stats: { attack: number; defense: number; maxHp: number; range: number; speed: number };
  tacticalRole: TacticalRole;
  traits: readonly string[];
  label: string;
  team: string;
  weaponSkillId: string | null;
  flanking: number;
  isTaunting: boolean;
  berserkTicks: number;
  hardenTicks: number;
  stunTicks: number;
  suppressTicks: number;
  panicTicks: number;
  focusTargetId: string | null;
  focusTargetTicks: number;
  buffTicks: number;
  assistBoost: number;
}

interface CombatMemory {
  type: "protect" | "retreat" | "fear" | "assist" | "berserk" | "regroup";
  value: number;
  allyId?: string;
}

function getMemoryCombatInfluence(
  memories: readonly CombatMemory[],
  allyId: string | null,
): { protect: number; retreat: number; fear: number; assist: number; berserk: number; regroup: number } {
  let protect = 0;
  let retreat = 0;
  let fear = 0;
  let assist = 0;
  let berserk = 0;
  let regroup = 0;

  for (const mem of memories) {
    if (mem.type === "protect" && mem.allyId === allyId) protect = Math.max(protect, mem.value);
    if (mem.type === "retreat") retreat = Math.max(retreat, mem.value);
    if (mem.type === "fear") fear = Math.max(fear, mem.value);
    if (mem.type === "assist" && mem.allyId === allyId) assist = Math.max(assist, mem.value);
    if (mem.type === "berserk") berserk = Math.max(berserk, mem.value);
    if (mem.type === "regroup") regroup = Math.max(regroup, mem.value);
  }

  return { protect, retreat, fear, assist, berserk, regroup };
}

function getPreferredRange(role: TacticalRole): number {
  switch (role) {
    case "Defender": return 2.5;
    case "Medic": return 6;
    case "Ranged": return 8;
    case "Skirmisher": return 4;
    case "Striker": return 2;
  }
}

export function scoreCombatActions(
  actor: Readonly<UtilityActor>,
  allies: readonly Readonly<UtilityTarget>[],
  opponents: readonly Readonly<UtilityTarget>[],
): UtilityDecision {
  const livingAllies = allies.filter((ally) => ally.hp > 0 && ally.action !== "Retreat");
  const livingOpponents = opponents.filter((opponent) => opponent.hp > 0 && opponent.action !== "Retreat");
  const preferredEnemy = selectTacticalTarget(actor, livingOpponents, livingAllies);
  const vulnerableAlly = [...livingAllies]
    .filter((ally) => ally.id !== actor.id)
    .sort(
      (left, right) =>
        allyDanger(right, livingOpponents) + formationRisk(right.formation) -
        allyDanger(left, livingOpponents) - formationRisk(left.formation),
    )[0] ?? null;
  const woundedAlly = [...livingAllies]
    .filter((ally) => ally.hp / ally.stats.maxHp < 0.92)
    .sort((left, right) => left.hp / left.stats.maxHp - right.hp / right.stats.maxHp)[0] ?? null;

  const health = ratio(actor.hp, actor.stats.maxHp);
  const missingHealth = 1 - health;
  const enemyDistance = preferredEnemy ? distance(actor.position, preferredEnemy.position) : Number.POSITIVE_INFINITY;
  const proximity = preferredEnemy ? clamp01(1 - enemyDistance / 12) : 0;
  const threat = preferredEnemy ? clamp01(preferredEnemy.stats.attack / Math.max(1, actor.stats.defense * 3.2)) : 0;
  const preferredRange = getPreferredRange(actor.tacticalRole);
  const rangeError = Math.abs(enemyDistance - preferredRange);
  const bravery = actor.personality.bravery;
  const aggression = actor.personality.aggression;
  const discipline = actor.personality.discipline;
  const empathy = actor.personality.empathy;
  const loyalty = actor.personality.loyalty;
  const agility = actor.attributes.agility;
  const intelligence = actor.attributes.intelligence;
  const endurance = actor.attributes.endurance;
  const leadership = actor.attributes.leadership;
  const speed = actor.stats.speed;
  const isProtective = actor.traits.includes("Protective");
  const isCowardly = actor.traits.includes("Cowardly");
  const isReckless = actor.traits.includes("Reckless");
  const allyRisk = vulnerableAlly ? allyDanger(vulnerableAlly, livingOpponents) : 0;
  const bond = vulnerableAlly ? relationshipBond(actor.relationships[vulnerableAlly.id]) : 0;
  const woundedRatio = woundedAlly ? 1 - ratio(woundedAlly.hp, woundedAlly.stats.maxHp) : 0;
  const memory = getMemoryCombatInfluence(actor.memories, vulnerableAlly?.id ?? null);
  const nearestAllyDist = livingAllies.length > 0
    ? Math.min(...livingAllies.map(a => distance(actor.position, a.position)))
    : 999;
  const distFromFormation = distanceFromFormationPos(actor);

  const raw: Record<UtilityAction, { reason: string; score: number; targetId: string | null; valid: boolean }> = {
    Attack: {
      reason: dominantReason([
        [aggression * 24, "aggression"],
        [bravery * 18, "bravery"],
        [actor.role === "Damage" ? 22 : 0, "damage role"],
        [actor.tacticalRole === "Ranged" ? 14 : 0, "ranged priority"],
        [proximity * 18, "close target"],
      ]),
      score: 24 + aggression * 24 + bravery * 18 + (actor.role === "Damage" ? 22 : 0) + proximity * 18 + (isReckless ? 9 : 0),
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(preferredEnemy && enemyDistance <= actor.stats.range),
    },
    Defend: {
      reason: dominantReason([
        [missingHealth * 42, "low health"],
        [threat * 24, "enemy threat"],
        [discipline * 18, "discipline"],
        [actor.role === "Vanguard" ? 12 : 0, "vanguard role"],
        [actor.tacticalRole === "Defender" ? 18 : 0, "frontline duty"],
      ]),
      score: 10 + missingHealth * 42 + threat * 24 + discipline * 18 + (actor.role === "Vanguard" ? 12 : 0) + (actor.tacticalRole === "Defender" ? 18 : 0),
      targetId: null,
      valid: Boolean(preferredEnemy && enemyDistance <= actor.stats.range * 1.35),
    },
    Retreat: {
      reason: dominantReason([
        [missingHealth * 72, "low health"],
        [(1 - bravery) * 34, "low bravery"],
        [threat * 16, "enemy threat"],
        [isCowardly ? 16 : 0, "cowardly trait"],
        [memory.retreat * 22, "past trauma"],
      ]),
      score: 2 + missingHealth * 72 + (1 - bravery) * 34 + threat * 16 +
        (isCowardly ? 16 : 0) + memory.retreat * 22 - loyalty * 8,
      targetId: null,
      valid: Boolean(
        preferredEnemy &&
        (health <= (isCowardly ? 0.82 : 0.68) + memory.fear * 0.1 ||
          (threat >= 0.92 - memory.fear * 0.12 && health < 0.9)),
      ),
    },
    Protect: {
      reason: dominantReason([
        [allyRisk * 44, "ally in danger"],
        [bond * 24, "relationship bond"],
        [empathy * 18, "empathy"],
        [loyalty * 16, "loyalty"],
        [isProtective ? 22 : 0, "protective trait"],
        [actor.tacticalRole === "Defender" ? 28 : 0, "defender duty"],
        [memory.protect * 26, "remembered bond"],
      ]),
      score: 4 + allyRisk * 44 + bond * 24 + empathy * 18 + loyalty * 16 +
        (isProtective ? 22 : 0) + (actor.tacticalRole === "Defender" ? 28 : 0) +
        memory.protect * 26,
      targetId: vulnerableAlly?.id ?? null,
      valid: Boolean(
        vulnerableAlly &&
        (actor.preparedSkillIds.has("interpose") || actor.preparedSkillIds.has("protective_instinct")) &&
        (vulnerableAlly.formation !== "Front" || actor.tacticalRole === "Defender") &&
        (allyRisk >= 0.3 || isProtective || memory.protect >= 0.28),
      ),
    },
    Heal: {
      reason: dominantReason([
        [woundedRatio * 62, "wounded ally"],
        [actor.medicine * 5, "medicine skill"],
        [actor.role === "Support" ? 30 : 0, "support role"],
        [actor.tacticalRole === "Medic" ? 28 : 0, "medic priority"],
        [empathy * 14, "empathy"],
      ]),
      score: woundedRatio * 62 + actor.medicine * 5 + (actor.role === "Support" ? 30 : 0) + (actor.tacticalRole === "Medic" ? 28 : 0) + empathy * 14,
      targetId: woundedAlly?.id ?? null,
      valid: Boolean(
        woundedAlly &&
        actor.medicine > 0 &&
        actor.tacticalRole === "Medic" &&
        actor.preparedSkillIds.has("field_treatment"),
      ),
    },
    Reposition: {
      reason: dominantReason([
        [Math.min(rangeError, 12) * 6, "formation spacing"],
        [actor.personality.discipline * 14, "discipline"],
        [actor.stats.speed * 5, "mobility"],
      ]),
      score: 30 + Math.min(rangeError, 12) * 6 + actor.personality.discipline * 14 + actor.stats.speed * 5,
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(preferredEnemy && rangeError > 0.65),
    },
    Advance: {
      reason: dominantReason([
        [aggression * 20, "aggression"],
        [proximity * 14, "close target"],
        [actor.role === "Vanguard" ? 12 : 0, "vanguard role"],
        [isReckless ? 8 : 0, "reckless trait"],
      ]),
      score: 18 + aggression * 20 + proximity * 14 + (actor.role === "Vanguard" ? 12 : 0) + (isReckless ? 8 : 0),
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(preferredEnemy && enemyDistance > 4 && enemyDistance <= 12),
    },
    FallBack: {
      reason: dominantReason([
        [missingHealth * 28, "low health"],
        [threat * 16, "enemy threat"],
        [discipline * 12, "discipline"],
        [actor.tacticalRole === "Ranged" ? 14 : 0, "ranged priority"],
      ]),
      score: 14 + missingHealth * 28 + threat * 16 + discipline * 12 + (actor.tacticalRole === "Ranged" ? 14 : 0),
      targetId: null,
      valid: Boolean(preferredEnemy && enemyDistance < preferredRange * 0.6),
    },
    Flank: {
      reason: dominantReason([
        [agility * 16, "agility"],
        [discipline * 10, "discipline"],
        [actor.tacticalRole === "Striker" ? 18 : 0, "striker role"],
        [actor.tacticalRole === "Skirmisher" ? 14 : 0, "skirmisher role"],
      ]),
      score: 16 + agility * 16 + discipline * 10 + (actor.tacticalRole === "Striker" ? 18 : 0) + (actor.tacticalRole === "Skirmisher" ? 14 : 0),
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(
        preferredEnemy &&
        enemyDistance <= 8 &&
        actor.flanking === 0,
      ),
    },
    Kite: {
      reason: dominantReason([
        [speed * 8, "speed"],
        [discipline * 12, "discipline"],
        [actor.tacticalRole === "Ranged" ? 16 : 0, "ranged role"],
        [actor.tacticalRole === "Medic" ? 12 : 0, "medic role"],
      ]),
      score: 20 + speed * 8 + discipline * 12 + (actor.tacticalRole === "Ranged" ? 16 : 0) + (actor.tacticalRole === "Medic" ? 12 : 0),
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(
        preferredEnemy &&
        enemyDistance < preferredRange * 0.5 &&
        enemyDistance > 1.5,
      ),
    },
    Taunt: {
      reason: dominantReason([
        [aggression * 18, "aggression"],
        [bravery * 14, "bravery"],
        [endurance * 10, "endurance"],
        [actor.tacticalRole === "Defender" ? 16 : 0, "defender role"],
      ]),
      score: 12 + aggression * 18 + bravery * 14 + endurance * 10 +
        (actor.tacticalRole === "Defender" ? 16 : 0) + (actor.role === "Vanguard" ? 14 : 0),
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(
        preferredEnemy &&
        enemyDistance <= 4 &&
        !actor.isTaunting,
      ),
    },
    Berserk: {
      reason: dominantReason([
        [aggression * 28, "aggression"],
        [isReckless ? 20 : 0, "reckless trait"],
        [missingHealth * 18, "low health"],
        [bravery * 12, "bravery"],
      ]),
      score: 8 + aggression * 28 + (isReckless ? 20 : 0) + missingHealth * 18 + bravery * 12 - discipline * 8,
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(
        preferredEnemy &&
        health < 0.5 &&
        enemyDistance <= actor.stats.range &&
        actor.berserkTicks === 0,
      ),
    },
    Hesitate: {
      reason: dominantReason([
        [(1 - bravery) * 24, "low bravery"],
        [threat * 20, "enemy threat"],
        [missingHealth * 14, "low health"],
      ]),
      score: 6 + (1 - bravery) * 24 + threat * 20 + missingHealth * 14 - discipline * 10,
      targetId: null,
      valid: Boolean(
        threat >= 0.7 &&
        health < 0.6 &&
        actor.hardenTicks === 0,
      ),
    },
    Flee: {
      reason: dominantReason([
        [(1 - bravery) * 36, "low bravery"],
        [(1 - loyalty) * 16, "low loyalty"],
        [missingHealth * 48, "low health"],
        [isCowardly ? 20 : 0, "cowardly trait"],
      ]),
      score: 2 + (1 - bravery) * 36 + (1 - loyalty) * 16 + missingHealth * 48 +
        (isCowardly ? 20 : 0) - discipline * 12,
      targetId: null,
      valid: Boolean(
        health <= 0.3 ||
        (threat >= 0.95 && health < 0.5),
      ),
    },
    FocusTarget: {
      reason: dominantReason([
        [leadership * 20, "leadership"],
        [actor.tacticalRole === "Striker" ? 14 : 0, "striker role"],
        [livingOpponents.length * 6, "enemy count"],
      ]),
      score: 10 + leadership * 20 + (actor.tacticalRole === "Striker" ? 14 : 0) + livingOpponents.length * 6,
      targetId: preferredEnemy?.id ?? null,
      valid: Boolean(
        leadership >= 3 &&
        preferredEnemy &&
        actor.focusTargetTicks === 0,
      ),
    },
    Assist: {
      reason: dominantReason([
        [empathy * 18, "empathy"],
        [loyalty * 14, "loyalty"],
        [woundedRatio * 30, "wounded ally"],
        [actor.role === "Support" ? 16 : 0, "support role"],
      ]),
      score: 8 + empathy * 18 + loyalty * 14 + woundedRatio * 30 + (actor.role === "Support" ? 16 : 0),
      targetId: woundedAlly?.id ?? null,
      valid: Boolean(
        woundedAlly &&
        actor.tacticalRole !== "Medic",
      ),
    },
    Recover: {
      reason: dominantReason([
        [missingHealth * 34, "low health"],
        [endurance * 10, "endurance"],
        [intelligence * 6, "intelligence"],
      ]),
      score: 12 + missingHealth * 34 + endurance * 10 + intelligence * 6,
      targetId: null,
      valid: Boolean(
        health < 0.7 &&
        (threat < 0.4 || enemyDistance > 4),
      ),
    },
    Regroup: {
      reason: dominantReason([
        [loyalty * 14, "loyalty"],
        [discipline * 12, "discipline"],
        [nearestAllyDist * 4, "ally distance"],
      ]),
      score: 8 + loyalty * 14 + discipline * 12 + nearestAllyDist * 4,
      targetId: null,
      valid: Boolean(nearestAllyDist > 6),
    },
    MaintainFormation: {
      reason: dominantReason([
        [discipline * 18, "discipline"],
        [actor.tacticalRole === "Defender" ? 14 : 0, "defender duty"],
        [distFromFormation * 6, "formation error"],
      ]),
      score: 10 + discipline * 18 + (actor.tacticalRole === "Defender" ? 14 : 0) + distFromFormation * 6,
      targetId: null,
      valid: Boolean(distFromFormation > 3),
    },
    FollowLeader: {
      reason: dominantReason([
        [loyalty * 16, "loyalty"],
        [intelligence * 8, "intelligence"],
      ]),
      score: 6 + loyalty * 16 + intelligence * 8,
      targetId: null,
      valid: Boolean(distFromFormation > 5),
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

function distanceFromFormationPos(actor: Readonly<UtilityActor>): number {
  const targetX = actor.formation === "Front" ? -2 : actor.formation === "Back" ? 4 : 1;
  const targetZ = 0;
  return Math.hypot(actor.position.x - targetX, actor.position.z - targetZ);
}

function selectTacticalTarget<T extends UtilityTarget>(
  actor: Readonly<UtilityActor>,
  opponents: readonly Readonly<T>[],
  allies: readonly Readonly<UtilityTarget>[],
): Readonly<T> | null {
  if (actor.tacticalRole === "Defender") {
    const backline = allies
      .filter((ally) => ally.id !== actor.id && ally.formation === "Back")
      .sort((left, right) => ratio(left.hp, left.stats.maxHp) - ratio(right.hp, right.stats.maxHp))[0];
    if (backline) {
      return nearest(backline.position, opponents);
    }
  }
  if (actor.tacticalRole === "Ranged" || actor.tacticalRole === "Striker") {
    return [...opponents].sort(
      (left, right) =>
        ratio(left.hp, left.stats.maxHp) - ratio(right.hp, right.stats.maxHp) ||
        distance(actor.position, left.position) - distance(actor.position, right.position),
    )[0] ?? null;
  }
  return nearest(actor.position, opponents);
}

function formationRisk(formation: string): number {
  return formation === "Back" ? 0.12 : formation === "Middle" ? 0.05 : 0;
}

function allyDanger(ally: Readonly<UtilityTarget>, opponents: readonly Readonly<UtilityTarget>[]): number {
  const healthRisk = 1 - ratio(ally.hp, ally.stats.maxHp);
  const closest = nearest(ally.position, opponents);
  const proximityRisk = closest ? clamp01(1 - distance(ally.position, closest.position) / 8) : 0;
  return healthRisk * 0.72 + proximityRisk * 0.28;
}

function relationshipBond(profile: { metrics: { trust: number; respect: number; affinity: number } } | undefined): number {
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
