import type {
  PlacementValidation,
  RefugeLayoutSnapshot,
  RefugeLayoutTool,
  RefugeStructureId,
} from "../refuge/RefugeLayoutSystem";

export interface RefugeBuildViewState {
  active: boolean;
  canUndo: boolean;
  draft: PlacementValidation | null;
  environmentId: string | null;
  layout: Readonly<RefugeLayoutSnapshot>;
  rotation: number;
  tool: RefugeLayoutTool | null;
}

interface RefugeBuildActions {
  cancel(): void;
  confirm(): void;
  enter(): void;
  exit(): void;
  nudge(dx: number, dz: number): void;
  pan(dx: number, dz: number): void;
  removeEnvironment(): void;
  rotate(): void;
  selectTool(tool: RefugeLayoutTool): void;
  store(): void;
  undo(): void;
}

const STRUCTURES: readonly RefugeStructureId[] = [
  "command-hall", "campfire", "dormitory", "training", "infirmary", "storage", "dimensional-gate", "memorial-grounds",
];

export class RefugeBuildOverlay {
  private available = true;
  private readonly element: HTMLElement;

  constructor(container: HTMLElement, private readonly actions: RefugeBuildActions) {
    this.element = document.createElement("section");
    this.element.className = "refuge-build";
    this.element.setAttribute("aria-label", "Refuge Build Mode");
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  setAvailable(available: boolean): void {
    this.available = available;
    this.element.hidden = !available;
  }

  update(state: Readonly<RefugeBuildViewState>): void {
    if (!this.available) return;
    if (!state.active) {
      this.element.dataset.active = "false";
      this.element.innerHTML = `<button type="button" class="refuge-build__entry" data-build-action="enter"><span>LAYOUT</span>Build Refuge</button>`;
      return;
    }
    const selectedFacility = state.tool && STRUCTURES.includes(state.tool as RefugeStructureId)
      ? state.tool as RefugeStructureId
      : null;
    const facility = selectedFacility
      ? state.layout.facilities.find((candidate) => candidate.id === selectedFacility)
      : null;
    const environment = state.environmentId
      ? [...state.layout.trees, ...state.layout.rocks].find((candidate) => candidate.id === state.environmentId)
      : null;
    const subjectLabel = facility?.label ?? (environment ? `${environment.kind === "tree" ? "Tree" : "Rock"} ${environment.id.split("-").at(-1) ?? ""}` : null);
    const status = state.draft?.message ?? (state.tool === "trail"
      ? "Paint trail tiles on open ground."
      : state.tool === "erase-trail"
        ? "Erase existing trail tiles."
        : "Choose a facility or trail tool.");
    this.element.dataset.active = "true";
    this.element.innerHTML = `
      <div class="refuge-build__toolbar" aria-label="Layout tools">
        <div class="refuge-build__tools">
          ${STRUCTURES.map((id) => {
            const entry = state.layout.facilities.find((candidate) => candidate.id === id);
            return `<button type="button" data-build-tool="${id}" aria-pressed="${state.tool === id}"><b>${this.label(id)}</b><span>${entry?.placed ? entry.kind : "Stored"}</span></button>`;
          }).join("")}
          <button type="button" data-build-tool="trail" aria-pressed="${state.tool === "trail"}"><b>Trail</b><span>Paint</span></button>
          <button type="button" data-build-tool="erase-trail" aria-pressed="${state.tool === "erase-trail"}"><b>Trail</b><span>Erase</span></button>
        </div>
      </div>
      <aside class="refuge-build__inspector">
        <header><div><span>REFUGE LAYOUT</span><strong>${subjectLabel ?? "Build Mode"}</strong></div><button type="button" data-build-action="exit" aria-label="Exit Build Mode">×</button></header>
        <p data-valid="${state.draft?.valid ?? true}">${status}</p>
        <div class="refuge-build__actions">
          <button type="button" data-build-action="rotate" ${facility ? "" : "disabled"}>Rotate · R</button>
          <button type="button" data-build-action="confirm" ${state.draft?.valid && (facility || environment) ? "" : "disabled"}>Confirm</button>
          <button type="button" data-build-action="cancel" ${state.draft ? "" : "disabled"}>Cancel</button>
          <button type="button" data-build-action="undo" ${state.canUndo ? "" : "disabled"}>Undo</button>
        </div>
        <div class="refuge-build__nudge" aria-label="Selected facility movement">
          <span>MOVE</span><button type="button" data-build-nudge="0,-1" ${facility || environment ? "" : "disabled"}>↑</button>
          <button type="button" data-build-nudge="-1,0" ${facility || environment ? "" : "disabled"}>←</button>
          <button type="button" data-build-nudge="0,1" ${facility || environment ? "" : "disabled"}>↓</button>
          <button type="button" data-build-nudge="1,0" ${facility || environment ? "" : "disabled"}>→</button>
        </div>
        <div class="refuge-build__camera" aria-label="Camera movement">
          <span>CAMERA</span><button type="button" data-build-pan="0,-1">↑</button>
          <button type="button" data-build-pan="-1,0">←</button>
          <button type="button" data-build-pan="0,1">↓</button>
          <button type="button" data-build-pan="1,0">→</button>
        </div>
        ${facility?.removable && facility.placed ? `<button type="button" class="refuge-build__store" data-build-action="store">Store facility</button>` : ""}
        ${environment ? `<button type="button" class="refuge-build__store" data-build-action="remove-environment">Remove ${environment.kind}</button>` : ""}
        <small>${facility ? `${facility.kind} · ${facility.placed ? "Placed" : "Stored"} · ${Math.round(state.rotation * 180 / Math.PI)}°` : `${state.layout.planeSize}×${state.layout.planeSize} field · ${state.layout.trails.length} trail segments · expansion prepared, locked`}</small>
      </aside>
    `;
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    const tool = button.dataset.buildTool;
    if (this.isTool(tool)) {
      this.actions.selectTool(tool);
      return;
    }
    const nudge = this.parseVector(button.dataset.buildNudge);
    if (nudge) {
      this.actions.nudge(nudge.x, nudge.z);
      return;
    }
    const pan = this.parseVector(button.dataset.buildPan);
    if (pan) {
      this.actions.pan(pan.x, pan.z);
      return;
    }
    const action = button.dataset.buildAction;
    if (action === "enter") this.actions.enter();
    if (action === "exit") this.actions.exit();
    if (action === "rotate") this.actions.rotate();
    if (action === "confirm") this.actions.confirm();
    if (action === "cancel") this.actions.cancel();
    if (action === "store") this.actions.store();
    if (action === "remove-environment") this.actions.removeEnvironment();
    if (action === "undo") this.actions.undo();
  };

  private isTool(value: string | undefined): value is RefugeLayoutTool {
    return value !== undefined && [...STRUCTURES, "trail", "erase-trail"].includes(value as RefugeLayoutTool);
  }

  private parseVector(value: string | undefined): { x: number; z: number } | null {
    if (!value) return null;
    const [x, z] = value.split(",").map(Number);
    return Number.isFinite(x) && Number.isFinite(z) ? { x: x ?? 0, z: z ?? 0 } : null;
  }

  private label(id: RefugeStructureId): string {
    const labels: Record<RefugeStructureId, string> = {
      campfire: "Campfire", "command-hall": "Command Hall", "dimensional-gate": "Rift Gate",
      dormitory: "Dormitory", infirmary: "Infirmary", "memorial-grounds": "Memorials", storage: "Storage", training: "Training",
    };
    return labels[id];
  }
}
