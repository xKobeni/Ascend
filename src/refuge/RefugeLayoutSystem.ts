import { Random } from "../core/Random";

export type RefugeFacilityId = "dormitory" | "infirmary" | "storage" | "training";
export type RefugeLandmarkId = "campfire" | "command-hall" | "dimensional-gate" | "memorial-grounds";
export type RefugeStructureId = RefugeFacilityId | RefugeLandmarkId;
export type RefugeEnvironmentKind = "rock" | "tree";
export type RefugeLayoutTool = RefugeStructureId | "erase-trail" | "trail";

export interface RefugePoint { x: number; z: number; }

export interface RefugeFacilityPlacement extends RefugePoint {
  footprintRadius: number;
  id: RefugeStructureId;
  kind: "facility" | "landmark";
  label: string;
  placed: boolean;
  removable: boolean;
  rotation: number;
}

export interface RefugeTrailCell extends RefugePoint { id: string; }

export interface RefugeEnvironmentPlacement extends RefugePoint {
  footprintRadius: number;
  id: string;
  kind: RefugeEnvironmentKind;
  placed: boolean;
  rotation: number;
  scale: number;
}

export type RefugeTreePlacement = RefugeEnvironmentPlacement;

export interface RefugeLayoutSnapshot {
  expanded: false;
  facilities: readonly Readonly<RefugeFacilityPlacement>[];
  planeSize: number;
  revision: number;
  rocks: readonly Readonly<RefugeEnvironmentPlacement>[];
  seed: number;
  trails: readonly Readonly<RefugeTrailCell>[];
  trees: readonly Readonly<RefugeEnvironmentPlacement>[];
  version: 2;
  worldGridSize: 3;
}

export interface PlacementValidation { message: string; valid: boolean; x: number; z: number; }

interface LayoutHistory {
  environment: RefugeEnvironmentPlacement[];
  facilities: RefugeFacilityPlacement[];
  trails: RefugeTrailCell[];
}

export const REFUGE_GRID_SIZE = 2;
export const REFUGE_PLANE_SIZE = 72;
export const REFUGE_EXPANDED_PLANE_SIZE = 120;
const BUILD_HALF_EXTENT = REFUGE_PLANE_SIZE / 2;
const TREE_COUNT = 28;
const ROCK_COUNT = 16;
const ENVIRONMENT_ATTEMPTS = 520;

const INITIAL_FACILITIES: readonly RefugeFacilityPlacement[] = [
  { footprintRadius: 5.1, id: "command-hall", kind: "landmark", label: "Command Hall", placed: true, removable: false, rotation: 0, x: 0, z: -10 },
  { footprintRadius: 4.2, id: "campfire", kind: "landmark", label: "Campfire Commons", placed: true, removable: false, rotation: 0, x: 0, z: 5 },
  { footprintRadius: 4.8, id: "dimensional-gate", kind: "landmark", label: "Dimensional Gate", placed: true, removable: false, rotation: Math.PI, x: 0, z: 29 },
  { footprintRadius: 5.4, id: "memorial-grounds", kind: "landmark", label: "Memorial Grounds", placed: true, removable: false, rotation: 0, x: 0, z: -29 },
  { footprintRadius: 4.4, id: "dormitory", kind: "facility", label: "Dormitory", placed: true, removable: true, rotation: 0.15, x: -21, z: -11 },
  { footprintRadius: 3.8, id: "infirmary", kind: "facility", label: "Infirmary", placed: true, removable: true, rotation: -0.12, x: -21, z: 11 },
  { footprintRadius: 4.2, id: "storage", kind: "facility", label: "Storage", placed: true, removable: true, rotation: -0.08, x: 21, z: -10 },
  { footprintRadius: 4.5, id: "training", kind: "facility", label: "Training Yard", placed: true, removable: true, rotation: 0.1, x: 21, z: 11 },
] as const;

export class RefugeLayoutSystem {
  private readonly environment = new Map<string, RefugeEnvironmentPlacement>();
  private readonly facilities = new Map<RefugeStructureId, RefugeFacilityPlacement>();
  private history: LayoutHistory | null = null;
  private revision = 0;
  private readonly seed = 0xa5ce21;
  private snapshot: RefugeLayoutSnapshot;
  private readonly trails = new Map<string, RefugeTrailCell>();

  constructor() {
    INITIAL_FACILITIES.forEach((entry) => this.facilities.set(entry.id, { ...entry }));
    this.generateInitialEnvironment().forEach((entry) => this.environment.set(entry.id, entry));
    this.snapshot = this.createSnapshot();
  }

  getSnapshot(): Readonly<RefugeLayoutSnapshot> { return this.snapshot; }

  getFacility(id: RefugeStructureId): Readonly<RefugeFacilityPlacement> {
    const placement = this.facilities.get(id);
    if (!placement) throw new Error(`Unknown Refuge structure: ${id}.`);
    return placement;
  }

  validateFacility(id: RefugeStructureId, x: number, z: number): PlacementValidation {
    const snapped = this.snapPoint(x, z);
    const facility = this.getFacility(id);
    if (Math.abs(snapped.x) + facility.footprintRadius > BUILD_HALF_EXTENT || Math.abs(snapped.z) + facility.footprintRadius > BUILD_HALF_EXTENT) {
      return { ...snapped, message: "Outside the current Refuge boundary.", valid: false };
    }
    const structureOverlap = [...this.facilities.values()].find((other) => other.placed && other.id !== id &&
      Math.hypot(snapped.x - other.x, snapped.z - other.z) < facility.footprintRadius + other.footprintRadius + 0.9);
    if (structureOverlap) return { ...snapped, message: `Overlaps ${structureOverlap.label}.`, valid: false };
    const environmentOverlap = [...this.environment.values()].find((other) => other.placed &&
      Math.hypot(snapped.x - other.x, snapped.z - other.z) < facility.footprintRadius + other.footprintRadius + 0.35);
    if (environmentOverlap) return { ...snapped, message: `Move or remove the ${environmentOverlap.kind} first.`, valid: false };
    if ([...this.trails.values()].some((trail) => Math.hypot(snapped.x - trail.x, snapped.z - trail.z) < facility.footprintRadius + 0.7)) {
      return { ...snapped, message: "Placement blocks a painted trail.", valid: false };
    }
    if (!this.hasConnectedEntrances({ ...facility, ...snapped, placed: true })) {
      return { ...snapped, message: "Placement blocks a critical walking route.", valid: false };
    }
    return { ...snapped, message: "Placement ready.", valid: true };
  }

  moveFacility(id: RefugeStructureId, x: number, z: number, rotation: number): boolean {
    const validation = this.validateFacility(id, x, z);
    if (!validation.valid) return false;
    const current = this.getFacility(id);
    this.captureHistory();
    this.facilities.set(id, { ...current, placed: true, rotation: this.normalizeRotation(rotation), x: validation.x, z: validation.z });
    this.commitMutation();
    return true;
  }

  storeFacility(id: RefugeFacilityId): boolean {
    const current = this.getFacility(id);
    if (!current.removable || !current.placed) return false;
    this.captureHistory();
    this.facilities.set(id, { ...current, placed: false });
    this.commitMutation();
    return true;
  }

  moveEnvironment(id: string, x: number, z: number): boolean {
    const current = this.environment.get(id);
    const validation = this.validateEnvironment(id, x, z);
    if (!current || !validation.valid) return false;
    this.captureHistory();
    this.environment.set(id, { ...current, placed: true, x: validation.x, z: validation.z });
    this.commitMutation();
    return true;
  }

  removeEnvironment(id: string): boolean {
    const current = this.environment.get(id);
    if (!current?.placed) return false;
    this.captureHistory();
    this.environment.set(id, { ...current, placed: false });
    this.commitMutation();
    return true;
  }

  validateEnvironment(id: string, x: number, z: number): PlacementValidation {
    const snapped = this.snapPoint(x, z);
    const item = this.environment.get(id);
    if (!item) return { ...snapped, message: "Unknown environment object.", valid: false };
    if (Math.abs(snapped.x) + item.footprintRadius > BUILD_HALF_EXTENT || Math.abs(snapped.z) + item.footprintRadius > BUILD_HALF_EXTENT) {
      return { ...snapped, message: "Outside the current Refuge boundary.", valid: false };
    }
    const structureOverlap = [...this.facilities.values()].find((facility) => facility.placed &&
      Math.hypot(snapped.x - facility.x, snapped.z - facility.z) < item.footprintRadius + facility.footprintRadius + 0.3);
    if (structureOverlap) return { ...snapped, message: `Too close to ${structureOverlap.label}.`, valid: false };
    const environmentOverlap = [...this.environment.values()].find((other) => other.placed && other.id !== id &&
      Math.hypot(snapped.x - other.x, snapped.z - other.z) < item.footprintRadius + other.footprintRadius + 0.25);
    if (environmentOverlap) return { ...snapped, message: `Overlaps another ${environmentOverlap.kind}.`, valid: false };
    return { ...snapped, message: `${item.kind === "tree" ? "Tree" : "Rock"} placement ready.`, valid: true };
  }

  addTrail(x: number, z: number): boolean {
    const validation = this.validateTrail(x, z);
    if (!validation.valid) return false;
    const id = this.trailId(validation.x, validation.z);
    this.captureHistory();
    this.trails.set(id, { id, x: validation.x, z: validation.z });
    this.commitMutation();
    return true;
  }

  removeTrail(x: number, z: number): boolean {
    const snapped = this.snapPoint(x, z);
    const id = this.trailId(snapped.x, snapped.z);
    if (!this.trails.has(id)) return false;
    const remaining = [...this.trails.values()].filter((trail) => trail.id !== id);
    if (!this.isTrailNetworkConnected(remaining)) return false;
    this.captureHistory();
    this.trails.delete(id);
    this.commitMutation();
    return true;
  }

  validateTrail(x: number, z: number): PlacementValidation {
    const snapped = this.snapPoint(x, z);
    if (Math.abs(snapped.x) > BUILD_HALF_EXTENT || Math.abs(snapped.z) > BUILD_HALF_EXTENT) {
      return { ...snapped, message: "Trail is outside the current Refuge boundary.", valid: false };
    }
    const blocked = [...this.facilities.values()].find((facility) => facility.placed &&
      Math.hypot(snapped.x - facility.x, snapped.z - facility.z) < facility.footprintRadius + 0.65);
    if (blocked) return { ...snapped, message: `${blocked.label} occupies this ground.`, valid: false };
    const id = this.trailId(snapped.x, snapped.z);
    if (this.trails.has(id)) return { ...snapped, message: "A trail already occupies this ground.", valid: false };
    if (!this.isTrailNetworkConnected([...this.trails.values(), { id, ...snapped }])) {
      return { ...snapped, message: "Trail must connect to the campfire commons.", valid: false };
    }
    return { ...snapped, message: "Trail segment ready.", valid: true };
  }

  undo(): boolean {
    if (!this.history) return false;
    this.facilities.clear();
    this.history.facilities.forEach((entry) => this.facilities.set(entry.id, { ...entry }));
    this.environment.clear();
    this.history.environment.forEach((entry) => this.environment.set(entry.id, { ...entry }));
    this.trails.clear();
    this.history.trails.forEach((entry) => this.trails.set(entry.id, { ...entry }));
    this.history = null;
    this.commitMutation();
    return true;
  }

  canUndo(): boolean { return this.history !== null; }

  private captureHistory(): void {
    this.history = {
      environment: [...this.environment.values()].map((entry) => ({ ...entry })),
      facilities: [...this.facilities.values()].map((entry) => ({ ...entry })),
      trails: [...this.trails.values()].map((entry) => ({ ...entry })),
    };
  }

  private commitMutation(): void { this.revision += 1; this.snapshot = this.createSnapshot(); }

  private createSnapshot(): RefugeLayoutSnapshot {
    const facilities = [...this.facilities.values()].map((entry) => Object.freeze({ ...entry }));
    const trails = [...this.trails.values()].map((entry) => Object.freeze({ ...entry }));
    const environment = [...this.environment.values()].map((entry) => Object.freeze({ ...entry }));
    return Object.freeze({
      expanded: false, facilities: Object.freeze(facilities), planeSize: REFUGE_PLANE_SIZE,
      revision: this.revision, rocks: Object.freeze(environment.filter((entry) => entry.kind === "rock")),
      seed: this.seed, trails: Object.freeze(trails), trees: Object.freeze(environment.filter((entry) => entry.kind === "tree")),
      version: 2, worldGridSize: 3,
    });
  }

  private generateInitialEnvironment(): RefugeEnvironmentPlacement[] {
    const random = new Random(this.seed);
    const items: RefugeEnvironmentPlacement[] = [];
    let treeCount = 0;
    let rockCount = 0;
    for (let attempt = 0; attempt < ENVIRONMENT_ATTEMPTS && (treeCount < TREE_COUNT || rockCount < ROCK_COUNT); attempt += 1) {
      const kind: RefugeEnvironmentKind = treeCount < TREE_COUNT && (rockCount >= ROCK_COUNT || random.next() < 0.7) ? "tree" : "rock";
      const edgeBias = Math.pow(random.float(0.18, 1), 0.38);
      const angle = random.float(0, Math.PI * 2);
      const radius = 14 + edgeBias * 19;
      const scale = kind === "tree" ? random.float(0.78, 1.32) : random.float(0.65, 1.18);
      const footprintRadius = kind === "tree" ? 1.35 * scale : 0.9 * scale;
      const candidate: RefugeEnvironmentPlacement = {
        footprintRadius, id: `${kind}-${kind === "tree" ? treeCount + 1 : rockCount + 1}`, kind, placed: true,
        rotation: random.float(0, Math.PI * 2), scale,
        x: Math.round(Math.cos(angle) * radius * 2) / 2, z: Math.round(Math.sin(angle) * radius * 2) / 2,
      };
      if (Math.abs(candidate.x) + footprintRadius > BUILD_HALF_EXTENT - 0.5 || Math.abs(candidate.z) + footprintRadius > BUILD_HALF_EXTENT - 0.5 ||
        INITIAL_FACILITIES.some((facility) => Math.hypot(candidate.x - facility.x, candidate.z - facility.z) < footprintRadius + facility.footprintRadius + 1.3) ||
        items.some((item) => Math.hypot(candidate.x - item.x, candidate.z - item.z) < footprintRadius + item.footprintRadius + 0.7)) continue;
      items.push(candidate);
      if (kind === "tree") treeCount += 1; else rockCount += 1;
    }
    return items;
  }

  private hasConnectedEntrances(candidate: RefugeFacilityPlacement): boolean {
    const facilities = [...this.facilities.values()].map((facility) => facility.id === candidate.id ? candidate : facility).filter((facility) => facility.placed);
    const obstacles = facilities.map(({ footprintRadius: radius, x, z }) => ({ radius: radius + 0.4, x, z }));
    const entrances = facilities.map((facility) => { const point = this.entranceFor(facility); return this.snapPoint(point.x, point.z); });
    const start = this.snapPoint(0, 0);
    const queue = [start];
    const visited = new Set([this.trailId(start.x, start.z)]);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    while (queue.length) {
      const point = queue.shift(); if (!point) break;
      directions.forEach(([dx, dz]) => {
        const next = { x: point.x + dx * REFUGE_GRID_SIZE, z: point.z + dz * REFUGE_GRID_SIZE };
        const key = this.trailId(next.x, next.z);
        if (visited.has(key) || Math.abs(next.x) > BUILD_HALF_EXTENT || Math.abs(next.z) > BUILD_HALF_EXTENT ||
          obstacles.some((obstacle) => Math.hypot(next.x - obstacle.x, next.z - obstacle.z) < obstacle.radius)) return;
        visited.add(key); queue.push(next);
      });
    }
    return entrances.every((point) => visited.has(this.trailId(point.x, point.z)));
  }

  private entranceFor(placement: RefugeFacilityPlacement): RefugePoint {
    return { x: placement.x + Math.sin(placement.rotation) * (placement.footprintRadius + 2.4), z: placement.z + Math.cos(placement.rotation) * (placement.footprintRadius + 2.4) };
  }

  private isTrailNetworkConnected(cells: readonly RefugeTrailCell[]): boolean {
    if (!cells.length) return true;
    const campfire = this.getFacility("campfire");
    const byId = new Map(cells.map((cell) => [cell.id, cell]));
    const queue = cells.filter((cell) => Math.hypot(cell.x - campfire.x, cell.z - campfire.z) <= campfire.footprintRadius + REFUGE_GRID_SIZE);
    if (!queue.length) return false;
    const visited = new Set(queue.map((cell) => cell.id));
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    while (queue.length) {
      const cell = queue.shift(); if (!cell) break;
      directions.forEach(([dx, dz]) => {
        const id = this.trailId(cell.x + dx * REFUGE_GRID_SIZE, cell.z + dz * REFUGE_GRID_SIZE);
        const next = byId.get(id);
        if (!next || visited.has(id)) return;
        visited.add(id); queue.push(next);
      });
    }
    return visited.size === cells.length;
  }

  private normalizeRotation(rotation: number): number { const turn = Math.PI * 2; return ((rotation % turn) + turn) % turn; }
  private snapPoint(x: number, z: number): RefugePoint { return { x: Math.round(x / REFUGE_GRID_SIZE) * REFUGE_GRID_SIZE, z: Math.round(z / REFUGE_GRID_SIZE) * REFUGE_GRID_SIZE }; }
  private trailId(x: number, z: number): string { return `trail:${x}:${z}`; }
}
