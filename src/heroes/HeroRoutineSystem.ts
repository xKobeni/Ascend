import {
  createRefugeNavigationPoints,
  type NavigationPoint,
  type RefugeNavigationPoints,
  type ScheduledActivity,
} from "../base/NavigationPoints";
import type { RefugeLayoutSnapshot } from "../refuge/RefugeLayoutSystem";
import type { ConstructionSnapshot } from "../refuge/ConstructionSystem";
import type { Hero, HeroActivity } from "./Hero";
import type { NeedsSystem } from "./NeedsSystem";
import type { TrainingSystem } from "./TrainingSystem";

export type DayPeriod = "Day" | "Evening" | "Morning" | "Night";

export class HeroRoutineSystem {
  private layoutRevision = -1;

  step(
    heroes: readonly Hero[],
    deltaSeconds: number,
    minuteOfDay: number,
    needsSystem: NeedsSystem,
    trainingSystem: TrainingSystem,
    layout: Readonly<RefugeLayoutSnapshot>,
    construction: Readonly<ConstructionSnapshot>,
  ): void {
    const navigation = createRefugeNavigationPoints(layout);
    const layoutChanged = layout.revision !== this.layoutRevision;
    this.layoutRevision = layout.revision;
    const scheduledActivity = this.getScheduledActivity(minuteOfDay);
    heroes.forEach((hero, index) => {
      const site = construction.sites.find((entry) => entry.state !== "Complete" && entry.builderIds.includes(hero.id));
      if (site) {
        const builderIndex = site.builderIds.indexOf(hero.id);
        const destination: NavigationPoint = {
          id: `builder:${site.id}:${hero.id}`,
          label: "Construction Site",
          x: site.x + (builderIndex === 0 ? -1.5 : 1.5),
          z: site.z + 1.6,
        };
        this.assignConstruction(hero, destination, layoutChanged);
        this.moveHero(hero, deltaSeconds, navigation, [destination]);
        return;
      }
      const hasTrainingAssignment = trainingSystem.hasAssignment(hero);
      const decision = needsSystem.chooseActivity(
        hero,
        hasTrainingAssignment ? "Training" : scheduledActivity,
        hasTrainingAssignment,
      );
      const decisionSource =
        hasTrainingAssignment && decision.source === "Schedule" ? "Training" : decision.source;
      const decisionReason =
        decisionSource === "Training" ? "Player-assigned training" : decision.reason;
      this.assignRoutineIfNeeded(
        hero,
        decision.activity,
        decisionSource,
        decisionReason,
        index,
        navigation,
        layoutChanged,
      );
      this.moveHero(hero, deltaSeconds, navigation);
    });
  }

  private assignConstruction(hero: Hero, destination: Readonly<NavigationPoint>, forceAssignment: boolean): void {
    if (!forceAssignment && hero.movement.targetActivity === "Building" && hero.movement.destinationLabel === destination.label &&
      (hero.movement.destinationId === destination.id || hero.movement.activity === "Building")) return;
    hero.movement.targetActivity = "Building";
    hero.movement.decisionSource = "Construction";
    hero.movement.decisionReason = "Assigned to facility construction";
    hero.movement.destinationId = destination.id;
    hero.movement.destinationLabel = destination.label;
    hero.movement.activity = "Walking";
  }

  getDayPeriod(minuteOfDay: number): DayPeriod {
    if (minuteOfDay >= 6 * 60 && minuteOfDay < 10 * 60) {
      return "Morning";
    }
    if (minuteOfDay >= 10 * 60 && minuteOfDay < 17 * 60) {
      return "Day";
    }
    if (minuteOfDay >= 17 * 60 && minuteOfDay < 22 * 60) {
      return "Evening";
    }
    return "Night";
  }

  private getScheduledActivity(minuteOfDay: number): ScheduledActivity {
    const period = this.getDayPeriod(minuteOfDay);
    if (period === "Morning") {
      return "Eating";
    }
    if (period === "Day") {
      return "Training";
    }
    if (period === "Evening") {
      return "Socializing";
    }
    return "Resting";
  }

  private assignRoutineIfNeeded(
    hero: Hero,
    activity: ScheduledActivity,
    decisionSource: "Need" | "Schedule" | "Training",
    decisionReason: string | null,
    heroIndex: number,
    navigation: Readonly<RefugeNavigationPoints>,
    forceAssignment: boolean,
  ): void {
    if (!forceAssignment &&
      hero.movement.targetActivity === activity &&
      hero.movement.decisionSource === decisionSource &&
      hero.movement.decisionReason === decisionReason
    ) {
      return;
    }

    const recovering = decisionReason?.startsWith("Injury recovery") ?? false;
    const destination = recovering
      ? navigation.infirmary[heroIndex]
      : navigation.activities[activity][heroIndex];
    if (!destination) {
      throw new Error(`No ${activity} navigation point exists for hero index ${heroIndex}.`);
    }
    hero.movement.targetActivity = activity;
    hero.movement.decisionSource = decisionSource;
    hero.movement.decisionReason = decisionReason;
    hero.movement.destinationId = destination.id;
    hero.movement.destinationLabel = destination.label;
    hero.movement.activity = "Walking";
  }

  private moveHero(
    hero: Hero,
    deltaSeconds: number,
    navigation: Readonly<RefugeNavigationPoints>,
    extraDestinations: readonly NavigationPoint[] = [],
  ): void {
    if (!hero.movement.destinationId) {
      return;
    }

    const destination = this.findDestination(hero.movement.destinationId, navigation, extraDestinations);
    const deltaX = destination.x - hero.movement.position.x;
    const deltaZ = destination.z - hero.movement.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    const movementSpeed = 1.35 + hero.attributes.agility * 0.075;
    const stepDistance = movementSpeed * deltaSeconds;

    if (distance <= stepDistance || distance < 0.025) {
      hero.movement.position.x = destination.x;
      hero.movement.position.z = destination.z;
      hero.movement.destinationId = null;
      hero.movement.activity = hero.movement.targetActivity;
      if (hero.movement.activity !== "Building") this.faceRoutineFocus(hero, hero.movement.activity, navigation);
      return;
    }

    hero.movement.position.x += (deltaX / distance) * stepDistance;
    hero.movement.position.z += (deltaZ / distance) * stepDistance;
    hero.movement.facingRadians = Math.atan2(deltaX, deltaZ);
    hero.movement.activity = "Walking";
  }

  private findDestination(
    destinationId: string,
    navigation: Readonly<RefugeNavigationPoints>,
    extraDestinations: readonly NavigationPoint[] = [],
  ): NavigationPoint {
    const points = [
      ...extraDestinations,
      ...navigation.idle,
      ...navigation.infirmary,
      ...navigation.activities.Eating,
      ...navigation.activities.Resting,
      ...navigation.activities.Socializing,
      ...navigation.activities.Training,
    ];
    const destination = points.find(({ id }) => id === destinationId);
    if (!destination) {
      throw new Error(`Unknown hero navigation point: ${destinationId}.`);
    }
    return destination;
  }

  private faceRoutineFocus(
    hero: Hero,
    activity: Exclude<HeroActivity, "Building" | "Walking">,
    navigation: Readonly<RefugeNavigationPoints>,
  ): void {
    const focus = navigation.focus[activity];
    hero.movement.facingRadians = Math.atan2(
      focus.x - hero.movement.position.x,
      focus.z - hero.movement.position.z,
    );
  }

}
