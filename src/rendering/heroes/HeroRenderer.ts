import * as THREE from "three";

import type { Hero } from "../../heroes/Hero";
import { markSelectable } from "../SelectionRaycaster";
import { HeroMeshGenerator } from "./HeroMeshGenerator";

const SPAWN_POINTS = [
  new THREE.Vector3(-2.8, 0.31, -2.1),
  new THREE.Vector3(0, 0.31, -3.15),
  new THREE.Vector3(2.8, 0.31, -2.05),
  new THREE.Vector3(-2.7, 0.31, 2.25),
  new THREE.Vector3(2.65, 0.31, 2.35),
] as const;

export class HeroRenderer {
  private readonly meshGenerator = new HeroMeshGenerator();
  private readonly root = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    heroes: readonly Readonly<Hero>[],
    selectableRoots: THREE.Object3D[],
  ) {
    this.root.name = "Heroes";
    heroes.forEach((hero, index) => {
      const mesh = this.meshGenerator.create(hero);
      const spawnPoint = SPAWN_POINTS[index];
      if (!spawnPoint) {
        throw new Error(`No Phase 2 spawn point exists for hero index ${index}.`);
      }
      mesh.position.copy(spawnPoint);
      mesh.rotation.y = Math.atan2(-spawnPoint.x, -spawnPoint.z);
      markSelectable(mesh, {
        category: "hero",
        detail: `Level ${hero.level} · Rank ${"★".repeat(hero.rank)}`,
        id: hero.id,
        label: hero.name,
      });
      selectableRoots.push(mesh);
      this.root.add(mesh);
    });
    scene.add(this.root);
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
