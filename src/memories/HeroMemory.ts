export type HeroMemoryType =
  | "ALLY_DIED"
  | "CRITICAL_INJURY"
  | "SAVED_ALLY"
  | "WAS_SAVED"
  | "WON_BOSS";

export interface HeroMemory {
  createdDay: number;
  id: string;
  lastReinforcedDay: number;
  persistent: boolean;
  summary: string;
  targetHeroId: string | null;
  type: HeroMemoryType;
  weight: number;
}

export interface MemoryCombatInfluence {
  fear: number;
  protect: number;
  retreat: number;
}

export interface CombatMemoryEvent {
  actorId: string;
  targetId: string;
  type: "HEALED_ALLY" | "PROTECTED_ALLY";
}
