import type { SimulationSnapshot } from "../simulation/Simulation";
import type { CameraDiagnostics } from "../rendering/CameraController";

interface DebugActions {
  canStartArena(): boolean;
  onVisibilityChange(open: boolean): void;
  startArena(): boolean;
}

export class DebugOverlay {
  private readonly arenaButton: HTMLButtonElement;
  private readonly cameraValue: HTMLElement;
  private readonly element: HTMLElement;
  private frameCount = 0;
  private framesPerSecond = 0;
  private readonly fpsValue: HTMLElement;
  private readonly heroValue: HTMLElement;
  private readonly rendererValue: HTMLElement;
  private readonly routineValue: HTMLElement;
  private sampleStartedMs = performance.now();
  private readonly tickValue: HTMLElement;
  private readonly timeValue: HTMLElement;

  constructor(container: HTMLElement, private readonly actions: DebugActions) {
    this.element = document.createElement("aside");
    this.element.className = "debug-overlay";
    this.element.hidden = true;
    this.element.dataset.renderStatus = "ready";
    this.element.setAttribute("aria-label", "Developer diagnostics");
    this.element.innerHTML = `
      <header><div><span>DEVELOPER</span><strong>Phase 16 diagnostics</strong></div><button type="button" data-debug-action="close" aria-label="Close diagnostics">×</button></header>
      <div class="debug-overlay__grid">
        <div><span>FPS</span><b data-debug="fps">0</b></div>
        <div><span>SIM TICK</span><b data-debug="tick">0</b></div>
        <div><span>WORLD TIME</span><b data-debug="time">DAY 1 · 07:00</b></div>
        <div><span>ROUTINE</span><b data-debug="routine">MORNING</b></div>
        <div><span>HEROES</span><b data-debug="heroes">0</b></div>
        <div><span>CAMERA</span><b data-debug="camera">0, 0</b></div>
        <div><span>RENDERER</span><b data-debug="renderer">READY</b></div>
      </div>
      <div class="debug-overlay__arena"><span>Combat validation</span><button type="button" data-debug-action="arena">Launch Arena</button></div>
      <small>Press F3 to toggle this drawer.</small>
    `;
    this.fpsValue = this.requireValue("fps");
    this.tickValue = this.requireValue("tick");
    this.timeValue = this.requireValue("time");
    this.heroValue = this.requireValue("heroes");
    this.cameraValue = this.requireValue("camera");
    this.rendererValue = this.requireValue("renderer");
    this.routineValue = this.requireValue("routine");
    const arenaButton = this.element.querySelector<HTMLButtonElement>("[data-debug-action='arena']");
    if (!arenaButton) {
      throw new Error("Debug overlay arena action is missing.");
    }
    this.arenaButton = arenaButton;
    this.element.addEventListener("click", this.handleClick);
    window.addEventListener("keydown", this.handleKeyDown);
    container.appendChild(this.element);
  }

  update(
    timestampMs: number,
    snapshot: Readonly<SimulationSnapshot>,
    camera: Readonly<CameraDiagnostics>,
  ): void {
    this.frameCount += 1;
    const sampleDurationMs = timestampMs - this.sampleStartedMs;
    if (sampleDurationMs >= 500) {
      this.framesPerSecond = Math.round((this.frameCount * 1_000) / sampleDurationMs);
      this.frameCount = 0;
      this.sampleStartedMs = timestampMs;
    }
    this.fpsValue.textContent = String(this.framesPerSecond);
    this.tickValue.textContent = String(snapshot.tick);
    this.timeValue.textContent = this.formatTime(snapshot.day, snapshot.minuteOfDay);
    this.routineValue.textContent = snapshot.period.toUpperCase();
    this.heroValue.textContent = String(snapshot.heroCount);
    this.cameraValue.textContent = `${camera.targetX.toFixed(1)}, ${camera.targetZ.toFixed(1)} · ${Math.round(camera.yawDegrees)}° · ${camera.distance.toFixed(0)}m`;
    this.arenaButton.disabled = !this.actions.canStartArena();
  }

  setRendererStatus(status: "ready" | "lost"): void {
    this.element.dataset.renderStatus = status;
    this.rendererValue.textContent = status.toUpperCase();
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.element.remove();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (button?.dataset.debugAction === "close") {
      this.element.hidden = true;
      this.actions.onVisibilityChange(false);
    } else if (button?.dataset.debugAction === "arena" && this.actions.startArena()) {
      this.element.hidden = true;
      this.actions.onVisibilityChange(false);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "F3") {
      return;
    }
    event.preventDefault();
    this.element.hidden = !this.element.hidden;
    this.actions.onVisibilityChange(!this.element.hidden);
  };

  private formatTime(day: number, minuteOfDay: number): string {
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = Math.floor(minuteOfDay % 60);
    return `DAY ${day} · ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  private requireValue(name: string): HTMLElement {
    const value = this.element.querySelector<HTMLElement>(`[data-debug="${name}"]`);
    if (!value) {
      throw new Error(`Debug overlay is missing the ${name} value.`);
    }
    return value;
  }
}
