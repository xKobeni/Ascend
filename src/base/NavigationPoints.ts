import type { HeroActivity, HeroMovement } from "../heroes/Hero";

export interface NavigationPoint {
  id: string;
  label: string;
  x: number;
  z: number;
}

export type ScheduledActivity = Exclude<HeroActivity, "Idle" | "Walking">;

const createRing = (
  id: string,
  label: string,
  centerX: number,
  centerZ: number,
  radius: number,
  count = 5,
): readonly NavigationPoint[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
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

export const NAVIGATION_POINTS: Readonly<Record<ScheduledActivity, readonly NavigationPoint[]>> = {
  Eating: createRing("campfire-seat", "Campfire", 0, 0, 5.1),
  Resting: createRing("dorm-bed", "Dormitory", -17.1, -13.2, 4.65),
  Socializing: createRing("social-spot", "Campfire Commons", 0, 0, 7.95),
  Training: createRing("training-spot", "Training Area", 16.2, -13.5, 5.1),
};

export const INFIRMARY_NAVIGATION_POINTS: readonly NavigationPoint[] =
  createRing("infirmary-cot", "Infirmary", -10.4, -16.8, 2.15);

export const IDLE_NAVIGATION_POINTS: readonly NavigationPoint[] = [
  ...createRing("storage-work", "Storage", -16.2, 13.5, 4.95, 3),
  { id: "idle-lookout-1", label: "Idle Area", x: -7.2, z: 17.4 },
  { id: "idle-lookout-2", label: "Idle Area", x: 6.6, z: 17.1 },
] as const;

export function createInitialMovement(index: number): HeroMovement {
  const spawnPoint = INITIAL_HERO_SPAWN_POINTS[index];
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
