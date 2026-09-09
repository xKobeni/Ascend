import { Random } from "../core/Random";
import type { Hero } from "./Hero";

export type RelationshipLabel = "Close Friend" | "Dislike" | "Enemy" | "Friend" | "Neutral";
export type SocialEventType = "argument" | "conversation" | "help" | "training";

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
const INTERACTION_DISTANCE = 12;

export function getRelationshipLabel(value: number): RelationshipLabel {
  if (value <= -60) {
    return "Enemy";
  }
  if (value <= -20) {
    return "Dislike";
  }
  if (value >= 60) {
    return "Close Friend";
  }
  if (value >= 20) {
    return "Friend";
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
        hero.relationships[other.id] = this.clampRelationship(Math.round(affinity));
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
      this.applyMutualModifier(helperPair.actor, helperPair.target, 5, 3);
      this.addEvent(
        helperPair.actor,
        helperPair.target,
        "help",
        5,
        `${helperPair.actor.name} helped injured ${helperPair.target.name}.`,
        day,
        minuteOfDay,
      );
      return;
    }

    if (pair.actor.movement.activity === "Training") {
      this.applyMutualModifier(pair.actor, pair.target, 1, 1);
      this.addEvent(
        pair.actor,
        pair.target,
        "training",
        1,
        `${pair.actor.name} trained with ${pair.target.name}.`,
        day,
        minuteOfDay,
      );
      return;
    }

    const currentRelationship = pair.actor.relationships[pair.target.id] ?? 0;
    const socialTemper =
      pair.actor.personality.empathy +
      pair.target.personality.empathy +
      pair.actor.personality.loyalty * 0.5 +
      currentRelationship / 100 -
      pair.actor.personality.aggression -
      pair.target.personality.aggression -
      (pair.actor.needs.stress + pair.target.needs.stress) / 180;

    if (socialTemper < -0.2) {
      this.applyMutualModifier(pair.actor, pair.target, -4, -4);
      pair.actor.needs.morale = Math.max(0, pair.actor.needs.morale - 2);
      pair.target.needs.morale = Math.max(0, pair.target.needs.morale - 2);
      pair.actor.needs.stress = Math.min(100, pair.actor.needs.stress + 3);
      pair.target.needs.stress = Math.min(100, pair.target.needs.stress + 3);
      this.addEvent(
        pair.actor,
        pair.target,
        "argument",
        -4,
        `${pair.actor.name} argued with ${pair.target.name}.`,
        day,
        minuteOfDay,
      );
      return;
    }

    this.applyMutualModifier(pair.actor, pair.target, 2, 2);
    this.addEvent(
      pair.actor,
      pair.target,
      "conversation",
      2,
      `${pair.actor.name} shared a friendly conversation with ${pair.target.name}.`,
      day,
      minuteOfDay,
    );
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

  private applyMutualModifier(
    actor: Hero,
    target: Hero,
    actorModifier: number,
    targetModifier: number,
  ): void {
    actor.relationships[target.id] = this.clampRelationship(
      (actor.relationships[target.id] ?? 0) + actorModifier,
    );
    target.relationships[actor.id] = this.clampRelationship(
      (target.relationships[actor.id] ?? 0) + targetModifier,
    );
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

  private clampRelationship(value: number): number {
    return Math.min(100, Math.max(-100, value));
  }
}
