import type { CombatResult } from "../combat/Combat";

export interface ExpeditionResources {
  food: number;
  metal: number;
  medicine: number;
  riftShards: number;
  scrap: number;
}

export interface ExpeditionMission {
  description: string;
  difficulty: "Low" | "Moderate" | "High";
  id: string;
  name: string;
  objective: "Eliminate Enemies";
  rewards: Readonly<ExpeditionResources>;
  threats: readonly string[];
}

export interface ExpeditionConsequence {
  detail: string;
  heroId: string;
  heroName: string;
  permanent: boolean;
}

export interface ExpeditionReport {
  consequences: readonly Readonly<ExpeditionConsequence>[];
  outcome: Exclude<CombatResult, "Idle" | "Running">;
  rewards: Readonly<ExpeditionResources>;
  summary: string;
}

export type ExpeditionPhase = "Briefing" | "Combat" | "Debrief";

export interface ExpeditionSnapshot {
  attempt: number;
  deployedSquadName: string | null;
  mission: Readonly<ExpeditionMission>;
  phase: ExpeditionPhase;
  report: Readonly<ExpeditionReport> | null;
  resources: Readonly<ExpeditionResources>;
}
