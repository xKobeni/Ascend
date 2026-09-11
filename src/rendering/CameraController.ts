import * as THREE from "three";

export interface CameraDiagnostics {
  distance: number;
  targetX: number;
  targetZ: number;
  yawDegrees: number;
}

export class CameraController {
  private readonly activeKeys = new Set<string>();
  private activePanPointerId: number | null = null;
  private distance = 57;
  private enabled = true;
  private readonly elevation = THREE.MathUtils.degToRad(43);
  private lastPanPosition: { x: number; y: number } | null = null;
  private readonly target = new THREE.Vector3(0, 0.35, 0);
  private yaw = THREE.MathUtils.degToRad(42);

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly inputElement: HTMLCanvasElement,
  ) {
    this.inputElement.tabIndex = 0;
    this.inputElement.setAttribute(
      "aria-label",
      "ASCENT refuge. Use W A S D or right-drag to pan, Q and E to rotate, and the mouse wheel to zoom.",
    );
    this.inputElement.addEventListener("pointerdown", this.handlePointerDown);
    this.inputElement.addEventListener("pointermove", this.handlePointerMove);
    this.inputElement.addEventListener("pointerup", this.handlePointerUp);
    this.inputElement.addEventListener("pointercancel", this.handlePointerCancel);
    this.inputElement.addEventListener("lostpointercapture", this.handleLostPointerCapture);
    this.inputElement.addEventListener("contextmenu", this.handleContextMenu);
    this.inputElement.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    this.applyCameraTransform();
  }

  update(deltaSeconds: number): void {
    if (!this.enabled) {
      return;
    }
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
      this.clampTarget();
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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.activeKeys.clear();
      this.endPointerPan();
    }
  }

  dispose(): void {
    this.inputElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.inputElement.removeEventListener("pointermove", this.handlePointerMove);
    this.inputElement.removeEventListener("pointerup", this.handlePointerUp);
    this.inputElement.removeEventListener("pointercancel", this.handlePointerCancel);
    this.inputElement.removeEventListener("lostpointercapture", this.handleLostPointerCapture);
    this.inputElement.removeEventListener("contextmenu", this.handleContextMenu);
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

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled) {
      return;
    }
    this.inputElement.focus({ preventScroll: true });
    if (event.button !== 1 && event.button !== 2) {
      return;
    }
    event.preventDefault();
    this.activePanPointerId = event.pointerId;
    this.lastPanPosition = { x: event.clientX, y: event.clientY };
    this.inputElement.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.activePanPointerId || !this.lastPanPosition) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - this.lastPanPosition.x;
    const deltaY = event.clientY - this.lastPanPosition.y;
    this.lastPanPosition = { x: event.clientX, y: event.clientY };

    const viewportHeight = Math.max(this.inputElement.clientHeight, 1);
    const visibleWorldHeight = 2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const worldUnitsPerPixel = visibleWorldHeight / viewportHeight;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.target
      .addScaledVector(right, -deltaX * worldUnitsPerPixel)
      .addScaledVector(forward, deltaY * worldUnitsPerPixel);
    this.clampTarget();
    this.applyCameraTransform();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.activePanPointerId) {
      this.endPointerPan();
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePanPointerId) {
      this.endPointerPan();
    }
  };

  private readonly handleLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePanPointerId) {
      this.activePanPointerId = null;
      this.lastPanPosition = null;
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.enabled) {
      return;
    }
    event.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.036, 30, 84);
    this.applyCameraTransform();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || !this.isCameraKey(event.code) || this.isEditableTarget(event.target)) {
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
    this.endPointerPan();
  };

  private clampTarget(): void {
    this.target.x = THREE.MathUtils.clamp(this.target.x, -24, 24);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -24, 24);
  }

  private endPointerPan(): void {
    if (this.activePanPointerId !== null && this.inputElement.hasPointerCapture(this.activePanPointerId)) {
      this.inputElement.releasePointerCapture(this.activePanPointerId);
    }
    this.activePanPointerId = null;
    this.lastPanPosition = null;
  }

  private isCameraKey(code: string): boolean {
    return ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(code);
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }
}
