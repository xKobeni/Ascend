import * as THREE from "three";

export interface SelectionDetails {
  category: "base" | "facility" | "hero" | "prop";
  detail?: string;
  id: string;
  label: string;
}

const SELECTION_DATA_KEY = "ascentSelection";

export function markSelectable(object: THREE.Object3D, details: SelectionDetails): void {
  object.userData[SELECTION_DATA_KEY] = details;
}

export class SelectionRaycaster {
  private readonly bounds = new THREE.Box3();
  private readonly highlight: THREE.Box3Helper;
  private readonly pointer = new THREE.Vector2();
  private pointerDownPosition: { x: number; y: number } | null = null;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    scene: THREE.Scene,
    private readonly selectableRoots: THREE.Object3D[],
    private readonly onSelection: (details: SelectionDetails | null) => void,
  ) {
    this.highlight = new THREE.Box3Helper(this.bounds, "#a9f1ff");
    this.highlight.visible = false;
    this.highlight.renderOrder = 10;
    scene.add(this.highlight);

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.highlight.removeFromParent();
    this.highlight.geometry.dispose();
    const highlightMaterials = Array.isArray(this.highlight.material)
      ? this.highlight.material
      : [this.highlight.material];
    highlightMaterials.forEach((material) => material.dispose());
  }

  private pick(clientX: number, clientY: number): THREE.Object3D | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.selectableRoots, true)[0]?.object ?? null;
  }

  private findSelectionRoot(object: THREE.Object3D | null): THREE.Object3D | null {
    let current = object;
    while (current) {
      if (current.userData[SELECTION_DATA_KEY]) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private select(clientX: number, clientY: number): void {
    const root = this.findSelectionRoot(this.pick(clientX, clientY));
    if (!root) {
      this.highlight.visible = false;
      this.onSelection(null);
      return;
    }

    this.bounds.setFromObject(root).expandByScalar(0.08);
    this.highlight.box = this.bounds;
    this.highlight.visible = true;
    this.onSelection(root.userData[SELECTION_DATA_KEY] as SelectionDetails);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDownPosition = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerDownPosition) {
      return;
    }
    const distance = Math.hypot(
      event.clientX - this.pointerDownPosition.x,
      event.clientY - this.pointerDownPosition.y,
    );
    this.pointerDownPosition = null;
    if (distance <= 6) {
      this.select(event.clientX, event.clientY);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.canvas.style.cursor = this.findSelectionRoot(this.pick(event.clientX, event.clientY))
      ? "pointer"
      : "default";
  };

  private readonly handlePointerLeave = (): void => {
    this.canvas.style.cursor = "default";
    this.pointerDownPosition = null;
  };
}
