import type { HeroActivity, HeroMovement } from "../heroes/Hero";
import type { RefugeLayoutSnapshot, RefugePoint, RefugeStructureId } from "../refuge/RefugeLayoutSystem";

export interface NavigationPoint {
  id: string;
  label: string;
  x: number;
  z: number;
}

export type ScheduledActivity = Exclude<HeroActivity, "Idle" | "Walking">;

export interface RefugeNavigationPoints {
  activities: Readonly<Record<ScheduledActivity, readonly NavigationPoint[]>>;
  focus: Readonly<Record<Exclude<HeroActivity, "Walking">, RefugePoint>>;
  idle: readonly NavigationPoint[];
  infirmary: readonly NavigationPoint[];
}

const createRing = (
  id: string,
  label: string,
  centerX: number,
  centerZ: number,
  radius: number,
  count = 10,
): readonly NavigationPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const firstWaveSize = Math.ceil(count / 2);
    const slotIndex = index < firstWaveSize
      ? index * 2
      : (index - firstWaveSize) * 2 + 1;
    const angle = (slotIndex / count) * Math.PI * 2 - Math.PI / 2;
    return {
      id: `${id}-${index + 1}`,
      label,
      x: centerX + Math.cos(angle) * radius,
      z: centerZ + Math.sin(angle) * radius,
    };
  });

export const INITIAL_HERO_SPAWN_POINTS: readonly NavigationPoint[] = [
  { id: "arrival-1", label: "Arrival Area", x: -8.4, z: -6.3 },
  { id: "arrival-2", label: "Arrival Area", x: 0, z: -9.45 },
  { id: "arrival-3", label: "Arrival Area", x: 8.4, z: -6.15 },
  { id: "arrival-4", label: "Arrival Area", x: -8.1, z: 6.75 },
  { id: "arrival-5", label: "Arrival Area", x: 7.95, z: 7.05 },
] as const;

export function createRefugeNavigationPoints(layout: Readonly<RefugeLayoutSnapshot>): RefugeNavigationPoints {
  const facility = (id: RefugeStructureId): Readonly<RefugePoint> => {
    const placement = layout.facilities.find((candidate) => candidate.id === id);
    if (!placement) {
      throw new Error(`Refuge layout is missing ${id}.`);
    }
    return placement;
  };
  const dormitory = facility("dormitory");
  const infirmary = facility("infirmary");
  const storage = facility("storage");
  const training = facility("training");
  const campfire = facility("campfire");
  const commandHall = facility("command-hall");
  const active = (id: RefugeStructureId, point: Readonly<RefugePoint>): Readonly<RefugePoint> =>
    layout.facilities.find((candidate) => candidate.id === id)?.placed ? point : commandHall;
  const rest = active("dormitory", dormitory);
  const care = active("infirmary", infirmary);
  const supplies = active("storage", storage);
  const drills = active("training", training);
  return {
    activities: {
      Eating: createRing("campfire-seat", "Campfire", campfire.x, campfire.z, 5.1),
      Resting: createRing("dorm-bed", "Dormitory", rest.x, rest.z, 4.65),
      Socializing: createRing("social-spot", "Campfire Commons", campfire.x, campfire.z, 7.2),
      Training: createRing("training-spot", "Training Area", drills.x, drills.z, 5.1),
    },
    focus: {
      Eating: campfire,
      Idle: commandHall,
      Resting: rest,
      Socializing: campfire,
      Training: drills,
    },
    idle: [
      ...createRing("storage-work", "Storage", supplies.x, supplies.z, 4.95, 6),
      ...createRing("command-idle", "Command Hall", commandHall.x, commandHall.z, 7.2, 4),
    ],
    infirmary: createRing("infirmary-cot", "Infirmary", care.x, care.z, 2.15),
  };
}

export function createInitialMovement(index: number): HeroMovement {
  const base = INITIAL_HERO_SPAWN_POINTS[index % INITIAL_HERO_SPAWN_POINTS.length];
  const arrivalWave = Math.floor(index / INITIAL_HERO_SPAWN_POINTS.length);
  const spawnPoint = base && arrivalWave > 0
    ? {
        ...base,
        id: `arrival-${index + 1}`,
        x: base.x + Math.sin(index * 2.17) * arrivalWave * 1.15,
        z: base.z + Math.cos(index * 2.17) * arrivalWave * 1.15,
      }
    : base;
  if (!spawnPoint) {
    throw new Error(`No initial hero spawn point exists for index ${index}.`);
  }
  return {
    activity: "Idle",
    decisionReason: null,
    decisionSource: "Schedule",
    destinationId: null,
    destinationLabel: null,
    facingRadians: Math.atan2(-spawnPoint.x, -spawnPoint.z),
    position: { x: spawnPoint.x, z: spawnPoint.z },
    targetActivity: "Idle",
  };
}
