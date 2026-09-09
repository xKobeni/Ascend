export type CombatAction = "Attack" | "Dead" | "Defend" | "Idle" | "Move" | "Retreat";
export type CombatResult = "Defeat" | "Idle" | "Running" | "Victory" | "Withdrawn";
export type CombatTeam = "Enemy" | "Hero";

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

export interface CombatantSnapshot {
  action: CombatAction;
  defending: boolean;
  hp: number;
  id: string;
  label: string;
  position: CombatPosition;
  role: string;
  stats: CombatStats;
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
