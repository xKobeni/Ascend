export type CombatAction =
  // Core
  | "Attack"
  | "Dead"
  | "Defend"
  | "Idle"
  | "Move"

  // Survival
  | "Brace"
  | "Retreat"
  | "Evade"
  | "TakeCover"
  | "Recover"
  | "Disengage"

  // Positioning
  | "Advance"
  | "FallBack"
  | "Flank"
  | "Kite"
  | "MaintainFormation"
  | "Reposition"

  // Protection
  | "Protect"
  | "BodyBlock"
  | "Intercept"
  | "Taunt"

  // Teamwork
  | "Assist"
  | "FocusTarget"
  | "FollowLeader"
  | "Regroup"
  | "RescueAlly"

  // Support
  | "Buff"
  | "Cleanse"
  | "Heal"
  //| "Revive" - not for now (This will be later), will be handled by a skill/item system

  // Control
  | "Interrupt"
  | "Stun"
  | "Suppress"

  // Special
  | "CounterAttack"
  | "SwitchWeapon"
  | "UseSkill"
  | "UseUltimate"

  // Psychological
  | "Berserk"
  | "Flee"
  | "Hesitate"
  | "Panic";

export type UtilityAction =
  | "Advance"
  | "Assist"
  | "Attack"
  | "Berserk"
  | "Defend"
  | "FallBack"
  | "Flank"
  | "FocusTarget"
  | "Flee"
  | "FollowLeader"
  | "Hesitate"
  | "Heal"
  | "Kite"
  | "MaintainFormation"
  | "Recover"
  | "Regroup"
  | "Reposition"
  | "Retreat"
  | "Taunt"
  | "Protect";

export type ReactionAction =
  | "BodyBlock"
  | "Brace"
  | "CounterAttack"
  | "Disengage"
  | "Evade"
  | "Interrupt"
  | "RescueAlly"
  | "TakeCover";

export type StatusEffectType = "buff" | "cleanse" | "stun" | "suppress";

export type CombatResult = "Defeat" | "Idle" | "Running" | "Victory" | "Withdrawn";
export type CombatTeam = "Enemy" | "Hero";
export type TacticalRole = "Defender" | "Medic" | "Ranged" | "Skirmisher" | "Striker";

export interface CombatStats {
  attack: number;
  defense: number;
  maxHp: number;
  range: number;
  speed: number;
}

export interface CombatPosition {
  x: number;
  z: number;
}

export interface ActionScoreSnapshot {
  action: UtilityAction;
  reason: string;
  score: number;
  valid: boolean;
}

export interface CombatantSnapshot {
  action: CombatAction;
  actionScores: readonly Readonly<ActionScoreSnapshot>[];
  assistBoost: number;
  berserkTicks: number;
  buffStat: string | null;
  buffTicks: number;
  damageMultiplier: number;
  decisionReason: string;
  defeatedBy: string | null;
  defending: boolean;
  defense: number;
  defenseMultiplier: number;
  flanking: number;
  focusTargetId: string | null;
  focusTargetTicks: number;
  formation: FormationPosition;
  hardenTicks: number;
  hasBodyBlock: boolean;
  hasCover: boolean;
  hp: number;
  id: string;
  isTaunting: boolean;
  kills: number;
  label: string;
  panicTicks: number;
  position: CombatPosition;
  role: string;
  stats: CombatStats;
  stunTicks: number;
  suppressTicks: number;
  tacticalRole: TacticalRole;
  team: CombatTeam;
}

export interface CombatLogEntry {
  id: number;
  message: string;
  tick: number;
  tone: "danger" | "neutral" | "success";
}

export interface CombatSnapshot {
  combatants: readonly Readonly<CombatantSnapshot>[];
  log: readonly Readonly<CombatLogEntry>[];
  result: CombatResult;
  tick: number;
}

import type { FormationPosition } from "../squads/Squad";
