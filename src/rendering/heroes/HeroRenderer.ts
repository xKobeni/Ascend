import * as THREE from "three";

import type { Hero } from "../../heroes/Hero";
import { markSelectable } from "../SelectionRaycaster";
import { HeroMeshGenerator, type HeroRig } from "./HeroMeshGenerator";

interface AnimationState {
  breathingPhase: number;
  idleLookTimer: number;
  idleLookTarget: number;
  lastActivity: string;
  restShift: number;
  transitionAlpha: number;
  walkCycle: number;
}

interface RenderedHero {
  anim: AnimationState;
  phaseOffset: number;
  rig: HeroRig;
}

const TRANSITION_SPEED = 4;

function lerpAngle(current: number, target: number, t: number): number {
  const diff = target - current;
  return current + diff * t;
}

export class HeroRenderer {
  private readonly meshGenerator = new HeroMeshGenerator();
  private readonly renderedHeroes = new Map<string, RenderedHero>();
  private readonly root = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    heroes: readonly Readonly<Hero>[],
    selectableRoots: THREE.Object3D[],
  ) {
    this.root.name = "Heroes";
    heroes.forEach((hero, index) => {
      const rig = this.meshGenerator.create(hero);
      rig.root.position.set(hero.movement.position.x, 0.31, hero.movement.position.z);
      rig.root.rotation.y = hero.movement.facingRadians;
      markSelectable(rig.root, {
        category: "hero",
        detail: `Level ${hero.level} · Rank ${"★".repeat(hero.rank)}`,
        id: hero.id,
        label: hero.name,
      });
      selectableRoots.push(rig.root);
      this.root.add(rig.root);
      this.renderedHeroes.set(hero.id, {
        anim: {
          breathingPhase: index * 1.7,
          idleLookTimer: 0,
          idleLookTarget: 0,
          lastActivity: "",
          restShift: 0,
          transitionAlpha: 0,
          walkCycle: index * 2.1,
        },
        phaseOffset: index * 1.37,
        rig,
      });
    });
    scene.add(this.root);
  }

  update(heroes: readonly Readonly<Hero>[], timestampSeconds: number, deltaSeconds: number): void {
    const positionBlend = 1 - Math.exp(-12 * deltaSeconds);
    heroes.forEach((hero) => {
      const rendered = this.renderedHeroes.get(hero.id);
      if (!rendered) {
        return;
      }

      const { anim, phaseOffset, rig } = rendered;
      this.updateTransition(anim, hero.movement.activity, deltaSeconds);
      this.updatePosition(rig, hero, positionBlend);
      this.updateBreathing(rig, hero, anim, deltaSeconds);
      this.updateActivityAnimation(rig, hero, anim, phaseOffset, timestampSeconds, deltaSeconds);
    });
  }

  dispose(): void {
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.root.removeFromParent();
  }

  private updateTransition(anim: AnimationState, activity: string, deltaSeconds: number): void {
    if (anim.lastActivity !== activity) {
      anim.lastActivity = activity;
      anim.transitionAlpha = 0;
    }
    anim.transitionAlpha = Math.min(1, anim.transitionAlpha + deltaSeconds * TRANSITION_SPEED);
  }

  private updatePosition(rig: HeroRig, hero: Readonly<Hero>, positionBlend: number): void {
    rig.root.position.x = THREE.MathUtils.lerp(
      rig.root.position.x,
      hero.movement.position.x,
      positionBlend,
    );
    rig.root.position.z = THREE.MathUtils.lerp(
      rig.root.position.z,
      hero.movement.position.z,
      positionBlend,
    );
    rig.root.rotation.y = hero.movement.facingRadians;
  }

  private updateBreathing(
    rig: HeroRig,
    hero: Readonly<Hero>,
    anim: AnimationState,
    deltaSeconds: number,
  ): void {
    anim.breathingPhase += deltaSeconds * (1.4 + hero.attributes.endurance * 0.08);
    const breathIntensity = hero.movement.activity === "Resting" ? 0.025 : 0.012;
    const breath = Math.sin(anim.breathingPhase) * breathIntensity;
    rig.torso.scale.y = 1 + breath;
    rig.torso.scale.x = 1 - breath * 0.3;
  }

  private updateActivityAnimation(
    rig: HeroRig,
    hero: Readonly<Hero>,
    anim: AnimationState,
    phaseOffset: number,
    timestampSeconds: number,
    deltaSeconds: number,
  ): void {
    const activity = hero.movement.activity;
    const cycle = timestampSeconds + phaseOffset;
    const t = anim.transitionAlpha;

    const discipline = hero.personality.discipline;
    const bravery = hero.personality.bravery;
    const agility = hero.attributes.agility;

    const movementSpeedMult = 0.8 + agility * 0.04;
    const postureLean = (1 - discipline) * 0.08 - discipline * 0.04;
    const energyMult = 1;

    let targetLeftArmX = 0;
    let targetRightArmX = 0;
    let targetLeftLegX = 0;
    let targetRightLegX = 0;
    let targetTorsoY = 0;
    let targetTorsoZ = 0;
    let targetRootY = 0.31;
    let targetRootZ = 0;
    let targetHeadX = 0;
    let targetHeadY = 0;

    if (activity === "Walking") {
      const walkSpeed = 8 * movementSpeedMult * energyMult;
      anim.walkCycle += deltaSeconds * walkSpeed;
      const swing = Math.sin(anim.walkCycle) * 0.65;
      const hipSway = Math.sin(anim.walkCycle) * 0.04;

      targetLeftArmX = swing * 0.9;
      targetRightArmX = -swing * 0.9;
      targetLeftLegX = -swing * 1.1;
      targetRightLegX = swing * 1.1;
      targetTorsoY = hipSway;
      targetTorsoZ = postureLean * 0.5;
      targetRootY = 0.31 + Math.abs(Math.sin(anim.walkCycle)) * 0.07;
      targetHeadX = Math.sin(anim.walkCycle * 0.5) * 0.06;
      targetHeadY = Math.sin(anim.walkCycle) * 0.03;
    } else if (activity === "Training") {
      const trainSpeed = 5.5 * movementSpeedMult;
      const twist = Math.sin(cycle * trainSpeed) * 0.35;
      const chop = Math.abs(Math.sin(cycle * trainSpeed * 0.5)) * 0.5;

      targetLeftArmX = -0.3 + twist * 0.6;
      targetRightArmX = -0.8 + chop;
      targetLeftLegX = -0.15;
      targetRightLegX = 0.2;
      targetTorsoY = twist * 0.12;
      targetTorsoZ = postureLean;
      targetRootY = 0.31 + Math.abs(Math.sin(cycle * trainSpeed)) * 0.025;
      targetHeadX = -0.1 + Math.sin(cycle * trainSpeed * 0.7) * 0.1;
    } else if (activity === "Eating") {
      const eatCycle = cycle * 2.6;
      const reach = Math.sin(eatCycle) * 0.5;

      targetLeftArmX = -0.5 + reach * 0.3;
      targetRightArmX = -0.9 + Math.abs(Math.sin(eatCycle + 0.8)) * 0.45;
      targetLeftLegX = 0;
      targetRightLegX = 0;
      targetRootY = 0.31;
      targetHeadX = -0.15 + Math.sin(eatCycle * 0.5) * 0.08;
      targetHeadY = Math.sin(eatCycle + 1.2) * 0.05;
    } else if (activity === "Socializing") {
      const socialCycle = cycle * 0.8;
      const gesture = Math.sin(socialCycle) * 0.15;
      const nod = Math.sin(socialCycle * 1.5) * 0.12;

      targetLeftArmX = -0.15 + gesture;
      targetRightArmX = -0.2 - gesture * 0.5;
      targetLeftLegX = 0;
      targetRightLegX = 0;
      targetTorsoY = Math.sin(socialCycle * 0.6) * 0.05;
      targetRootY = 0.31;
      targetHeadX = nod;
      targetHeadY = Math.sin(socialCycle * 0.4) * 0.06;
    } else if (activity === "Resting") {
      const restBreath = Math.sin(anim.breathingPhase * 0.8) * 0.015;

      anim.restShift += deltaSeconds * 0.3;
      const restWiggle = Math.sin(anim.restShift) * 0.03;

      targetLeftArmX = 0.2 + restWiggle;
      targetRightArmX = 0.15 - restWiggle;
      targetLeftLegX = 0.1;
      targetRightLegX = -0.05;
      targetRootY = 0.55 + restBreath;
      targetRootZ = 1.28;
      targetHeadX = 0.3 + restWiggle * 0.5;
    } else {
      const idleCycle = cycle * 0.5;
      anim.idleLookTimer += deltaSeconds;

      if (anim.idleLookTimer > 3 + bravery * 2) {
        anim.idleLookTimer = 0;
        anim.idleLookTarget = (Math.random() - 0.5) * 0.3;
      }

      const weightShift = Math.sin(idleCycle * 0.7) * 0.03;
      const breathe = Math.sin(anim.breathingPhase) * 0.01;

      targetLeftArmX = -0.08 + weightShift;
      targetRightArmX = -0.1 - weightShift;
      targetLeftLegX = -0.02 + breathe;
      targetRightLegX = 0.02 - breathe;
      targetTorsoY = weightShift * 0.5;
      targetTorsoZ = postureLean;
      targetRootY = 0.31 + breathe;
      targetHeadX = lerpAngle(0, anim.idleLookTarget, Math.min(1, deltaSeconds * 2));
      targetHeadY = Math.sin(idleCycle * 1.3) * 0.04;
    }

    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, targetLeftArmX, t);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, targetRightArmX, t);
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, targetLeftLegX, t);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, targetRightLegX, t);
    rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, targetTorsoY, t);
    rig.torso.rotation.z = THREE.MathUtils.lerp(rig.torso.rotation.z, targetTorsoZ, t);
    rig.root.position.y = THREE.MathUtils.lerp(rig.root.position.y, targetRootY, t);
    rig.root.rotation.z = THREE.MathUtils.lerp(rig.root.rotation.z, targetRootZ, t);
    rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, targetHeadX, t);
    rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, targetHeadY, t);
  }
}
