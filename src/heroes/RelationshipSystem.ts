import { Random } from "../core/Random";
import type {
  Hero,
  RelationshipEventType,
  RelationshipMetrics,
  RelationshipProfile,
} from "./Hero";

export type RelationshipLabel =
  | "Companion"
  | "Distrust"
  | "Enemy"
  | "Friend"
  | "Neutral"
  | "Rival"
  | "Trusted Friend";
export type SocialEventType = RelationshipEventType;

export interface SocialEvent {
  actorId: string;
  day: number;
  id: number;
  message: string;
  minuteOfDay: number;
  modifier: number;
  targetId: string;
  type: SocialEventType;
}

interface InteractionPair {
  actor: Hero;
  target: Hero;
}

const MAX_EVENTS = 12;
const MAX_RELATIONSHIP_HISTORY = 8;
const INTERACTION_DISTANCE = 12;

export function getRelationshipLabel(profile: Readonly<RelationshipProfile>): RelationshipLabel {
  const { affinity, respect, rivalry, trust } = profile.metrics;
  if (affinity <= -60 || (affinity < -30 && trust <= 15)) {
    return "Enemy";
  }
  if (rivalry >= 65 && respect >= 45) {
    return "Rival";
  }
  if (trust <= 20 && affinity < 10) {
    return "Distrust";
  }
  if (trust >= 70 && affinity >= 45) {
    return "Trusted Friend";
  }
  if (affinity >= 25) {
    return "Friend";
  }
  if (trust >= 45 && respect >= 45) {
    return "Companion";
  }
  return "Neutral";
}

export class RelationshipSystem {
  private readonly events: SocialEvent[] = [];
  private nextEventId = 1;
  private minutesUntilInteraction = 35;

  constructor(private readonly random = Random.fromEntropy()) {}

  initialize(heroes: readonly Hero[]): void {
    heroes.forEach((hero, heroIndex) => {
      heroes.forEach((other, otherIndex) => {
        if (hero.id === other.id || hero.relationships[other.id] !== undefined) {
          return;
        }
        const affinity =
          (hero.personality.empathy - 0.5) * 18 +
          (hero.personality.loyalty - 0.5) * 12 -
          (hero.personality.aggression - 0.5) * 14 +
          (other.personality.empathy - other.personality.aggression) * 8 +
          (heroIndex - otherIndex) * 1.5 +
          this.random.float(-8, 8);
        const trust =
          28 + hero.personality.loyalty * 18 + other.personality.discipline * 12 + this.random.float(-8, 8);
        const respect =
          20 +
          other.attributes.leadership * 2 +
          other.skills.leadership * 2 +
          other.personality.bravery * 14 +
          this.random.float(-6, 6);
        const fear =
          other.personality.aggression * 22 +
          other.attributes.strength * 1.5 -
          hero.personality.bravery * 16 +
          this.random.float(0, 5);
        const rivalry =
          (hero.personality.ambition + other.personality.ambition) * 12 +
          Math.max(0, 5 - Math.abs(hero.level - other.level)) * 2 +
          this.random.float(0, 8);

        hero.relationships[other.id] = {
          history: [],
          metrics: {
            affinity: this.clampSigned(Math.round(affinity)),
            fear: this.clampUnsigned(Math.round(fear)),
            jealousy: this.clampUnsigned(Math.round(this.random.float(0, 14))),
            respect: this.clampUnsigned(Math.round(respect)),
            rivalry: this.clampUnsigned(Math.round(rivalry)),
            trust: this.clampUnsigned(Math.round(trust)),
          },
        };
      });
    });
  }

  step(heroes: readonly Hero[], gameMinutes: number, day: number, minuteOfDay: number): void {
    this.minutesUntilInteraction -= gameMinutes;
    if (this.minutesUntilInteraction > 0) {
      return;
    }

    const pairs = this.getEligiblePairs(heroes);
    if (pairs.length === 0) {
      this.minutesUntilInteraction = 15;
      return;
    }

    const pair = this.random.pick(pairs);
    this.interact(pair, day, minuteOfDay);
    this.minutesUntilInteraction = this.random.float(55, 90);
  }

  getEvents(): readonly Readonly<SocialEvent>[] {
    return this.events;
  }

  private getEligiblePairs(heroes: readonly Hero[]): InteractionPair[] {
    const pairs: InteractionPair[] = [];
    heroes.forEach((actor, actorIndex) => {
      heroes.slice(actorIndex + 1).forEach((target) => {
        if (actor.movement.activity === "Walking" || target.movement.activity === "Walking") {
          return;
        }
        if (this.getDistance(actor, target) > INTERACTION_DISTANCE) {
          return;
        }
        const sharedActivity = actor.movement.activity === target.movement.activity;
        const canHelp =
          (actor.skills.medicine > 0 && target.needs.health < 90) ||
          (target.skills.medicine > 0 && actor.needs.health < 90);
        if (sharedActivity || canHelp) {
          pairs.push({ actor, target });
        }
      });
    });
    return pairs;
  }

  private interact(pair: InteractionPair, day: number, minuteOfDay: number): void {
    const helperPair = this.getHelperPair(pair);
    if (helperPair) {
      const message = `${helperPair.actor.name} helped injured ${helperPair.target.name}.`;
      this.applyMutualInteraction(
        helperPair.actor,
        helperPair.target,
        { affinity: 3, respect: 2, trust: 3 },
        { affinity: 5, respect: 3, trust: 6 },
        "help",
        message,
        day,
        minuteOfDay,
      );
      this.addEvent(helperPair.actor, helperPair.target, "help", 5, message, day, minuteOfDay);
      return;
    }

    if (pair.actor.movement.activity === "Training") {
      const message = `${pair.actor.name} trained with ${pair.target.name}.`;
      this.applyMutualInteraction(
        pair.actor,
        pair.target,
        { affinity: 1, respect: 2, rivalry: 2, trust: 1 },
        { affinity: 1, respect: 2, rivalry: 2, trust: 1 },
        "training",
        message,
        day,
        minuteOfDay,
      );
      this.addEvent(pair.actor, pair.target, "training", 1, message, day, minuteOfDay);
      return;
    }

    const currentRelationship = this.getProfile(pair.actor, pair.target).metrics.affinity;
    const socialTemper =
      pair.actor.personality.empathy +
      pair.target.personality.empathy +
      pair.actor.personality.loyalty * 0.5 +
      currentRelationship / 100 -
      pair.actor.personality.aggression -
      pair.target.personality.aggression -
      (pair.actor.needs.stress + pair.target.needs.stress) / 180;

    if (socialTemper < -0.2) {
      pair.actor.needs.morale = Math.max(0, pair.actor.needs.morale - 2);
      pair.target.needs.morale = Math.max(0, pair.target.needs.morale - 2);
      pair.actor.needs.stress = Math.min(100, pair.actor.needs.stress + 3);
      pair.target.needs.stress = Math.min(100, pair.target.needs.stress + 3);
      const message = `${pair.actor.name} argued with ${pair.target.name}.`;
      this.applyMutualInteraction(
        pair.actor,
        pair.target,
        { affinity: -4, jealousy: 1, rivalry: 3, trust: -3 },
        { affinity: -4, jealousy: 1, rivalry: 3, trust: -3 },
        "argument",
        message,
        day,
        minuteOfDay,
      );
      this.addEvent(pair.actor, pair.target, "argument", -4, message, day, minuteOfDay);
      return;
    }

    const message = `${pair.actor.name} shared a friendly conversation with ${pair.target.name}.`;
    this.applyMutualInteraction(
      pair.actor,
      pair.target,
      { affinity: 2, trust: 1 },
      { affinity: 2, trust: 1 },
      "conversation",
      message,
      day,
      minuteOfDay,
    );
    this.addEvent(pair.actor, pair.target, "conversation", 2, message, day, minuteOfDay);
  }

  private getHelperPair(pair: InteractionPair): InteractionPair | null {
    if (pair.actor.skills.medicine > 0 && pair.target.needs.health < 90) {
      return pair;
    }
    if (pair.target.skills.medicine > 0 && pair.actor.needs.health < 90) {
      return { actor: pair.target, target: pair.actor };
    }
    return null;
  }

  private applyMutualInteraction(
    actor: Hero,
    target: Hero,
    actorChanges: Partial<RelationshipMetrics>,
    targetChanges: Partial<RelationshipMetrics>,
    type: RelationshipEventType,
    summary: string,
    day: number,
    minuteOfDay: number,
  ): void {
    this.applyChanges(this.getProfile(actor, target), actorChanges);
    this.applyChanges(this.getProfile(target, actor), targetChanges);
    this.recordHistory(this.getProfile(actor, target), type, summary, day, minuteOfDay);
    this.recordHistory(this.getProfile(target, actor), type, summary, day, minuteOfDay);
  }

  private applyChanges(
    profile: RelationshipProfile,
    changes: Partial<RelationshipMetrics>,
  ): void {
    (Object.keys(changes) as Array<keyof RelationshipMetrics>).forEach((metric) => {
      const next = profile.metrics[metric] + (changes[metric] ?? 0);
      profile.metrics[metric] =
        metric === "affinity" ? this.clampSigned(next) : this.clampUnsigned(next);
    });
  }

  private recordHistory(
    profile: RelationshipProfile,
    type: RelationshipEventType,
    summary: string,
    day: number,
    minuteOfDay: number,
  ): void {
    profile.history.unshift({ day, minuteOfDay, summary, type });
    profile.history.splice(MAX_RELATIONSHIP_HISTORY);
  }

  private getProfile(actor: Hero, target: Hero): RelationshipProfile {
    const profile = actor.relationships[target.id];
    if (!profile) {
      throw new Error(`Relationship profile missing for ${actor.name} and ${target.name}.`);
    }
    return profile;
  }

  private addEvent(
    actor: Hero,
    target: Hero,
    type: SocialEventType,
    modifier: number,
    message: string,
    day: number,
    minuteOfDay: number,
  ): void {
    this.events.unshift({
      actorId: actor.id,
      day,
      id: this.nextEventId,
      message,
      minuteOfDay,
      modifier,
      targetId: target.id,
      type,
    });
    this.nextEventId += 1;
    this.events.splice(MAX_EVENTS);
  }

  private getDistance(left: Readonly<Hero>, right: Readonly<Hero>): number {
    return Math.hypot(
      left.movement.position.x - right.movement.position.x,
      left.movement.position.z - right.movement.position.z,
    );
  }

  private clampSigned(value: number): number {
    return Math.min(100, Math.max(-100, value));
  }

  private clampUnsigned(value: number): number {
    return Math.min(100, Math.max(0, value));
  }
}
