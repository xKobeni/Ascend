import type { Hero } from "../heroes/Hero";
import type { PlacementValidation, RefugeLayoutSystem } from "./RefugeLayoutSystem";
import { REFUGE_GRID_SIZE } from "./RefugeLayoutSystem";

export type FacilityRecipeId = "dormitory" | "infirmary" | "smithy" | "storage" | "training-hall";
export type ConstructionState = "Complete" | "Materials" | "Site";

export interface FacilityRecipe {
  description: string;
  durationMinutes: number;
  footprintRadius: number;
  id: FacilityRecipeId;
  label: string;
  scrapCost: number;
  service: string;
}

export interface ConstructionSite {
  builderIds: readonly string[];
  deliveredMinutes: number;
  id: string;
  progressMinutes: number;
  recipeId: FacilityRecipeId;
  rotation: number;
  state: ConstructionState;
  x: number;
  z: number;
}

export interface ConstructionSnapshot {
  revision: number;
  sites: readonly Readonly<ConstructionSite>[];
}

const MATERIAL_DELIVERY_MINUTES = 45;
const MAX_BUILDERS = 2;

export const FACILITY_RECIPES: readonly Readonly<FacilityRecipe>[] = Object.freeze([
  Object.freeze({
    description: "A compact sleeping annex beside the original shelter.", durationMinutes: 360,
    footprintRadius: 4.2, id: "dormitory", label: "Dormitory Annex", scrapCost: 12,
    service: "+1 active-roster bed",
  }),
  Object.freeze({
    description: "A covered drill floor with durable targets.", durationMinutes: 420,
    footprintRadius: 4.5, id: "training-hall", label: "Training Hall", scrapCost: 14,
    service: "+15% assignment progress",
  }),
  Object.freeze({
    description: "A sheltered ward for long-term recovery.", durationMinutes: 420,
    footprintRadius: 4, id: "infirmary", label: "Infirmary Ward", scrapCost: 14,
    service: "+20% injury recovery",
  }),
  Object.freeze({
    description: "Raised, weather-tight stores for Refuge provisions.", durationMinutes: 300,
    footprintRadius: 3.8, id: "storage", label: "Storehouse", scrapCost: 10,
    service: "-10% daily Food demand",
  }),
  Object.freeze({
    description: "A practical forge for timed equipment work and repairs.", durationMinutes: 480,
    footprintRadius: 4.3, id: "smithy", label: "Smithy", scrapCost: 16,
    service: "Craft and repair equipment · -10% facility Scrap costs",
  }),
]);

export class ConstructionSystem {
  private nextSiteId = 1;
  private revision = 0;
  private readonly sites = new Map<string, ConstructionSite>();
  private snapshot: ConstructionSnapshot = Object.freeze({ revision: 0, sites: Object.freeze([]) });

  getSnapshot(): Readonly<ConstructionSnapshot> { return this.snapshot; }

  getRecipe(id: FacilityRecipeId): Readonly<FacilityRecipe> {
    const recipe = FACILITY_RECIPES.find((entry) => entry.id === id);
    if (!recipe) throw new Error(`Unknown facility recipe: ${id}.`);
    return recipe;
  }

  getScrapCost(id: FacilityRecipeId): number {
    const base = this.getRecipe(id).scrapCost;
    return this.getCompletedCount("smithy") > 0 ? Math.ceil(base * 0.9) : base;
  }

  validatePlacement(
    recipeId: FacilityRecipeId,
    x: number,
    z: number,
    layoutSystem: RefugeLayoutSystem,
  ): PlacementValidation {
    const recipe = this.getRecipe(recipeId);
    const reserved = [...this.sites.values()].map((site) => ({
      footprintRadius: this.getRecipe(site.recipeId).footprintRadius,
      label: this.getRecipe(site.recipeId).label,
      x: site.x,
      z: site.z,
    }));
    const validation = layoutSystem.validateNewFacility(recipe.label, recipe.footprintRadius, x, z, reserved);
    return { ...validation, message: validation.valid ? `${recipe.label} site ready.` : validation.message };
  }

  createSite(recipeId: FacilityRecipeId, x: number, z: number, rotation: number): Readonly<ConstructionSite> {
    const recipe = this.getRecipe(recipeId);
    const id = `construction-${this.nextSiteId++}`;
    const site: ConstructionSite = {
      builderIds: [], deliveredMinutes: 0, id, progressMinutes: 0, recipeId,
      rotation: this.normalizeRotation(rotation), state: "Site",
      x: Math.round(x / REFUGE_GRID_SIZE) * REFUGE_GRID_SIZE,
      z: Math.round(z / REFUGE_GRID_SIZE) * REFUGE_GRID_SIZE,
    };
    if (recipe.durationMinutes <= 0) throw new Error("Construction duration must be positive.");
    this.sites.set(id, site);
    this.commit();
    return site;
  }

  toggleBuilder(siteId: string, heroId: string, heroes: readonly Readonly<Hero>[]): boolean {
    const site = this.sites.get(siteId);
    const hero = heroes.find((entry) => entry.id === heroId);
    if (!site || site.state === "Complete" || !hero || hero.injuries.some((injury) => !injury.permanent) || hero.training.active) return false;
    const assignedElsewhere = [...this.sites.values()].find((entry) => entry.id !== siteId && entry.builderIds.includes(heroId));
    if (assignedElsewhere) return false;
    const assigned = site.builderIds.includes(heroId);
    if (!assigned && site.builderIds.length >= MAX_BUILDERS) return false;
    site.builderIds = assigned ? site.builderIds.filter((id) => id !== heroId) : [...site.builderIds, heroId];
    this.commit();
    return true;
  }

  step(gameMinutes: number, heroes: readonly Readonly<Hero>[]): readonly Readonly<ConstructionSite>[] {
    const available = new Set(heroes.map((hero) => hero.id));
    const working = new Set(heroes.filter((hero) => hero.movement.activity === "Building").map((hero) => hero.id));
    const completed: ConstructionSite[] = [];
    let changed = false;
    this.sites.forEach((site) => {
      const recipe = this.getRecipe(site.recipeId);
      const progressBefore = Math.floor(site.progressMinutes / recipe.durationMinutes * 100);
      const stateBefore = site.state;
      const builders = site.builderIds.filter((id) => available.has(id));
      if (builders.length !== site.builderIds.length) { site.builderIds = builders; changed = true; }
      if (site.state === "Complete" || builders.length === 0) return;
      const activeBuilders = builders.filter((id) => working.has(id));
      if (activeBuilders.length === 0) return;
      const work = gameMinutes * activeBuilders.length;
      if (site.deliveredMinutes < MATERIAL_DELIVERY_MINUTES) {
        site.deliveredMinutes = Math.min(MATERIAL_DELIVERY_MINUTES, site.deliveredMinutes + work);
        site.state = site.deliveredMinutes >= MATERIAL_DELIVERY_MINUTES ? "Materials" : "Site";
        changed ||= site.state !== stateBefore;
        return;
      }
      site.progressMinutes = Math.min(recipe.durationMinutes, site.progressMinutes + work);
      if (site.progressMinutes >= recipe.durationMinutes) {
        site.state = "Complete";
        site.builderIds = [];
        completed.push(site);
      }
      const progressAfter = Math.floor(site.progressMinutes / recipe.durationMinutes * 100);
      changed ||= progressAfter !== progressBefore || site.state !== stateBefore;
    });
    if (changed) this.commit();
    return completed;
  }

  getCompletedCount(id: FacilityRecipeId): number {
    return [...this.sites.values()].filter((site) => site.recipeId === id && site.state === "Complete").length;
  }

  private commit(): void {
    this.revision += 1;
    this.snapshot = Object.freeze({
      revision: this.revision,
      sites: Object.freeze([...this.sites.values()].map((site) => Object.freeze({ ...site, builderIds: Object.freeze([...site.builderIds]) }))),
    });
  }

  private normalizeRotation(rotation: number): number {
    const turn = Math.PI * 2;
    return ((rotation % turn) + turn) % turn;
  }
}
