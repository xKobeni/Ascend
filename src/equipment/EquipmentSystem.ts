import type { Hero } from "../heroes/Hero";

export type EquipmentSlot = "mainHand" | "offHand";
export type WeaponType = "Bow" | "Shield" | "Spear" | "Sword";
export type EquipmentRarity = "Common" | "Uncommon";

export interface EquipmentStats {
  damage: number;
  defense: number;
  range: number;
}

export interface EquipmentItem {
  description: string;
  durability: number;
  id: string;
  name: string;
  rarity: EquipmentRarity;
  slot: EquipmentSlot;
  stats: EquipmentStats;
  type: WeaponType;
}

export interface HeroEquipment {
  heroId: string;
  mainHand: string | null;
  offHand: string | null;
}

export interface EquipmentSnapshot {
  items: readonly Readonly<EquipmentItem>[];
  loadouts: readonly Readonly<HeroEquipment>[];
  revision: number;
}

export interface EquipmentModifiers extends EquipmentStats {
  mainHandType: Exclude<WeaponType, "Shield"> | null;
  offHandType: "Shield" | null;
}

const STARTING_ITEMS: readonly Readonly<Omit<EquipmentItem, "id">>[] = Object.freeze([
  Object.freeze({ description: "A balanced Refuge blade.", durability: 100, name: "Watcher's Sword", rarity: "Common", slot: "mainHand", stats: Object.freeze({ damage: 3, defense: 0, range: 0 }), type: "Sword" }),
  Object.freeze({ description: "A second serviceable blade from the original stores.", durability: 100, name: "Refuge Sword", rarity: "Common", slot: "mainHand", stats: Object.freeze({ damage: 2, defense: 0, range: 0 }), type: "Sword" }),
  Object.freeze({ description: "A long ash-shafted weapon for measured reach.", durability: 100, name: "Ash Spear", rarity: "Common", slot: "mainHand", stats: Object.freeze({ damage: 2, defense: 0, range: 0.8 }), type: "Spear" }),
  Object.freeze({ description: "A compact bow recovered near the Gate.", durability: 100, name: "Wayfarer's Bow", rarity: "Uncommon", slot: "mainHand", stats: Object.freeze({ damage: 1, defense: 0, range: 4.5 }), type: "Bow" }),
  Object.freeze({ description: "A scarred shield reinforced for another campaign.", durability: 100, name: "Bronze-Bound Shield", rarity: "Uncommon", slot: "offHand", stats: Object.freeze({ damage: 0, defense: 4, range: 0 }), type: "Shield" }),
  Object.freeze({ description: "A light wooden shield for formation defense.", durability: 100, name: "Refuge Shield", rarity: "Common", slot: "offHand", stats: Object.freeze({ damage: 0, defense: 3, range: 0 }), type: "Shield" }),
]);

const EMPTY_MODIFIERS: Readonly<EquipmentModifiers> = Object.freeze({
  damage: 0, defense: 0, mainHandType: null, offHandType: null, range: 0,
});

export class EquipmentSystem {
  private readonly items = new Map<string, EquipmentItem>();
  private readonly loadouts = new Map<string, HeroEquipment>();
  private revision = 0;
  private snapshot: EquipmentSnapshot;

  constructor() {
    STARTING_ITEMS.forEach((item, index) => this.items.set(`equipment-${index + 1}`, { ...item, id: `equipment-${index + 1}`, stats: { ...item.stats } }));
    this.snapshot = this.createSnapshot();
  }

  getSnapshot(): Readonly<EquipmentSnapshot> { return this.snapshot; }

  getModifiers(heroId: string): Readonly<EquipmentModifiers> {
    const loadout = this.loadouts.get(heroId);
    if (!loadout) return EMPTY_MODIFIERS;
    const equipped = [loadout.mainHand, loadout.offHand]
      .map((id) => id ? this.items.get(id) : undefined)
      .filter((item): item is EquipmentItem => item !== undefined && item.durability > 0);
    return equipped.reduce<EquipmentModifiers>((result, item) => ({
      damage: result.damage + item.stats.damage,
      defense: result.defense + item.stats.defense,
      mainHandType: item.slot === "mainHand" ? item.type as Exclude<WeaponType, "Shield"> : result.mainHandType,
      offHandType: item.type === "Shield" ? "Shield" : result.offHandType,
      range: result.range + item.stats.range,
    }), { ...EMPTY_MODIFIERS });
  }

  equip(heroId: string, itemId: string, heroes: readonly Readonly<Hero>[]): boolean {
    if (!heroes.some((hero) => hero.id === heroId)) return false;
    const item = this.items.get(itemId);
    if (!item || item.durability <= 0) return false;
    this.loadouts.forEach((loadout) => {
      if (loadout.mainHand === itemId) loadout.mainHand = null;
      if (loadout.offHand === itemId) loadout.offHand = null;
    });
    const loadout = this.loadouts.get(heroId) ?? { heroId, mainHand: null, offHand: null };
    loadout[item.slot] = itemId;
    this.loadouts.set(heroId, loadout);
    this.commit();
    return true;
  }

  unequip(heroId: string, slot: EquipmentSlot): boolean {
    const loadout = this.loadouts.get(heroId);
    if (!loadout || loadout[slot] === null) return false;
    loadout[slot] = null;
    this.commit();
    return true;
  }

  removeMissingHeroes(heroes: readonly Readonly<Hero>[]): void {
    const active = new Set(heroes.map((hero) => hero.id));
    let changed = false;
    this.loadouts.forEach((_loadout, heroId) => {
      if (active.has(heroId)) return;
      this.loadouts.delete(heroId);
      changed = true;
    });
    if (changed) this.commit();
  }

  applyExpeditionWear(heroIds: readonly string[], outcome: "Defeat" | "Victory" | "Withdrawn"): void {
    const wear = outcome === "Defeat" ? 5 : outcome === "Withdrawn" ? 3 : 2;
    let changed = false;
    heroIds.forEach((heroId) => {
      const loadout = this.loadouts.get(heroId);
      if (!loadout) return;
      [loadout.mainHand, loadout.offHand].forEach((itemId) => {
        const item = itemId ? this.items.get(itemId) : undefined;
        if (!item || item.durability <= 0) return;
        item.durability = Math.max(0, item.durability - wear);
        changed = true;
      });
    });
    if (changed) this.commit();
  }

  private commit(): void { this.revision += 1; this.snapshot = this.createSnapshot(); }

  private createSnapshot(): EquipmentSnapshot {
    return Object.freeze({
      items: Object.freeze([...this.items.values()].map((item) => Object.freeze({ ...item, stats: Object.freeze({ ...item.stats }) }))),
      loadouts: Object.freeze([...this.loadouts.values()].map((loadout) => Object.freeze({ ...loadout }))),
      revision: this.revision,
    });
  }
}

export function getEquippedItems(snapshot: Readonly<EquipmentSnapshot>, heroId: string): readonly Readonly<EquipmentItem>[] {
  const loadout = snapshot.loadouts.find((entry) => entry.heroId === heroId);
  if (!loadout) return [];
  return [loadout.mainHand, loadout.offHand]
    .map((id) => snapshot.items.find((item) => item.id === id))
    .filter((item): item is Readonly<EquipmentItem> => item !== undefined);
}
