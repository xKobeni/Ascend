export type Doctrine = "Balanced";
export type FormationPosition = "Back" | "Front" | "Middle";
export type SquadRole = "Damage" | "Support" | "Vanguard";
export type SquadChemistry = "Bound" | "Cohesive" | "Developing" | "Fragile" | "Unformed";

export interface SquadMember {
  formation: FormationPosition;
  heroId: string;
  role: SquadRole;
}

export interface Squad {
  doctrine: Doctrine;
  id: string;
  members: SquadMember[];
  name: string;
}

export interface SquadEvaluation {
  averageLevel: number;
  chemistry: SquadChemistry;
  cohesion: number;
  combatPower: number;
  defense: number;
  healing: number;
  isComplete: boolean;
  isReady: boolean;
  recoveringMembers: number;
  trust: number;
}
