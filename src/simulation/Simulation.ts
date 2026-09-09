import type { Hero } from "../heroes/Hero";
import { HeroManager } from "../heroes/HeroManager";
import type { DayPeriod } from "../heroes/HeroRoutineSystem";
import type { TrainingType } from "../heroes/Hero";
import type { FormationPosition, SquadRole } from "../squads/Squad";
import { SquadSystem } from "../squads/SquadSystem";
import { CombatSimulation } from "../combat/CombatSimulation";

const STARTING_MINUTE = 7 * 60;
const GAME_MINUTES_PER_REAL_SECOND = 12;

export interface SimulationSnapshot {
  day: number;
  elapsedSeconds: number;
  heroCount: number;
  minuteOfDay: number;
  period: DayPeriod;
  tick: number;
}

export class Simulation {
  private readonly combatSimulation = new CombatSimulation();
  private readonly heroManager = new HeroManager();
  private readonly squadSystem = new SquadSystem();
  private readonly state: SimulationSnapshot = {
    day: 1,
    elapsedSeconds: 0,
    heroCount: 5,
    minuteOfDay: STARTING_MINUTE,
    period: "Morning",
    tick: 0,
  };

  constructor() {
    this.heroManager.generateInitialRoster(this.state.heroCount);
  }

  step(deltaSeconds: number): void {
    this.state.tick += 1;
    if (this.getCombatSnapshot().result !== "Idle") {
      this.combatSimulation.step(deltaSeconds);
      return;
    }
    this.state.elapsedSeconds += deltaSeconds;
    const totalGameMinutes = STARTING_MINUTE + this.state.elapsedSeconds * GAME_MINUTES_PER_REAL_SECOND;
    this.state.day = Math.floor(totalGameMinutes / (24 * 60)) + 1;
    this.state.minuteOfDay = totalGameMinutes % (24 * 60);
    this.state.period = this.heroManager.getDayPeriod(this.state.minuteOfDay);
    this.heroManager.step(
      deltaSeconds,
      deltaSeconds * GAME_MINUTES_PER_REAL_SECOND,
      this.state.day,
      this.state.minuteOfDay,
    );
  }

  getSnapshot(): Readonly<SimulationSnapshot> {
    return this.state;
  }

  getHeroes(): readonly Readonly<Hero>[] {
    return this.heroManager.getAll();
  }

  getHero(id: string): Readonly<Hero> | undefined {
    return this.heroManager.getById(id);
  }

  queueTraining(heroId: string, type: TrainingType): boolean {
    return this.heroManager.queueTraining(heroId, type);
  }

  getSquad() {
    return this.squadSystem.getSquad();
  }

  getSquadEvaluation() {
    return this.squadSystem.evaluate(this.getHeroes());
  }

  renameSquad(name: string): void {
    this.squadSystem.rename(name);
  }

  addHeroToSquad(heroId: string): boolean {
    return this.squadSystem.addHero(heroId, this.getHeroes());
  }

  removeHeroFromSquad(heroId: string): boolean {
    return this.squadSystem.removeHero(heroId);
  }

  setSquadFormation(heroId: string, formation: FormationPosition): boolean {
    return this.squadSystem.setFormation(heroId, formation);
  }

  setSquadRole(heroId: string, role: SquadRole): boolean {
    return this.squadSystem.setRole(heroId, role);
  }

  getSocialEvents() {
    return this.heroManager.getSocialEvents();
  }

  getCombatSnapshot() {
    return this.combatSimulation.getSnapshot();
  }

  startCombatSandbox(): boolean {
    return this.combatSimulation.start(this.getSquad(), this.getHeroes());
  }

  exitCombatSandbox(): void {
    this.combatSimulation.stop();
  }
}
