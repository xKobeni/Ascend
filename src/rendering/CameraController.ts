import * as THREE from "three";

export interface CameraDiagnostics {
  distance: number;
  targetX: number;
  targetZ: number;
  yawDegrees: number;
}

export class CameraController {
  private readonly activeKeys = new Set<string>();
  private distance = 19;
  private readonly elevation = THREE.MathUtils.degToRad(43);
  private readonly target = new THREE.Vector3(0, 0.35, 0);
  private yaw = THREE.MathUtils.degToRad(42);

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly inputElement: HTMLCanvasElement,
  ) {
    this.inputElement.tabIndex = 0;
    this.inputElement.setAttribute(
      "aria-label",
      "ASCENT refuge. Use W A S D to pan, Q and E to rotate, and the mouse wheel to zoom.",
    );
    this.inputElement.addEventListener("pointerdown", this.handlePointerDown);
    this.inputElement.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    this.applyCameraTransform();
  }

  update(deltaSeconds: number): void {
    const rotationDirection = Number(this.activeKeys.has("KeyQ")) - Number(this.activeKeys.has("KeyE"));
    if (rotationDirection !== 0) {
      this.yaw += rotationDirection * deltaSeconds * 1.15;
    }

    const forwardAmount = Number(this.activeKeys.has("KeyW")) - Number(this.activeKeys.has("KeyS"));
    const rightAmount = Number(this.activeKeys.has("KeyD")) - Number(this.activeKeys.has("KeyA"));

    if (forwardAmount !== 0 || rightAmount !== 0) {
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const movement = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount));
      movement.normalize().multiplyScalar(deltaSeconds * 7.5);
      this.target.add(movement);
      this.target.x = THREE.MathUtils.clamp(this.target.x, -8, 8);
      this.target.z = THREE.MathUtils.clamp(this.target.z, -8, 8);
    }

    this.applyCameraTransform();
  }

  getDiagnostics(): CameraDiagnostics {
    return {
      distance: this.distance,
      targetX: this.target.x,
      targetZ: this.target.z,
      yawDegrees: THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(this.yaw), 360),
    };
  }

  dispose(): void {
    this.inputElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.inputElement.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
  }

  private applyCameraTransform(): void {
    const horizontalDistance = Math.cos(this.elevation) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontalDistance,
      this.target.y + Math.sin(this.elevation) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontalDistance,
    );
    this.camera.lookAt(this.target);
  }

  private readonly handlePointerDown = (): void => {
    this.inputElement.focus({ preventScroll: true });
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.012, 10, 28);
    this.applyCameraTransform();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isCameraKey(event.code) || this.isEditableTarget(event.target)) {
      return;
    }
    event.preventDefault();
    this.activeKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.activeKeys.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.activeKeys.clear();
  };

  private isCameraKey(code: string): boolean {
    return ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(code);
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }
}
