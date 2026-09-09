import type { SimulationSnapshot } from "../simulation/Simulation";
import type { CameraDiagnostics } from "../rendering/CameraController";

export class DebugOverlay {
  private frameCount = 0;
  private framesPerSecond = 0;
  private sampleStartedMs = performance.now();
  private readonly element: HTMLElement;
  private readonly fpsValue: HTMLElement;
  private readonly tickValue: HTMLElement;
  private readonly timeValue: HTMLElement;
  private readonly heroValue: HTMLElement;
  private readonly rendererValue: HTMLElement;
  private readonly cameraValue: HTMLElement;
  private readonly routineValue: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement("aside");
    this.element.className = "debug-overlay";
    this.element.dataset.renderStatus = "ready";
    this.element.setAttribute("aria-label", "Development diagnostics");
    this.element.innerHTML = `
      <div class="debug-overlay__title">ASCENT // PHASE 4</div>
      <div class="debug-overlay__row"><span>FPS</span><span class="debug-overlay__value" data-debug="fps">0</span></div>
      <div class="debug-overlay__row"><span>SIM TICK</span><span class="debug-overlay__value" data-debug="tick">0</span></div>
      <div class="debug-overlay__row"><span>WORLD TIME</span><span class="debug-overlay__value" data-debug="time">DAY 1 · 07:00</span></div>
      <div class="debug-overlay__row"><span>ROUTINE</span><span class="debug-overlay__value" data-debug="routine">MORNING</span></div>
      <div class="debug-overlay__row"><span>HEROES</span><span class="debug-overlay__value" data-debug="heroes">0</span></div>
      <div class="debug-overlay__row"><span>CAMERA</span><span class="debug-overlay__value" data-debug="camera">0, 0</span></div>
      <div class="debug-overlay__row"><span>RENDERER</span><span class="debug-overlay__value" data-debug="renderer">READY</span></div>
    `;

    this.fpsValue = this.requireValue("fps");
    this.tickValue = this.requireValue("tick");
    this.timeValue = this.requireValue("time");
    this.heroValue = this.requireValue("heroes");
    this.cameraValue = this.requireValue("camera");
    this.rendererValue = this.requireValue("renderer");
    this.routineValue = this.requireValue("routine");
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
  }

  setRendererStatus(status: "ready" | "lost"): void {
    this.element.dataset.renderStatus = status;
    this.rendererValue.textContent = status.toUpperCase();
  }

  dispose(): void {
    this.element.remove();
  }

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
