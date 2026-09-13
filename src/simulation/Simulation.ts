import type { Hero } from "../heroes/Hero";
import { HeroManager } from "../heroes/HeroManager";
import type { DayPeriod } from "../heroes/HeroRoutineSystem";
import type { TrainingType } from "../heroes/Hero";
import type { FormationPosition, SquadRole } from "../squads/Squad";
import { SquadSystem } from "../squads/SquadSystem";
import { CombatSimulation } from "../combat/CombatSimulation";
import { ExpeditionSystem } from "../expeditions/ExpeditionSystem";
import { RECRUITMENT_COST, RecruitmentSystem, type RecruitmentRoll } from "../recruitment/RecruitmentSystem";
import { DormitorySystem, type DormitorySnapshot } from "../refuge/DormitorySystem";
import { ResourceEconomySystem, type ResourceEconomySnapshot } from "../economy/ResourceEconomySystem";
import {
  ConstructionSystem,
  FACILITY_RECIPES,
  type ConstructionSnapshot,
  type FacilityRecipeId,
} from "../refuge/ConstructionSystem";
import {
  RefugeLayoutSystem,
  type PlacementValidation,
  type RefugeLayoutSnapshot,
  type RefugeStructureId,
} from "../refuge/RefugeLayoutSystem";
import { EquipmentSystem, type EquipmentSlot } from "../equipment/EquipmentSystem";
import {
  CRAFTING_RECIPES,
  CraftingSystem,
  getRepairQuote,
  type CraftingRecipeId,
} from "../crafting/CraftingSystem";
import { ClassSystem } from "../classes/ClassSystem";
import type { BasicHeroClass } from "../heroes/Hero";

export interface RecruitmentResult extends RecruitmentRoll {
  cost: number;
  hero: Readonly<Hero>;
}

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
  private readonly classSystem = new ClassSystem();
  private readonly heroManager = new HeroManager();
  private readonly equipmentSystem = new EquipmentSystem();
  private readonly craftingSystem = new CraftingSystem();
  private readonly combatSimulation = new CombatSimulation((event) => {
    this.heroManager.recordSkillUsage(event);
  }, (event) => {
    this.heroManager.recordCombatMemory(event, this.state.day, this.state.minuteOfDay);
  }, (heroId) => this.equipmentSystem.getModifiers(heroId));
  private readonly expeditionSystem = new ExpeditionSystem(
    this.combatSimulation,
    (squad, combat, outcome) => {
      const consequences = this.heroManager.applyExpeditionConsequences(
        squad, combat, outcome, this.state.day,
      );
      this.equipmentSystem.applyExpeditionWear(squad.members.map((member) => member.heroId), outcome);
      return consequences;
    },
    (squad, successful) => this.heroManager.recordExpeditionExperience(squad, successful),
  );
  private readonly squadSystem = new SquadSystem();
  private readonly recruitmentSystem = new RecruitmentSystem();
  private readonly dormitorySystem = new DormitorySystem();
  private readonly resourceEconomySystem = new ResourceEconomySystem();
  private readonly refugeLayoutSystem = new RefugeLayoutSystem();
  private readonly constructionSystem = new ConstructionSystem();
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
    const expeditionPhase = this.getExpeditionSnapshot().phase;
    if (expeditionPhase === "Combat") {
      this.expeditionSystem.step(deltaSeconds);
      this.syncActiveRoster();
      return;
    }
    if (expeditionPhase === "Debrief") {
      return;
    }
    if (this.getCombatSnapshot().result !== "Idle") {
      this.combatSimulation.step(deltaSeconds);
      return;
    }
    this.state.elapsedSeconds += deltaSeconds;
    const totalGameMinutes = STARTING_MINUTE + this.state.elapsedSeconds * GAME_MINUTES_PER_REAL_SECOND;
    this.state.day = Math.floor(totalGameMinutes / (24 * 60)) + 1;
    this.state.minuteOfDay = totalGameMinutes % (24 * 60);
    this.state.period = this.heroManager.getDayPeriod(this.state.minuteOfDay);
    const gameMinutes = deltaSeconds * GAME_MINUTES_PER_REAL_SECOND;
    const resources = this.getExpeditionSnapshot().resources;
    this.resourceEconomySystem.step(
      this.heroManager.getAll().length,
      gameMinutes,
      resources.food,
      (amount) => this.expeditionSystem.consumeFood(amount),
      this.constructionSystem.getCompletedCount("storage") > 0 ? 0.9 : 1,
    );
    const economy = this.getResourceEconomySnapshot();
    this.heroManager.step(
      deltaSeconds,
      gameMinutes,
      this.state.day,
      this.state.minuteOfDay,
      this.refugeLayoutSystem.getSnapshot(),
      this.constructionSystem.getSnapshot(),
      { ...this.getDormitorySnapshot(), foodSupply: economy.provisionStatus },
      {
        injuryRecoveryMultiplier: this.constructionSystem.getCompletedCount("infirmary") > 0 ? 1.2 : 1,
        trainingMultiplier: this.constructionSystem.getCompletedCount("training-hall") > 0 ? 1.15 : 1,
      },
    );
    this.constructionSystem.step(gameMinutes, this.heroManager.getAll());
    if (this.isSmithyOperational()) {
      const completion = this.craftingSystem.step(gameMinutes);
      if (completion?.kind === "Craft" && completion.recipeId && completion.quality) {
        this.equipmentSystem.addCraftedItem(
          this.craftingSystem.createOutput(completion.recipeId, completion.quality),
        );
      } else if (completion?.kind === "Repair" && completion.itemId) {
        this.equipmentSystem.repair(completion.itemId);
      }
    }
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

  getHeroClassOptions(heroId: string) {
    const hero = this.heroManager.getById(heroId);
    return hero ? this.classSystem.evaluate(hero, this.equipmentSystem.getModifiers(heroId)) : [];
  }

  selectHeroClass(heroId: string, heroClass: BasicHeroClass): boolean {
    if (!this.canManageEquipment()) return false;
    const hero = this.heroManager.getById(heroId);
    return hero ? this.classSystem.select(hero, heroClass, this.equipmentSystem.getModifiers(heroId)) : false;
  }

  getFallenHeroes() {
    return this.heroManager.getFallen();
  }

  getFallenHero(heroId: string) {
    return this.heroManager.getFallenByHeroId(heroId);
  }

  queueTraining(heroId: string, type: TrainingType): boolean {
    return this.isRefugeStructurePlaced("training") && this.heroManager.queueTraining(heroId, type);
  }

  toggleSkillLoadout(heroId: string, definitionId: string): boolean {
    return this.heroManager.toggleSkillLoadout(heroId, definitionId);
  }

  treatHeroInjury(heroId: string, injuryId: string): boolean {
    if (!this.isRefugeStructurePlaced("infirmary")) return false;
    const result = this.heroManager.treatInjury(
      heroId,
      injuryId,
      this.expeditionSystem.getSnapshot().resources.medicine,
    );
    return result.success && this.expeditionSystem.consumeMedicine(result.cost);
  }

  getSquad() {
    return this.squadSystem.getSquad();
  }

  getSquadEvaluation() {
    return this.squadSystem.evaluate(this.getHeroes(), (heroId) => this.equipmentSystem.getModifiers(heroId));
  }

  getEquipmentSnapshot() { return this.equipmentSystem.getSnapshot(); }

  getCraftingSnapshot() { return this.craftingSystem.getSnapshot(); }

  getCraftingRecipes() { return CRAFTING_RECIPES; }

  isSmithyOperational(): boolean {
    return this.constructionSystem.getCompletedCount("smithy") > 0;
  }

  startCrafting(recipeId: CraftingRecipeId): boolean {
    if (!this.canManageEquipment() || !this.isSmithyOperational() || !this.craftingSystem.canBegin()) return false;
    const recipe = this.craftingSystem.getRecipe(recipeId);
    if (!recipe) return false;
    if (!this.expeditionSystem.consumeSmithyResources(recipe.scrapCost, recipe.metalCost)) return false;
    if (!this.craftingSystem.beginCraft(recipeId)) {
      throw new Error("Smithy resource validation and craft commit diverged.");
    }
    return true;
  }

  startEquipmentRepair(itemId: string): boolean {
    if (!this.canManageEquipment() || !this.isSmithyOperational() || !this.craftingSystem.canBegin()) return false;
    const item = this.getEquipmentSnapshot().items.find((candidate) => candidate.id === itemId);
    if (!item || item.durability >= 100) return false;
    const quote = getRepairQuote(item);
    if (!this.expeditionSystem.consumeSmithyResources(quote.scrapCost, quote.metalCost)) return false;
    if (!this.craftingSystem.beginRepair(item)) {
      throw new Error("Smithy resource validation and repair commit diverged.");
    }
    return true;
  }

  equipItem(heroId: string, itemId: string): boolean {
    return this.canManageEquipment() && this.equipmentSystem.equip(heroId, itemId, this.getHeroes());
  }

  unequipItem(heroId: string, slot: EquipmentSlot): boolean {
    return this.canManageEquipment() && this.equipmentSystem.unequip(heroId, slot);
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

  moveHeroToSquadFormation(heroId: string, formation: FormationPosition): boolean {
    return this.squadSystem.moveHeroToFormation(heroId, formation);
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

  getExpeditionSnapshot() {
    return this.expeditionSystem.getSnapshot();
  }

  getRecruitmentCost(): number {
    return RECRUITMENT_COST;
  }

  getDormitorySnapshot(): Readonly<DormitorySnapshot> {
    return this.dormitorySystem.getSnapshot(
      this.heroManager.getAll().length,
      this.constructionSystem.getCompletedCount("dormitory"),
    );
  }

  getResourceEconomySnapshot(): Readonly<ResourceEconomySnapshot> {
    return this.resourceEconomySystem.getSnapshot(
      this.heroManager.getAll().length,
      this.getExpeditionSnapshot().resources.food,
      this.constructionSystem.getCompletedCount("storage") > 0 ? 0.9 : 1,
    );
  }

  getConstructionSnapshot(): Readonly<ConstructionSnapshot> {
    return this.constructionSystem.getSnapshot();
  }

  getFacilityRecipes() { return FACILITY_RECIPES; }

  getFacilityScrapCost(recipeId: FacilityRecipeId): number {
    return this.constructionSystem.getScrapCost(recipeId);
  }

  validateConstructionPlacement(recipeId: FacilityRecipeId, x: number, z: number): PlacementValidation {
    return this.constructionSystem.validatePlacement(
      recipeId, x, z, this.refugeLayoutSystem,
    );
  }

  createConstructionSite(recipeId: FacilityRecipeId, x: number, z: number, rotation: number): boolean {
    if (!this.canEditRefugeLayout()) return false;
    const validation = this.validateConstructionPlacement(recipeId, x, z);
    const cost = this.constructionSystem.getScrapCost(recipeId);
    if (!validation.valid || this.getExpeditionSnapshot().resources.scrap < cost) return false;
    if (!this.expeditionSystem.consumeScrap(cost)) return false;
    this.constructionSystem.createSite(recipeId, validation.x, validation.z, rotation);
    return true;
  }

  toggleConstructionBuilder(siteId: string, heroId: string): boolean {
    return this.canEditRefugeLayout() &&
      this.constructionSystem.toggleBuilder(siteId, heroId, this.heroManager.getAll());
  }

  getRefugeLayout(): Readonly<RefugeLayoutSnapshot> {
    return this.refugeLayoutSystem.getSnapshot();
  }

  validateRefugeFacility(id: RefugeStructureId, x: number, z: number): PlacementValidation {
    return this.refugeLayoutSystem.validateFacility(id, x, z, this.getConstructionFootprints());
  }

  moveRefugeFacility(id: RefugeStructureId, x: number, z: number, rotation: number): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.moveFacility(
      id, x, z, rotation, this.getConstructionFootprints(),
    );
  }

  storeRefugeFacility(id: "dormitory" | "infirmary" | "storage" | "training"): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.storeFacility(id);
  }

  addRefugeTrail(x: number, z: number): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.addTrail(x, z, this.getConstructionFootprints());
  }

  validateRefugeTrail(x: number, z: number): PlacementValidation {
    return this.refugeLayoutSystem.validateTrail(x, z, this.getConstructionFootprints());
  }

  removeRefugeTrail(x: number, z: number): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.removeTrail(x, z);
  }

  validateRefugeEnvironment(id: string, x: number, z: number): PlacementValidation {
    return this.refugeLayoutSystem.validateEnvironment(id, x, z, this.getConstructionFootprints());
  }

  moveRefugeEnvironment(id: string, x: number, z: number): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.moveEnvironment(
      id, x, z, this.getConstructionFootprints(),
    );
  }

  removeRefugeEnvironment(id: string): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.removeEnvironment(id);
  }

  undoRefugeLayout(): boolean {
    return this.canEditRefugeLayout() && this.refugeLayoutSystem.undo();
  }

  canUndoRefugeLayout(): boolean {
    return this.refugeLayoutSystem.canUndo();
  }

  upgradeDormitory(): boolean {
    if (!this.isRefugeStructurePlaced("dormitory")) return false;
    if (this.getExpeditionSnapshot().phase !== "Briefing" ||
      this.getCombatSnapshot().result !== "Idle") {
      return false;
    }
    const resources = this.getExpeditionSnapshot().resources;
    const snapshot = this.getDormitorySnapshot();
    if (!this.dormitorySystem.canUpgrade(resources.scrap) || snapshot.upgradeCost === null) {
      return false;
    }
    if (!this.expeditionSystem.consumeScrap(snapshot.upgradeCost)) {
      return false;
    }
    if (!this.dormitorySystem.upgrade()) {
      throw new Error("Dormitory upgrade validation and commit diverged.");
    }
    return true;
  }

  canRecruit(): boolean {
    return this.getExpeditionSnapshot().phase === "Briefing" &&
      this.getCombatSnapshot().result === "Idle" &&
      this.isRefugeStructurePlaced("dormitory") &&
      this.dormitorySystem.hasCapacity(
        this.heroManager.getAll().length,
        this.constructionSystem.getCompletedCount("dormitory"),
      ) &&
      this.getExpeditionSnapshot().resources.riftShards >= RECRUITMENT_COST;
  }

  recruitHero(seed?: number): RecruitmentResult | null {
    if (!this.canRecruit()) {
      return null;
    }
    const roll = this.recruitmentSystem.createRoll(seed);
    if (!this.expeditionSystem.consumeRiftShards(RECRUITMENT_COST)) {
      return null;
    }
    const hero = this.heroManager.recruit(roll.seed, this.state.day, roll.rank);
    this.state.heroCount = this.heroManager.getAll().length;
    return { ...roll, cost: RECRUITMENT_COST, hero };
  }

  startExpedition(): boolean {
    return this.expeditionSystem.start(this.getSquad(), this.getHeroes());
  }

  returnFromExpedition(): boolean {
    return this.expeditionSystem.returnToRefuge();
  }

  startCombatSandbox(): boolean {
    return this.combatSimulation.start(this.getSquad(), this.getHeroes());
  }

  exitCombatSandbox(): void {
    this.combatSimulation.stop();
  }

  private canEditRefugeLayout(): boolean {
    return this.getExpeditionSnapshot().phase === "Briefing" && this.getCombatSnapshot().result === "Idle";
  }

  private canManageEquipment(): boolean {
    return this.getExpeditionSnapshot().phase === "Briefing" && this.getCombatSnapshot().result === "Idle";
  }

  private getConstructionFootprints() {
    return this.getConstructionSnapshot().sites.map((site) => ({
      footprintRadius: this.constructionSystem.getRecipe(site.recipeId).footprintRadius,
      label: this.constructionSystem.getRecipe(site.recipeId).label,
      x: site.x,
      z: site.z,
    }));
  }

  private isRefugeStructurePlaced(id: RefugeStructureId): boolean {
    return this.getRefugeLayout().facilities.find((entry) => entry.id === id)?.placed === true;
  }

  private syncActiveRoster(): void {
    const heroes = this.getHeroes();
    this.squadSystem.removeMissingHeroes(heroes);
    this.equipmentSystem.removeMissingHeroes(heroes);
    this.state.heroCount = heroes.length;
  }
}
