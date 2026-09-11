export type ProvisionStatus = "Empty" | "Low" | "Stocked";

export interface ResourceEconomySnapshot {
  dailyFoodDemand: number;
  foodConsumed: number;
  foodShortfall: number;
  provisionDays: number | null;
  provisionStatus: ProvisionStatus;
}

export const FOOD_PER_HERO_PER_DAY = 1;
const MINUTES_PER_DAY = 24 * 60;

export class ResourceEconomySystem {
  private foodDemandProgress = 0;
  private foodConsumed = 0;
  private foodShortfall = 0;

  step(
    activeHeroCount: number,
    gameMinutes: number,
    availableFood: number,
    consumeFood: (amount: number) => boolean,
  ): void {
    const heroes = Math.max(0, Math.floor(activeHeroCount));
    const elapsedMinutes = Math.max(0, gameMinutes);
    this.foodDemandProgress += heroes * FOOD_PER_HERO_PER_DAY * elapsedMinutes / MINUTES_PER_DAY;
    const due = Math.floor(this.foodDemandProgress);
    if (due === 0) {
      return;
    }
    this.foodDemandProgress -= due;
    const consumed = Math.min(due, Math.max(0, Math.floor(availableFood)));
    if (consumed > 0 && !consumeFood(consumed)) {
      throw new Error("Food availability and consumption diverged.");
    }
    this.foodConsumed += consumed;
    this.foodShortfall += due - consumed;
  }

  getSnapshot(activeHeroCount: number, availableFood: number): Readonly<ResourceEconomySnapshot> {
    const heroes = Math.max(0, Math.floor(activeHeroCount));
    const food = Math.max(0, Math.floor(availableFood));
    const dailyFoodDemand = heroes * FOOD_PER_HERO_PER_DAY;
    const provisionDays = dailyFoodDemand > 0 ? food / dailyFoodDemand : null;
    const provisionStatus: ProvisionStatus = food === 0
      ? "Empty"
      : provisionDays !== null && provisionDays <= 1
        ? "Low"
        : "Stocked";
    return {
      dailyFoodDemand,
      foodConsumed: this.foodConsumed,
      foodShortfall: this.foodShortfall,
      provisionDays,
      provisionStatus,
    };
  }
}
