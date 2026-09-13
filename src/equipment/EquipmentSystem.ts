import type { Hero } from "../heroes/Hero";

export type EquipmentSlot = "mainHand" | "offHand";
export type WeaponType = "Axe" | "Bow" | "Crossbow" | "Dagger" | "Mace" | "Shield" | "Spear" | "Staff" | "Sword";
export type EquipmentRarity = "Common" | "Epic" | "Legendary" | "Rare" | "Uncommon";
export type EquipmentQuality = "Excellent" | "Good" | "Normal";

export const RARITY_COLORS: Readonly<Record<EquipmentRarity, string>> = Object.freeze({
  Common: "#b0b0b0",
  Epic: "#9c27b0",
  Legendary: "#ff9800",
  Rare: "#2196f3",
  Uncommon: "#4caf50",
});

export interface EquipmentStats {
  armorPierce: number;
  attackSpeed: number;
  critChance: number;
  damage: number;
  defense: number;
  healthBonus: number;
  range: number;
}

export interface EquipmentItem {
  description: string;
  durability: number;
  id: string;
  name: string;
  quality: EquipmentQuality;
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

function s(
  damage: number,
  defense: number,
  range: number,
  armorPierce = 0,
  critChance = 0,
  attackSpeed = 1,
  healthBonus = 0,
): EquipmentStats {
  return { armorPierce, attackSpeed, critChance, damage, defense, healthBonus, range };
}

const STARTING_ITEMS: readonly Readonly<Omit<EquipmentItem, "id" | "quality">>[] = Object.freeze([
  // ── Swords ──
  Object.freeze({ description: "A second serviceable blade from the original stores.", durability: 100, name: "Refuge Sword", rarity: "Common", slot: "mainHand", stats: s(2, 0, 0), type: "Sword" }),
  Object.freeze({ description: "A balanced Refuge blade.", durability: 100, name: "Watcher's Sword", rarity: "Common", slot: "mainHand", stats: s(3, 0, 0), type: "Sword" }),
  Object.freeze({ description: "A knightly blade forged for extended campaigns.", durability: 100, name: "Knight's Longsword", rarity: "Rare", slot: "mainHand", stats: s(5, 0, 0, 0, 0.05), type: "Sword" }),
  Object.freeze({ description: "A dark blade that seems to drink in light.", durability: 100, name: "Voidblade", rarity: "Epic", slot: "mainHand", stats: s(7, 0, 0, 0, 0.08, 1, 10), type: "Sword" }),

  // ── Axes ──
  Object.freeze({ description: "A heavy woodcutter's axe repurposed for war.", durability: 100, name: "Woodcutter's Axe", rarity: "Common", slot: "mainHand", stats: s(4, 0, 0), type: "Axe" }),
  Object.freeze({ description: "A jagged cleaver torn from the Rift itself.", durability: 100, name: "Cleaver of the Rift", rarity: "Rare", slot: "mainHand", stats: s(7, 0, 0, 0, 0.06), type: "Axe" }),
  Object.freeze({ description: "A legendary weapon that splits reality itself.", durability: 100, name: "Worldsplitter", rarity: "Legendary", slot: "mainHand", stats: s(12, 0, 0, 0, 0.15, 0.9, 20), type: "Axe" }),

  // ── Maces ──
  Object.freeze({ description: "A blunt iron weapon that crushes armor.", durability: 100, name: "Iron Mace", rarity: "Common", slot: "mainHand", stats: s(3, 0, 0, 2), type: "Mace" }),
  Object.freeze({ description: "A warhammer that shatters both bone and plate.", durability: 100, name: "Warhammer of Stunning Blows", rarity: "Rare", slot: "mainHand", stats: s(5, 0, 0, 4, 0.04), type: "Mace" }),
  Object.freeze({ description: "An ancient weapon that crumbles the strongest fortifications.", durability: 100, name: "Skullcrusher", rarity: "Epic", slot: "mainHand", stats: s(8, 0, 0, 6, 0.06, 1, 10), type: "Mace" }),

  // ── Daggers ──
  Object.freeze({ description: "A crude Refuge shiv for desperate times.", durability: 100, name: "Refuge Shiv", rarity: "Common", slot: "mainHand", stats: s(1, 0, 0, 0, 0.1, 1.15), type: "Dagger" }),
  Object.freeze({ description: "A whispering blade that finds gaps in armor.", durability: 100, name: "Shadowfang", rarity: "Rare", slot: "mainHand", stats: s(3, 0, 0, 0, 0.12, 1.15), type: "Dagger" }),
  Object.freeze({ description: "A legendary assassin's blade that strikes unseen.", durability: 100, name: "Whisper of Death", rarity: "Epic", slot: "mainHand", stats: s(5, 0, 0, 0, 0.18, 1.18), type: "Dagger" }),

  // ── Spears ──
  Object.freeze({ description: "A long ash-shafted weapon for measured reach.", durability: 100, name: "Ash Spear", rarity: "Common", slot: "mainHand", stats: s(2, 0, 0.8), type: "Spear" }),
  Object.freeze({ description: "A vanguard halberd designed for formation fighting.", durability: 100, name: "Halberd of the Vanguard", rarity: "Rare", slot: "mainHand", stats: s(4, 0, 1.2, 0, 0.04, 1, 10), type: "Spear" }),
  Object.freeze({ description: "A dragoon's lance that reaches across battlefields.", durability: 100, name: "Dragoon's Lance", rarity: "Legendary", slot: "mainHand", stats: s(7, 0, 1.8, 0, 0.1, 1, 15), type: "Spear" }),

  // ── Staves ──
  Object.freeze({ description: "A staff channeled with restorative energy.", durability: 100, name: "Healing Staff", rarity: "Common", slot: "mainHand", stats: s(1, 0, 2.5, 0, 0, 1, 0), type: "Staff" }),
  Object.freeze({ description: "An archon's staff that amplifies healing magic.", durability: 100, name: "Archon's Staff", rarity: "Rare", slot: "mainHand", stats: s(3, 0, 3.5, 0, 0.04, 1, 10), type: "Staff" }),

  // ── Bows ──
  Object.freeze({ description: "A compact bow recovered near the Gate.", durability: 100, name: "Wayfarer's Bow", rarity: "Uncommon", slot: "mainHand", stats: s(1, 0, 4.5), type: "Bow" }),
  Object.freeze({ description: "A ranger's bow strung with reinforced sinew.", durability: 100, name: "Ranger's Recurve", rarity: "Rare", slot: "mainHand", stats: s(3, 0, 5.5, 0, 0.08), type: "Bow" }),
  Object.freeze({ description: "A legendary bow that pierces the boundaries of the Rift.", durability: 100, name: "Riftpiercer", rarity: "Epic", slot: "mainHand", stats: s(5, 0, 7.0, 0, 0.12, 0.95, 10), type: "Bow" }),

  // ── Crossbows ──
  Object.freeze({ description: "A heavy siege crossbow for devastating shots.", durability: 100, name: "Siege Crossbow", rarity: "Rare", slot: "mainHand", stats: s(6, 0, 3.5, 0, 0.05, 0.85), type: "Crossbow" }),
  Object.freeze({ description: "A legendary arbalest that punches through anything.", durability: 100, name: "Arbalest of Ruin", rarity: "Legendary", slot: "mainHand", stats: s(10, 0, 5.0, 0, 0.1, 0.85, 15), type: "Crossbow" }),

  // ── Shields ──
  Object.freeze({ description: "A light wooden shield for formation defense.", durability: 100, name: "Refuge Shield", rarity: "Common", slot: "offHand", stats: s(0, 3, 0), type: "Shield" }),
  Object.freeze({ description: "A scarred shield reinforced for another campaign.", durability: 100, name: "Bronze-Bound Shield", rarity: "Uncommon", slot: "offHand", stats: s(0, 4, 0), type: "Shield" }),
  Object.freeze({ description: "An aegis recovered from a fallen champion.", durability: 100, name: "Aegis of the Fallen", rarity: "Rare", slot: "offHand", stats: s(0, 7, 0, 0, 0, 1, 15), type: "Shield" }),
  Object.freeze({ description: "A bulwark forged in the heart of the Rift.", durability: 100, name: "Bulwark of the Rift", rarity: "Epic", slot: "offHand", stats: s(0, 10, 0, 0, 0, 1, 20), type: "Shield" }),
]);

const EMPTY_STATS: Readonly<EquipmentStats> = Object.freeze({
  armorPierce: 0, attackSpeed: 1, critChance: 0, damage: 0, defense: 0, healthBonus: 0, range: 0,
});

const EMPTY_MODIFIERS: Readonly<EquipmentModifiers> = Object.freeze({
  ...EMPTY_STATS, mainHandType: null, offHandType: null,
});

export class EquipmentSystem {
  private readonly items = new Map<string, EquipmentItem>();
  private readonly loadouts = new Map<string, HeroEquipment>();
  private nextItemId = STARTING_ITEMS.length + 1;
  private revision = 0;
  private snapshot: EquipmentSnapshot;

  constructor() {
    STARTING_ITEMS.forEach((item, index) => {
      const id = `equipment-${index + 1}`;
      this.items.set(id, {
        ...item,
        id,
        quality: "Normal",
        stats: { ...item.stats },
      });
    });
    this.snapshot = this.createSnapshot();
  }

  getSnapshot(): Readonly<EquipmentSnapshot> { return this.snapshot; }

  addCraftedItem(item: Readonly<Omit<EquipmentItem, "durability" | "id">>): Readonly<EquipmentItem> {
    const created: EquipmentItem = {
      ...item,
      durability: 100,
      id: `equipment-${this.nextItemId++}`,
      stats: { ...item.stats },
    };
    this.items.set(created.id, created);
    this.commit();
    return Object.freeze({ ...created, stats: Object.freeze({ ...created.stats }) });
  }

  repair(itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item || item.durability >= 100) return false;
    item.durability = 100;
    this.commit();
    return true;
  }

  getModifiers(heroId: string): Readonly<EquipmentModifiers> {
    const loadout = this.loadouts.get(heroId);
    if (!loadout) return EMPTY_MODIFIERS;
    const equipped = [loadout.mainHand, loadout.offHand]
      .map((id) => id ? this.items.get(id) : undefined)
      .filter((item): item is EquipmentItem => item !== undefined && item.durability > 0);
    return equipped.reduce<EquipmentModifiers>((result, item) => ({
      armorPierce: result.armorPierce + item.stats.armorPierce,
      attackSpeed: result.attackSpeed * (item.stats.attackSpeed === 1 ? 1 : item.stats.attackSpeed),
      critChance: result.critChance + item.stats.critChance,
      damage: result.damage + item.stats.damage,
      defense: result.defense + item.stats.defense,
      healthBonus: result.healthBonus + item.stats.healthBonus,
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
