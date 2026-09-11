import * as THREE from "three";

export interface CameraDiagnostics {
  distance: number;
  pitchDegrees: number;
  targetX: number;
  targetZ: number;
  yawDegrees: number;
}

export type CameraControlScheme = "ascent" | "prototype";

export class CameraController {
  private static readonly DAMPING_RATE = 5;
  private static readonly MAX_DISTANCE = 130;
  private static readonly MAX_PITCH = THREE.MathUtils.degToRad(86.4);
  private static readonly MIN_DISTANCE = 14;
  private static readonly MIN_PITCH = THREE.MathUtils.degToRad(3.6);
  private readonly activeKeys = new Set<string>();
  private activePointerId: number | null = null;
  private activePointerMode: "orbit" | "pan" | "zoom" | null = null;
  private controlScheme: CameraControlScheme = "ascent";
  private distance = Math.sqrt(38 ** 2 + 40 ** 2 + 46 ** 2);
  private desiredDistance = this.distance;
  private enabled = true;
  private lastPointerPosition: { x: number; y: number } | null = null;
  private pitch = Math.asin(40 / this.distance);
  private desiredPitch = this.pitch;
  private readonly target = new THREE.Vector3(0, 0.35, 0);
  private readonly desiredTarget = this.target.clone();
  private yaw = Math.atan2(38, 46);
  private desiredYaw = this.yaw;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly inputElement: HTMLCanvasElement,
  ) {
    this.inputElement.tabIndex = 0;
    this.updateAriaLabel();
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
      this.desiredYaw += rotationDirection * deltaSeconds * 1.15;
    }

    const keyboardPanEnabled = this.controlScheme === "ascent";
    const forwardAmount = keyboardPanEnabled
      ? Number(this.activeKeys.has("KeyW")) - Number(this.activeKeys.has("KeyS"))
      : 0;
    const rightAmount = keyboardPanEnabled
      ? Number(this.activeKeys.has("KeyD")) - Number(this.activeKeys.has("KeyA"))
      : 0;

    if (forwardAmount !== 0 || rightAmount !== 0) {
      const forward = new THREE.Vector3(-Math.sin(this.desiredYaw), 0, -Math.cos(this.desiredYaw));
      const right = new THREE.Vector3(Math.cos(this.desiredYaw), 0, -Math.sin(this.desiredYaw));
      const movement = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount));
      movement.normalize().multiplyScalar(deltaSeconds * 7.5);
      this.desiredTarget.add(movement);
      this.clampTarget(this.desiredTarget);
    }

    const damping = 1 - Math.exp(-CameraController.DAMPING_RATE * Math.min(deltaSeconds, 0.1));
    this.yaw += (this.desiredYaw - this.yaw) * damping;
    this.pitch += (this.desiredPitch - this.pitch) * damping;
    this.distance += (this.desiredDistance - this.distance) * damping;
    this.target.lerp(this.desiredTarget, damping);
    this.applyCameraTransform();
  }

  getDiagnostics(): CameraDiagnostics {
    return {
      distance: this.distance,
      pitchDegrees: THREE.MathUtils.radToDeg(this.pitch),
      targetX: this.target.x,
      targetZ: this.target.z,
      yawDegrees: THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(this.yaw), 360),
    };
  }

  getInputDescription(): string {
    return this.controlScheme === "prototype"
      ? "ASCENT refuge. Left-drag orbits, right-drag pans, middle-drag or the mouse wheel zooms, and Q and E rotate."
      : "ASCENT refuge. Right-drag orbits, middle-drag or W A S D pans, Q and E rotate, and the mouse wheel zooms.";
  }

  panBy(x: number, z: number): void {
    if (!this.enabled) {
      return;
    }
    this.desiredTarget.x += x;
    this.desiredTarget.z += z;
    this.clampTarget(this.desiredTarget);
  }

  setControlScheme(scheme: CameraControlScheme): void {
    if (this.controlScheme === scheme) return;
    this.controlScheme = scheme;
    this.activeKeys.clear();
    this.endPointerGesture();
    this.updateAriaLabel();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.activeKeys.clear();
      this.endPointerGesture();
      this.desiredYaw = this.yaw;
      this.desiredPitch = this.pitch;
      this.desiredDistance = this.distance;
      this.desiredTarget.copy(this.target);
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
    const horizontalDistance = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontalDistance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontalDistance,
    );
    this.camera.lookAt(this.target);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled) {
      return;
    }
    this.inputElement.focus({ preventScroll: true });
    const pointerMode = this.pointerModeForButton(event.button);
    if (!pointerMode) return;
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.activePointerMode = pointerMode;
    this.lastPointerPosition = { x: event.clientX, y: event.clientY };
    this.inputElement.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.activePointerId || !this.lastPointerPosition) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - this.lastPointerPosition.x;
    const deltaY = event.clientY - this.lastPointerPosition.y;
    this.lastPointerPosition = { x: event.clientX, y: event.clientY };

    if (this.activePointerMode === "orbit") {
      this.desiredYaw -= deltaX * 0.005;
      this.desiredPitch = THREE.MathUtils.clamp(
        this.desiredPitch - deltaY * 0.005,
        CameraController.MIN_PITCH,
        CameraController.MAX_PITCH,
      );
      return;
    }

    if (this.activePointerMode === "zoom") {
      this.desiredDistance = THREE.MathUtils.clamp(
        this.desiredDistance * Math.exp(deltaY * 0.006),
        CameraController.MIN_DISTANCE,
        CameraController.MAX_DISTANCE,
      );
      return;
    }

    const viewportHeight = Math.max(this.inputElement.clientHeight, 1);
    const visibleWorldHeight = 2 * this.desiredDistance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const worldUnitsPerPixel = visibleWorldHeight / viewportHeight;
    const forward = new THREE.Vector3(-Math.sin(this.desiredYaw), 0, -Math.cos(this.desiredYaw));
    const right = new THREE.Vector3(Math.cos(this.desiredYaw), 0, -Math.sin(this.desiredYaw));
    this.desiredTarget
      .addScaledVector(right, -deltaX * worldUnitsPerPixel)
      .addScaledVector(forward, -deltaY * worldUnitsPerPixel);
    this.clampTarget(this.desiredTarget);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) {
      this.endPointerGesture();
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) {
      this.endPointerGesture();
    }
  };

  private readonly handleLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) {
      this.activePointerId = null;
      this.activePointerMode = null;
      this.lastPointerPosition = null;
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
    this.desiredDistance = THREE.MathUtils.clamp(
      this.desiredDistance * Math.exp(event.deltaY * 0.0012),
      CameraController.MIN_DISTANCE,
      CameraController.MAX_DISTANCE,
    );
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
    this.endPointerGesture();
  };

  private clampTarget(target: THREE.Vector3): void {
    target.x = THREE.MathUtils.clamp(target.x, -31, 31);
    target.z = THREE.MathUtils.clamp(target.z, -31, 31);
  }

  private endPointerGesture(): void {
    if (this.activePointerId !== null && this.inputElement.hasPointerCapture(this.activePointerId)) {
      this.inputElement.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.activePointerMode = null;
    this.lastPointerPosition = null;
  }

  private isCameraKey(code: string): boolean {
    return ["KeyQ", "KeyE"].includes(code) ||
      (this.controlScheme === "ascent" && ["KeyW", "KeyA", "KeyS", "KeyD"].includes(code));
  }

  private pointerModeForButton(button: number): "orbit" | "pan" | "zoom" | null {
    if (this.controlScheme === "prototype") {
      return button === 0 ? "orbit" : button === 1 ? "zoom" : button === 2 ? "pan" : null;
    }
    return button === 2 ? "orbit" : button === 1 ? "pan" : null;
  }

  private updateAriaLabel(): void {
    this.inputElement.setAttribute("aria-label", this.getInputDescription());
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }
}
