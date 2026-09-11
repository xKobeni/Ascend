import * as THREE from "three";

export interface RefugeGroundPoint {
  x: number;
  z: number;
}

export class RefugeBuildInput {
  private enabled = false;
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.36);
  private leftDragReserved = false;
  private pendingClick: { pointerId: number; x: number; y: number } | null = null;
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly worldPoint = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly onHover: (point: RefugeGroundPoint) => void,
    private readonly onActivate: (point: RefugeGroundPoint) => void,
  ) {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.pendingClick = null;
  }

  setLeftDragReserved(reserved: boolean): void {
    this.leftDragReserved = reserved;
    this.pendingClick = null;
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
  }

  private groundPoint(event: PointerEvent): RefugeGroundPoint | null {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.worldPoint);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0) {
      return;
    }
    if (this.leftDragReserved) {
      this.pendingClick = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    const point = this.groundPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    this.onHover(point);
    this.onActivate(point);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || (event.buttons & 6) !== 0) {
      return;
    }
    if (this.leftDragReserved && (event.buttons & 1) !== 0) {
      if (this.pendingClick?.pointerId === event.pointerId && Math.hypot(
        event.clientX - this.pendingClick.x,
        event.clientY - this.pendingClick.y,
      ) > 6) {
        this.pendingClick = null;
      }
      return;
    }
    const point = this.groundPoint(event);
    if (!point) {
      return;
    }
    this.onHover(point);
    if ((event.buttons & 1) !== 0) {
      this.onActivate(point);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.enabled || !this.leftDragReserved || event.button !== 0 ||
      this.pendingClick?.pointerId !== event.pointerId) {
      return;
    }
    const pending = this.pendingClick;
    this.pendingClick = null;
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 6) return;
    const point = this.groundPoint(event);
    if (!point) return;
    this.onHover(point);
    this.onActivate(point);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.pendingClick?.pointerId === event.pointerId) this.pendingClick = null;
  };
}
