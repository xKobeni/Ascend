import type { FormationPosition, SquadRole } from "../squads/Squad";
import type { CombatStats, TacticalRole } from "./Combat";

const FORMATION_X: Readonly<Record<FormationPosition, number>> = {
  Front: -4.2,
  Middle: -7.4,
  Back: -10.6,
};

export function getFormationStart(formation: FormationPosition, lane: number): { x: number; z: number } {
  return { x: FORMATION_X[formation], z: lane };
}

export function getTacticalRole(role: SquadRole, formation: FormationPosition): TacticalRole {
  if (role === "Vanguard") {
    return "Defender";
  }
  if (role === "Support") {
    return "Medic";
  }
  return formation === "Front" ? "Striker" : "Ranged";
}

export function applyFormationStats(
  stats: Readonly<CombatStats>,
  tacticalRole: TacticalRole,
): CombatStats {
  if (tacticalRole === "Ranged") {
    return { ...stats, attack: stats.attack - 1, range: Math.max(5.8, stats.range) };
  }
  if (tacticalRole === "Medic") {
    return { ...stats, range: Math.max(4.4, stats.range), speed: stats.speed + 0.08 };
  }
  if (tacticalRole === "Defender") {
    return { ...stats, defense: stats.defense + 2, range: Math.max(2, stats.range) };
  }
  return { ...stats, attack: stats.attack + 2, range: Math.max(1.8, stats.range) };
}

export function getPreferredRange(tacticalRole: TacticalRole): number {
  if (tacticalRole === "Ranged") {
    return 4.9;
  }
  if (tacticalRole === "Medic") {
    return 5.6;
  }
  if (tacticalRole === "Defender") {
    return 1.65;
  }
  return 1.45;
}
