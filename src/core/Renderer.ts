import * as THREE from "three";

import { CameraController, type CameraDiagnostics } from "../rendering/CameraController";
import { ProceduralBaseScene } from "../rendering/ProceduralBaseScene";
import { SelectionRaycaster, type SelectionDetails } from "../rendering/SelectionRaycaster";
import { HeroRenderer } from "../rendering/heroes/HeroRenderer";
import type { Hero } from "../heroes/Hero";
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
  private readonly selectionRaycaster: SelectionRaycaster;
  private readonly resizeObserver: ResizeObserver;
  private readonly onContextLost: (event: Event) => void;
  private readonly onContextRestored: () => void;

  constructor(
    private readonly container: HTMLElement,
    events: {
      emit<Key extends keyof RendererEvents>(event: Key, payload: RendererEvents[Key]): void;
    },
    private readonly heroes: readonly Readonly<Hero>[],
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

    this.baseScene = new ProceduralBaseScene(this.scene);
    this.combatArena = new CombatArenaScene(this.combatScene);
    const selectableRoots = [...this.baseScene.selectableRoots];
    this.heroRenderer = new HeroRenderer(this.scene, heroes, selectableRoots);
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    this.selectionRaycaster = new SelectionRaycaster(
      this.camera,
      this.renderer.domElement,
      this.scene,
      selectableRoots,
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
  ): void {
    this.cameraController.update(deltaSeconds);
    const combatMode = combatSnapshot.result !== "Idle";
    if (combatMode !== this.combatMode) {
      this.combatMode = combatMode;
      this.selectionRaycaster.setEnabled(!combatMode);
      this.renderer.domElement.setAttribute(
        "aria-label",
        combatMode
          ? "ASCENT combat encounter. Use W A S D to pan, Q and E to rotate, and the mouse wheel to zoom."
          : "ASCENT refuge. Use W A S D to pan, Q and E to rotate, and the mouse wheel to zoom.",
      );
    }
    if (combatMode) {
      this.combatArena.update(combatSnapshot, timestampSeconds, this.camera);
      this.renderer.render(this.combatScene, this.camera);
      return;
    }
    this.baseScene.update(timestampSeconds);
    this.heroRenderer.update(this.heroes, timestampSeconds, deltaSeconds);
    this.selectionRaycaster.update();
    this.renderer.render(this.scene, this.camera);
  }

  getCameraDiagnostics(): CameraDiagnostics {
    return this.cameraController.getDiagnostics();
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
}
