export type DormitoryComfort = "Basic" | "Settled" | "Restorative";

export interface DormitoryTier {
  capacity: number;
  comfort: DormitoryComfort;
  fatigueRecoveryMultiplier: number;
  level: number;
  moraleRecoveryBonus: number;
  upgradeCost: number | null;
}

export interface DormitorySnapshot extends DormitoryTier {
  occupied: number;
}

const DORMITORY_TIERS: readonly Readonly<DormitoryTier>[] = Object.freeze([
  Object.freeze({
    capacity: 5,
    comfort: "Basic",
    fatigueRecoveryMultiplier: 1,
    level: 1,
    moraleRecoveryBonus: 0,
    upgradeCost: 12,
  }),
  Object.freeze({
    capacity: 7,
    comfort: "Settled",
    fatigueRecoveryMultiplier: 1.15,
    level: 2,
    moraleRecoveryBonus: 0.5,
    upgradeCost: 24,
  }),
  Object.freeze({
    capacity: 10,
    comfort: "Restorative",
    fatigueRecoveryMultiplier: 1.3,
    level: 3,
    moraleRecoveryBonus: 1,
    upgradeCost: null,
  }),
]);

export class DormitorySystem {
  private tierIndex = 0;

  getSnapshot(occupied: number, annexBeds = 0): Readonly<DormitorySnapshot> {
    return {
      ...this.getTier(),
      capacity: this.getTier().capacity + Math.max(0, Math.floor(annexBeds)),
      occupied: Math.max(0, Math.floor(occupied)),
    };
  }

  hasCapacity(occupied: number, annexBeds = 0): boolean {
    return Math.max(0, Math.floor(occupied)) < this.getTier().capacity + Math.max(0, Math.floor(annexBeds));
  }

  canUpgrade(availableScrap: number): boolean {
    const cost = this.getTier().upgradeCost;
    return cost !== null && Math.max(0, Math.floor(availableScrap)) >= cost;
  }

  upgrade(): boolean {
    if (this.getTier().upgradeCost === null || this.tierIndex >= DORMITORY_TIERS.length - 1) {
      return false;
    }
    this.tierIndex += 1;
    return true;
  }

  private getTier(): Readonly<DormitoryTier> {
    const tier = DORMITORY_TIERS[this.tierIndex];
    if (!tier) {
      throw new Error(`Unknown dormitory tier index: ${this.tierIndex}.`);
    }
    return tier;
  }
}
