import * as THREE from "three";

import type { Hero } from "../../heroes/Hero";
import { markSelectable } from "../SelectionRaycaster";
import { HeroMeshGenerator, type HeroRig } from "./HeroMeshGenerator";
import { placeObjectOnRefugeGround } from "../RefugeGround";
import { getEquippedItems, type EquipmentSnapshot } from "../../equipment/EquipmentSystem";

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
  groundY: number;
  phaseOffset: number;
  rig: HeroRig;
}

const TRANSITION_SPEED = 4;
const EMPTY_EQUIPMENT: Readonly<EquipmentSnapshot> = Object.freeze({
  items: Object.freeze([]), loadouts: Object.freeze([]), revision: 0,
});

function lerpAngle(current: number, target: number, t: number): number {
  const diff = target - current;
  return current + diff * t;
}

export class HeroRenderer {
  private equipmentRevision = -1;
  private readonly meshGenerator = new HeroMeshGenerator();
  private readonly renderedHeroes = new Map<string, RenderedHero>();
  private readonly root = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    heroes: readonly Readonly<Hero>[],
    private readonly selectableRoots: THREE.Object3D[],
    equipment: Readonly<EquipmentSnapshot> = EMPTY_EQUIPMENT,
  ) {
    this.root.name = "Heroes";
    heroes.forEach((hero, index) => this.addHero(hero, index, equipment));
    this.equipmentRevision = equipment.revision;
    scene.add(this.root);
  }

  update(
    heroes: readonly Readonly<Hero>[],
    timestampSeconds: number,
    deltaSeconds: number,
    equipment: Readonly<EquipmentSnapshot> = EMPTY_EQUIPMENT,
  ): void {
    if (equipment.revision !== this.equipmentRevision) {
      this.renderedHeroes.forEach((rendered) => {
        this.removeSelectableRoot(rendered.rig.root);
        this.disposeRig(rendered.rig.root);
      });
      this.renderedHeroes.clear();
      this.equipmentRevision = equipment.revision;
    }
    const activeIds = new Set(heroes.map((hero) => hero.id));
    this.renderedHeroes.forEach((rendered, heroId) => {
      if (activeIds.has(heroId)) {
        return;
      }
      this.removeSelectableRoot(rendered.rig.root);
      this.disposeRig(rendered.rig.root);
      this.renderedHeroes.delete(heroId);
    });
    heroes.forEach((hero, index) => {
      if (!this.renderedHeroes.has(hero.id)) {
        this.addHero(hero, index, equipment);
      }
    });
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

  private addHero(hero: Readonly<Hero>, index: number, equipment: Readonly<EquipmentSnapshot>): void {
    const rig = this.meshGenerator.create(hero, getEquippedItems(equipment, hero.id));
    rig.root.position.set(hero.movement.position.x, 0, hero.movement.position.z);
    const groundY = placeObjectOnRefugeGround(rig.root);
    rig.root.rotation.y = hero.movement.facingRadians;
    markSelectable(rig.root, {
      category: "hero",
      detail: `Level ${hero.level} · Rank ${"★".repeat(hero.rank)}`,
      id: hero.id,
      label: hero.name,
    });
    this.selectableRoots.push(rig.root);
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
      groundY,
      phaseOffset: index * 1.37,
      rig,
    });
  }

  private removeSelectableRoot(root: THREE.Object3D): void {
    const index = this.selectableRoots.indexOf(root);
    if (index >= 0) {
      this.selectableRoots.splice(index, 1);
    }
  }

  private disposeRig(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    root.removeFromParent();
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
    const breathIntensity = hero.movement.activity === "Resting" ? 0.02 : 0.01;
    const breath = Math.sin(anim.breathingPhase) * breathIntensity;
    rig.body.scale.y = 1 + breath;
    rig.body.scale.x = 1 - breath * 0.3;
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
    const postureLean = (1 - discipline) * 0.06 - discipline * 0.03;

    let targetArmLeftX = 0;
    let targetArmRightX = 0;
    let targetLegLeftX = 0;
    let targetLegRightX = 0;
    let targetBodyY = 0;
    let targetBodyZ = 0;
    const groundY = this.renderedHeroes.get(hero.id)?.groundY ?? rig.root.position.y;
    let targetRootY = groundY;
    let targetRootZ = 0;
    let targetHeadX = 0;
    let targetHeadY = 0;

    if (activity === "Walking") {
      const walkSpeed = 8 * movementSpeedMult;
      anim.walkCycle += deltaSeconds * walkSpeed;
      const swing = Math.sin(anim.walkCycle) * 0.5;

      targetArmLeftX = swing * 0.7;
      targetArmRightX = -swing * 0.7;
      targetLegLeftX = -swing * 0.8;
      targetLegRightX = swing * 0.8;
      targetBodyY = Math.sin(anim.walkCycle) * 0.03;
      targetRootY = groundY + Math.abs(Math.sin(anim.walkCycle)) * 0.05;
      targetHeadX = Math.sin(anim.walkCycle * 0.5) * 0.05;
    } else if (activity === "Training") {
      const trainSpeed = 5.5 * movementSpeedMult;
      const twist = Math.sin(cycle * trainSpeed) * 0.3;
      const chop = Math.abs(Math.sin(cycle * trainSpeed * 0.5)) * 0.4;

      targetArmLeftX = -0.2 + twist * 0.5;
      targetArmRightX = -0.6 + chop;
      targetLegLeftX = -0.1;
      targetLegRightX = 0.15;
      targetBodyY = twist * 0.1;
      targetBodyZ = postureLean;
      targetRootY = groundY + Math.abs(Math.sin(cycle * trainSpeed)) * 0.02;
      targetHeadX = -0.1 + Math.sin(cycle * trainSpeed * 0.7) * 0.08;
    } else if (activity === "Eating") {
      const eatCycle = cycle * 2.6;
      const reach = Math.sin(eatCycle) * 0.4;

      targetArmLeftX = -0.4 + reach * 0.2;
      targetArmRightX = -0.7 + Math.abs(Math.sin(eatCycle + 0.8)) * 0.35;
      targetLegLeftX = 0;
      targetLegRightX = 0;
      targetRootY = groundY;
      targetHeadX = -0.12 + Math.sin(eatCycle * 0.5) * 0.06;
      targetHeadY = Math.sin(eatCycle + 1.2) * 0.04;
    } else if (activity === "Socializing") {
      const socialCycle = cycle * 0.8;
      const gesture = Math.sin(socialCycle) * 0.12;
      const nod = Math.sin(socialCycle * 1.5) * 0.1;

      targetArmLeftX = -0.1 + gesture;
      targetArmRightX = -0.15 - gesture * 0.4;
      targetLegLeftX = 0;
      targetLegRightX = 0;
      targetBodyY = Math.sin(socialCycle * 0.6) * 0.04;
      targetRootY = groundY;
      targetHeadX = nod;
      targetHeadY = Math.sin(socialCycle * 0.4) * 0.05;
    } else if (activity === "Resting") {
      const restBreath = Math.sin(anim.breathingPhase * 0.8) * 0.012;

      anim.restShift += deltaSeconds * 0.3;
      const restWiggle = Math.sin(anim.restShift) * 0.02;

      targetArmLeftX = 0.15 + restWiggle;
      targetArmRightX = 0.12 - restWiggle;
      targetLegLeftX = 0.08;
      targetLegRightX = -0.04;
      targetRootY = groundY + 0.17 + restBreath;
      targetRootZ = 1.1;
      targetHeadX = 0.25 + restWiggle * 0.4;
    } else {
      const idleCycle = cycle * 0.5;
      anim.idleLookTimer += deltaSeconds;

      if (anim.idleLookTimer > 3 + bravery * 2) {
        anim.idleLookTimer = 0;
        anim.idleLookTarget = (Math.random() - 0.5) * 0.25;
      }

      const weightShift = Math.sin(idleCycle * 0.7) * 0.025;
      const breathe = Math.sin(anim.breathingPhase) * 0.008;

      targetArmLeftX = -0.06 + weightShift;
      targetArmRightX = -0.08 - weightShift;
      targetLegLeftX = -0.02 + breathe;
      targetLegRightX = 0.02 - breathe;
      targetBodyY = weightShift * 0.4;
      targetBodyZ = postureLean;
      targetRootY = groundY + breathe;
      targetHeadX = lerpAngle(0, anim.idleLookTarget, Math.min(1, deltaSeconds * 2));
      targetHeadY = Math.sin(idleCycle * 1.3) * 0.03;
    }

    rig.armLeft.rotation.x = THREE.MathUtils.lerp(rig.armLeft.rotation.x, targetArmLeftX, t);
    rig.armRight.rotation.x = THREE.MathUtils.lerp(rig.armRight.rotation.x, targetArmRightX, t);
    rig.legLeft.rotation.x = THREE.MathUtils.lerp(rig.legLeft.rotation.x, targetLegLeftX, t);
    rig.legRight.rotation.x = THREE.MathUtils.lerp(rig.legRight.rotation.x, targetLegRightX, t);
    rig.body.rotation.y = THREE.MathUtils.lerp(rig.body.rotation.y, targetBodyY, t);
    rig.body.rotation.z = THREE.MathUtils.lerp(rig.body.rotation.z, targetBodyZ, t);
    rig.root.position.y = THREE.MathUtils.lerp(rig.root.position.y, targetRootY, t);
    rig.root.rotation.z = THREE.MathUtils.lerp(rig.root.rotation.z, targetRootZ, t);
    rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, targetHeadX, t);
    rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, targetHeadY, t);
  }
}
