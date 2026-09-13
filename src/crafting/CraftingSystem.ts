import type {
  EquipmentItem,
  EquipmentQuality,
  EquipmentRarity,
  EquipmentStats,
  EquipmentSlot,
  WeaponType,
} from "../equipment/EquipmentSystem";

export type CraftingRecipeId = "iron-sword" | "ranger-spear" | "ward-shield";
export type SmithyJobKind = "Craft" | "Repair";

export interface CraftingRecipe {
  description: string;
  durationMinutes: number;
  id: CraftingRecipeId;
  metalCost: number;
  name: string;
  output: Readonly<{
    slot: EquipmentSlot;
    stats: Readonly<EquipmentStats>;
    type: WeaponType;
  }>;
  scrapCost: number;
}

export interface SmithyJob {
  durationMinutes: number;
  id: string;
  itemId: string | null;
  kind: SmithyJobKind;
  label: string;
  progressMinutes: number;
  recipeId: CraftingRecipeId | null;
}

export interface CraftingCompletion {
  itemId: string | null;
  jobId: string;
  kind: SmithyJobKind;
  quality: EquipmentQuality | null;
  recipeId: CraftingRecipeId | null;
}

export interface CraftingSnapshot {
  activeJob: Readonly<SmithyJob> | null;
  completedCount: number;
  lastCompletion: Readonly<CraftingCompletion> | null;
  revision: number;
}

export interface RepairQuote {
  durationMinutes: number;
  metalCost: number;
  scrapCost: number;
}

function stats(damage: number, defense: number, range: number): EquipmentStats {
  return { armorPierce: 0, attackSpeed: 1, critChance: 0, damage, defense, healthBonus: 0, range };
}

export const CRAFTING_RECIPES: readonly Readonly<CraftingRecipe>[] = Object.freeze([
  Object.freeze({
    description: "A balanced iron blade stronger than the Refuge stores.", durationMinutes: 180,
    id: "iron-sword", metalCost: 10, name: "Iron Sword",
    output: Object.freeze({ slot: "mainHand", stats: Object.freeze(stats(4, 0, 0)), type: "Sword" }),
    scrapCost: 5,
  }),
  Object.freeze({
    description: "A reinforced spear built for measured formation reach.", durationMinutes: 150,
    id: "ranger-spear", metalCost: 8, name: "Ranger Spear",
    output: Object.freeze({ slot: "mainHand", stats: Object.freeze(stats(3, 0, 1.2)), type: "Spear" }),
    scrapCost: 4,
  }),
  Object.freeze({
    description: "A layered iron shield made to hold the front line.", durationMinutes: 180,
    id: "ward-shield", metalCost: 9, name: "Ward Shield",
    output: Object.freeze({ slot: "offHand", stats: Object.freeze(stats(0, 5, 0)), type: "Shield" }),
    scrapCost: 4,
  }),
]);

export class CraftingSystem {
  private activeJob: SmithyJob | null = null;
  private completedCount = 0;
  private lastCompletion: CraftingCompletion | null = null;
  private nextJobId = 1;
  private revision = 0;
  private snapshot: CraftingSnapshot = this.createSnapshot();

  getSnapshot(): Readonly<CraftingSnapshot> { return this.snapshot; }

  getRecipe(id: CraftingRecipeId): Readonly<CraftingRecipe> | undefined {
    return CRAFTING_RECIPES.find((recipe) => recipe.id === id);
  }

  canBegin(): boolean { return this.activeJob === null; }

  beginCraft(recipeId: CraftingRecipeId): boolean {
    const recipe = this.getRecipe(recipeId);
    if (!recipe || this.activeJob) return false;
    this.activeJob = {
      durationMinutes: recipe.durationMinutes,
      id: `smithy-job-${this.nextJobId++}`,
      itemId: null,
      kind: "Craft",
      label: recipe.name,
      progressMinutes: 0,
      recipeId,
    };
    this.commit();
    return true;
  }

  beginRepair(item: Readonly<EquipmentItem>): boolean {
    if (this.activeJob || item.durability >= 100) return false;
    const quote = getRepairQuote(item);
    this.activeJob = {
      durationMinutes: quote.durationMinutes,
      id: `smithy-job-${this.nextJobId++}`,
      itemId: item.id,
      kind: "Repair",
      label: item.name,
      progressMinutes: 0,
      recipeId: null,
    };
    this.commit();
    return true;
  }

  step(gameMinutes: number): Readonly<CraftingCompletion> | null {
    if (!this.activeJob || gameMinutes <= 0) return null;
    const before = Math.floor(this.activeJob.progressMinutes);
    this.activeJob.progressMinutes = Math.min(
      this.activeJob.durationMinutes,
      this.activeJob.progressMinutes + gameMinutes,
    );
    if (this.activeJob.progressMinutes < this.activeJob.durationMinutes) {
      if (Math.floor(this.activeJob.progressMinutes) !== before) this.commit();
      return null;
    }
    const completion: CraftingCompletion = {
      itemId: this.activeJob.itemId,
      jobId: this.activeJob.id,
      kind: this.activeJob.kind,
      quality: this.activeJob.kind === "Craft" ? this.rollQuality(this.activeJob.id, this.activeJob.recipeId) : null,
      recipeId: this.activeJob.recipeId,
    };
    this.activeJob = null;
    this.completedCount += 1;
    this.lastCompletion = completion;
    this.commit();
    return Object.freeze({ ...completion });
  }

  createOutput(
    recipeId: CraftingRecipeId,
    quality: EquipmentQuality,
  ): Readonly<Omit<EquipmentItem, "durability" | "id">> {
    const recipe = this.getRecipe(recipeId);
    if (!recipe) throw new Error(`Unknown crafting recipe: ${recipeId}.`);
    const multiplier = quality === "Excellent" ? 1.5 : quality === "Good" ? 1.25 : 1;
    const rarity: EquipmentRarity = quality === "Excellent" ? "Rare" : quality === "Good" ? "Uncommon" : "Common";
    const scaled = { ...recipe.output.stats };
    scaled.damage = Math.round(scaled.damage * multiplier);
    scaled.defense = Math.round(scaled.defense * multiplier);
    scaled.range = Math.round(scaled.range * multiplier * 10) / 10;
    return Object.freeze({
      description: `${quality} smithwork. ${recipe.description}`,
      name: quality === "Normal" ? recipe.name : `${quality} ${recipe.name}`,
      quality,
      rarity,
      slot: recipe.output.slot,
      stats: Object.freeze(scaled),
      type: recipe.output.type,
    });
  }

  private rollQuality(jobId: string, recipeId: CraftingRecipeId | null): EquipmentQuality {
    const source = `${jobId}:${recipeId ?? "repair"}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const roll = (hash >>> 0) % 100;
    return roll < 10 ? "Excellent" : roll < 38 ? "Good" : "Normal";
  }

  private commit(): void {
    this.revision += 1;
    this.snapshot = this.createSnapshot();
  }

  private createSnapshot(): CraftingSnapshot {
    return Object.freeze({
      activeJob: this.activeJob ? Object.freeze({ ...this.activeJob }) : null,
      completedCount: this.completedCount,
      lastCompletion: this.lastCompletion ? Object.freeze({ ...this.lastCompletion }) : null,
      revision: this.revision,
    });
  }
}

export function getRepairQuote(item: Readonly<EquipmentItem>): Readonly<RepairQuote> {
  const missing = Math.max(0, 100 - item.durability);
  return Object.freeze({
    durationMinutes: Math.max(30, missing * 2),
    metalCost: Math.max(1, Math.ceil(missing / 20)),
    scrapCost: Math.max(1, Math.ceil(missing / 25)),
  });
}
