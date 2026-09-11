import type { CombatResult, CombatSnapshot } from "../combat/Combat";
import { CombatSimulation } from "../combat/CombatSimulation";
import type { Hero } from "../heroes/Hero";
import type { Squad } from "../squads/Squad";
import type {
  ExpeditionConsequence,
  ExpeditionMission,
  ExpeditionReport,
  ExpeditionResources,
  ExpeditionSnapshot,
} from "./Expedition";
import { hasRecoveringInjury } from "../heroes/InjurySystem";

const NO_REWARDS: Readonly<ExpeditionResources> = Object.freeze({ food: 0, medicine: 0, riftShards: 0, scrap: 0 });

const FIRST_MISSION: Readonly<ExpeditionMission> = Object.freeze({
  description: "Clear the collapsed transit yard before the Rift pack reaches the refuge routes.",
  difficulty: "Moderate",
  id: "transit-yard-suppression",
  name: "Transit Yard Suppression",
  objective: "Eliminate Enemies",
  rewards: Object.freeze({ food: 8, medicine: 2, riftShards: 3, scrap: 18 }),
  threats: Object.freeze(["3 Rift Stalkers", "Close-range pressure", "Retreat risk"]),
});

export class ExpeditionSystem {
  private attempt = 0;
  private deployedSquad: Readonly<Squad> | null = null;
  private phase: ExpeditionSnapshot["phase"] = "Briefing";
  private report: ExpeditionReport | null = null;
  private readonly resources: ExpeditionResources = { food: 12, medicine: 6, riftShards: 0, scrap: 0 };

  constructor(
    private readonly combat: CombatSimulation,
    private readonly resolveConsequences: (
      squad: Readonly<Squad>,
      combat: Readonly<CombatSnapshot>,
      outcome: ExpeditionReport["outcome"],
    ) => readonly ExpeditionConsequence[],
    private readonly recordExperience: (
      squad: Readonly<Squad>,
      successful: boolean,
    ) => void,
  ) {}

  start(squad: Readonly<Squad>, heroes: readonly Readonly<Hero>[]): boolean {
    const selectedHeroes = squad.members.map((member) => heroes.find((hero) => hero.id === member.heroId));
    if (
      this.phase !== "Briefing" ||
      squad.members.length !== 3 ||
      selectedHeroes.some((hero) => !hero || hasRecoveringInjury(hero))
    ) {
      return false;
    }
    if (!this.combat.start(squad, heroes, "Expedition engagement", 0.82)) {
      return false;
    }
    this.attempt += 1;
    this.deployedSquad = {
      ...squad,
      members: squad.members.map((member) => ({ ...member })),
    };
    this.phase = "Combat";
    this.report = null;
    return true;
  }

  step(deltaSeconds: number): void {
    if (this.phase !== "Combat") {
      return;
    }
    this.combat.step(deltaSeconds);
    const combat = this.combat.getSnapshot();
    if (combat.result !== "Running" && combat.result !== "Idle") {
      this.resolve(combat, combat.result);
    }
  }

  returnToRefuge(): boolean {
    if (this.phase !== "Debrief") {
      return false;
    }
    this.combat.stop();
    this.deployedSquad = null;
    this.phase = "Briefing";
    return true;
  }

  getSnapshot(): Readonly<ExpeditionSnapshot> {
    return {
      attempt: this.attempt,
      deployedSquadName: this.deployedSquad?.name ?? null,
      mission: FIRST_MISSION,
      phase: this.phase,
      report: this.report,
      resources: this.resources,
    };
  }

  consumeMedicine(amount: number): boolean {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized === 0 || this.resources.medicine < normalized) {
      return false;
    }
    this.resources.medicine -= normalized;
    return true;
  }

  consumeFood(amount: number): boolean {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized === 0 || this.resources.food < normalized) {
      return false;
    }
    this.resources.food -= normalized;
    return true;
  }

  consumeRiftShards(amount: number): boolean {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized === 0 || this.resources.riftShards < normalized) {
      return false;
    }
    this.resources.riftShards -= normalized;
    return true;
  }

  consumeScrap(amount: number): boolean {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized === 0 || this.resources.scrap < normalized) {
      return false;
    }
    this.resources.scrap -= normalized;
    return true;
  }

  private resolve(
    combat: Readonly<CombatSnapshot>,
    outcome: Exclude<CombatResult, "Idle" | "Running">,
  ): void {
    if (!this.deployedSquad || this.phase !== "Combat") {
      return;
    }
    const successful = outcome === "Victory";
    const rewards = successful ? FIRST_MISSION.rewards : NO_REWARDS;
    this.resources.food += rewards.food;
    this.resources.medicine += rewards.medicine;
    this.resources.riftShards += rewards.riftShards;
    this.resources.scrap += rewards.scrap;
    this.recordExperience(this.deployedSquad, successful);
    const consequences = this.resolveConsequences(this.deployedSquad, combat, outcome);
    this.report = {
      consequences,
      outcome,
      rewards: { ...rewards },
      summary: successful
        ? "The route is secure. The squad recovered supplies and returned with field experience."
        : outcome === "Withdrawn"
          ? "The squad escaped the engagement, but the failed deployment took a toll."
          : "The squad was recovered after the route was lost. No mission resources were secured.",
    };
    this.phase = "Debrief";
  }
}
