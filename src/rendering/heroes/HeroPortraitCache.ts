import * as THREE from "three";

import type { Hero } from "../../heroes/Hero";
import { HeroMeshGenerator } from "./HeroMeshGenerator";

interface CachedPortrait {
  signature: string;
  url: string;
}

const PORTRAIT_WIDTH = 320;
const PORTRAIT_HEIGHT = 400;

export class HeroPortraitCache {
  private readonly cache = new Map<string, CachedPortrait>();
  private generation: Promise<void> | null = null;

  get(heroId: string): string | null {
    return this.cache.get(heroId)?.url ?? null;
  }

  generateAll(
    heroes: readonly Readonly<Hero>[],
    onReady: () => void,
  ): Promise<void> {
    if (this.generation) {
      return this.generation;
    }
    const pending = heroes.filter((hero) => {
      const cached = this.cache.get(hero.id);
      return !cached || cached.signature !== this.getSignature(hero);
    });
    if (pending.length === 0) {
      onReady();
      return Promise.resolve();
    }
    this.generation = this.generateBatch(pending)
      .catch(() => undefined)
      .finally(() => {
        this.generation = null;
        onReady();
      });
    return this.generation;
  }

  dispose(): void {
    this.cache.forEach((portrait) => URL.revokeObjectURL(portrait.url));
    this.cache.clear();
  }

  private async generateBatch(heroes: readonly Readonly<Hero>[]): Promise<void> {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#171713");
    scene.add(new THREE.HemisphereLight("#e7e1d4", "#29271f", 2.2));
    const key = new THREE.DirectionalLight("#d8c39d", 3.4);
    key.position.set(-2.4, 4.5, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#697282", 1.8);
    rim.position.set(3, 2.8, -2);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(31, PORTRAIT_WIDTH / PORTRAIT_HEIGHT, 0.1, 20);
    camera.position.set(0, 1.45, 5.15);
    camera.lookAt(0, 1.35, 0);
    const meshGenerator = new HeroMeshGenerator();

    try {
      for (const hero of heroes) {
        const rig = meshGenerator.create(hero);
        this.addPortraitFace(rig.root, hero.appearance.gender === "female" ? 0.26 : 0.28);
        rig.root.position.set(0, -0.1, 0);
        rig.root.rotation.y = -0.2;
        scene.add(rig.root);
        renderer.render(scene, camera);
        const blob = await this.toBlob(renderer.domElement);
        if (blob) {
          const previous = this.cache.get(hero.id);
          if (previous) {
            URL.revokeObjectURL(previous.url);
          }
          this.cache.set(hero.id, {
            signature: this.getSignature(hero),
            url: URL.createObjectURL(blob),
          });
        }
        this.disposeRig(rig.root);
      }
    } finally {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }

  private toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  }

  private getSignature(hero: Readonly<Hero>): string {
    return JSON.stringify(hero.appearance);
  }

  private addPortraitFace(root: THREE.Group, headRadius: number): void {
    const material = new THREE.MeshBasicMaterial({ color: "#211e19" });
    const geometry = new THREE.SphereGeometry(0.026, 8, 6);
    const faceDepth = headRadius * 0.94;
    [-0.082, 0.082].forEach((x) => {
      const eye = new THREE.Mesh(geometry.clone(), material.clone());
      eye.scale.set(1, 0.72, 0.42);
      eye.position.set(x, 1.98, faceDepth);
      root.add(eye);
    });
    geometry.dispose();
    material.dispose();
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
}
