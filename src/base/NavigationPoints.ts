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
  { id: "arrival-1", label: "Arrival Area", x: -2.8, z: -2.1 },
  { id: "arrival-2", label: "Arrival Area", x: 0, z: -3.15 },
  { id: "arrival-3", label: "Arrival Area", x: 2.8, z: -2.05 },
  { id: "arrival-4", label: "Arrival Area", x: -2.7, z: 2.25 },
  { id: "arrival-5", label: "Arrival Area", x: 2.65, z: 2.35 },
] as const;

export const NAVIGATION_POINTS: Readonly<Record<ScheduledActivity, readonly NavigationPoint[]>> = {
  Eating: createRing("campfire-seat", "Campfire", 0, 0, 1.7),
  Resting: createRing("dorm-bed", "Dormitory", -5.7, -4.4, 1.55),
  Socializing: createRing("social-spot", "Campfire Commons", 0, 0, 2.65),
  Training: createRing("training-spot", "Training Area", 5.4, -4.5, 1.7),
};

export const IDLE_NAVIGATION_POINTS: readonly NavigationPoint[] = [
  ...createRing("storage-work", "Storage", -5.4, 4.5, 1.65, 3),
  { id: "idle-lookout-1", label: "Idle Area", x: -2.4, z: 5.8 },
  { id: "idle-lookout-2", label: "Idle Area", x: 2.2, z: 5.7 },
] as const;

export function createInitialMovement(index: number): HeroMovement {
  const spawnPoint = INITIAL_HERO_SPAWN_POINTS[index];
  if (!spawnPoint) {
    throw new Error(`No initial hero spawn point exists for index ${index}.`);
  }
  return {
    activity: "Idle",
    destinationId: null,
    destinationLabel: null,
    facingRadians: Math.atan2(-spawnPoint.x, -spawnPoint.z),
    position: { x: spawnPoint.x, z: spawnPoint.z },
    targetActivity: "Idle",
  };
}
