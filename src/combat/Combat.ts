export type CombatAction =
  | "Attack"
  | "Dead"
  | "Defend"
  | "Heal"
  | "Idle"
  | "Move"
  | "Protect"
  | "Reposition"
  | "Retreat";
export type UtilityAction = "Attack" | "Defend" | "Heal" | "Protect" | "Reposition" | "Retreat";
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
  decisionReason: string;
  defeatedBy: string | null;
  defending: boolean;
  formation: FormationPosition;
  hp: number;
  id: string;
  kills: number;
  label: string;
  position: CombatPosition;
  role: string;
  stats: CombatStats;
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
