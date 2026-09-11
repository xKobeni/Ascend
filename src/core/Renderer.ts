import * as THREE from "three";

import { CameraController, type CameraDiagnostics } from "../rendering/CameraController";
import { ProceduralBaseScene } from "../rendering/ProceduralBaseScene";
import { SelectionRaycaster, type SelectionDetails } from "../rendering/SelectionRaycaster";
import { HeroRenderer } from "../rendering/heroes/HeroRenderer";
import type { FallenHeroRecord, Hero } from "../heroes/Hero";
import type { CombatSnapshot } from "../combat/Combat";
import { CombatArenaScene } from "../rendering/combat/CombatArenaScene";

export interface RendererEvents {
  contextLost: undefined;
  contextRestored: undefined;
  selectionChanged: SelectionDetails | null;
}

export class Renderer {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraController: CameraController;
  private readonly baseScene: ProceduralBaseScene;
  private readonly combatArena: CombatArenaScene;
  private readonly combatScene: THREE.Scene;
  private combatMode = false;
  private readonly heroRenderer: HeroRenderer;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly selectableRoots: THREE.Object3D[] = [];
  private readonly selectionRaycaster: SelectionRaycaster;
  private uiInteractionActive = false;
  private readonly resizeObserver: ResizeObserver;
  private readonly onContextLost: (event: Event) => void;
  private readonly onContextRestored: () => void;

  constructor(
    private readonly container: HTMLElement,
    events: {
      emit<Key extends keyof RendererEvents>(event: Key, payload: RendererEvents[Key]): void;
    },
    heroes: readonly Readonly<Hero>[],
  ) {
    this.scene = new THREE.Scene();
    this.combatScene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    this.baseScene = new ProceduralBaseScene(this.scene, this.selectableRoots);
    this.combatArena = new CombatArenaScene(this.combatScene);
    this.heroRenderer = new HeroRenderer(this.scene, heroes, this.selectableRoots);
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    this.selectionRaycaster = new SelectionRaycaster(
      this.camera,
      this.renderer.domElement,
      this.scene,
      this.selectableRoots,
      (selection) => events.emit("selectionChanged", selection),
    );

    this.onContextLost = (event) => {
      event.preventDefault();
      events.emit("contextLost", undefined);
    };
    this.onContextRestored = () => events.emit("contextRestored", undefined);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  render(
    timestampSeconds: number,
    deltaSeconds: number,
    combatSnapshot: Readonly<CombatSnapshot>,
    heroes: readonly Readonly<Hero>[],
    fallenHeroes: readonly Readonly<FallenHeroRecord>[],
  ): void {
    this.cameraController.update(deltaSeconds);
    const combatMode = combatSnapshot.result !== "Idle";
    if (combatMode !== this.combatMode) {
      this.combatMode = combatMode;
      this.syncInputState();
      this.renderer.domElement.setAttribute(
        "aria-label",
        combatMode
          ? "ASCENT combat encounter. Camera input is paused during combat."
          : "ASCENT refuge. Use W A S D or right-drag to pan, Q and E to rotate, and the mouse wheel to zoom.",
      );
    }
    if (combatMode) {
      this.combatArena.update(combatSnapshot, timestampSeconds, this.camera);
      this.renderer.render(this.combatScene, this.camera);
      return;
    }
    this.baseScene.syncMemorials(fallenHeroes);
    this.baseScene.update(timestampSeconds);
    this.heroRenderer.update(heroes, timestampSeconds, deltaSeconds);
    this.selectionRaycaster.update();
    this.renderer.render(this.scene, this.camera);
  }

  getCameraDiagnostics(): CameraDiagnostics {
    return this.cameraController.getDiagnostics();
  }

  setUiInteractionActive(active: boolean): void {
    if (this.uiInteractionActive === active) {
      return;
    }
    this.uiInteractionActive = active;
    this.syncInputState();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.selectionRaycaster.dispose();
    this.cameraController.dispose();
    this.heroRenderer.dispose();
    this.baseScene.dispose();
    this.combatArena.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private syncInputState(): void {
    const enabled = !this.combatMode && !this.uiInteractionActive;
    this.cameraController.setEnabled(enabled);
    this.selectionRaycaster.setEnabled(enabled);
  }
}
