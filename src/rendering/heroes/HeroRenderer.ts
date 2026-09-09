import * as THREE from "three";

import type { Hero } from "../../heroes/Hero";
import { markSelectable } from "../SelectionRaycaster";
import { HeroMeshGenerator, type HeroRig } from "./HeroMeshGenerator";

interface RenderedHero {
  phaseOffset: number;
  rig: HeroRig;
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
      this.renderedHeroes.set(hero.id, { phaseOffset: index * 1.37, rig });
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

      const { rig, phaseOffset } = rendered;
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

      const cycle = timestampSeconds + phaseOffset;
      const isWalking = hero.movement.activity === "Walking";
      const isTraining = hero.movement.activity === "Training";
      const swing = isWalking
        ? Math.sin(cycle * 8) * 0.58
        : isTraining
          ? Math.sin(cycle * 5.5) * 0.42
          : 0;
      const bob = isWalking
        ? Math.abs(Math.sin(cycle * 8)) * 0.055
        : isTraining
          ? Math.abs(Math.sin(cycle * 5.5)) * 0.03
          : Math.sin(cycle * 1.7) * 0.008;

      rig.leftArm.rotation.x = swing;
      rig.rightArm.rotation.x = -swing;
      rig.leftLeg.rotation.x = -swing;
      rig.rightLeg.rotation.x = swing;

      if (hero.movement.activity === "Eating") {
        rig.leftArm.rotation.x = -0.72 + Math.sin(cycle * 2.6) * 0.12;
        rig.rightArm.rotation.x = -0.58 + Math.sin(cycle * 2.6 + 0.8) * 0.12;
      }

      const restTilt = hero.movement.activity === "Resting" ? 1.28 : 0;
      rig.root.rotation.z = THREE.MathUtils.lerp(rig.root.rotation.z, restTilt, positionBlend);
      rig.root.position.y = 0.31 + bob + (hero.movement.activity === "Resting" ? 0.24 : 0);
      rig.torso.rotation.y =
        hero.movement.activity === "Socializing" ? Math.sin(cycle * 0.8) * 0.06 : 0;
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
}
