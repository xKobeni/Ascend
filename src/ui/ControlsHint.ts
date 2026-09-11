import type { CameraControlScheme } from "../rendering/CameraController";

export class ControlsHint {
  private readonly element: HTMLElement;
  private scheme: CameraControlScheme;
  private timeoutId: number | null = null;

  constructor(container: HTMLElement, scheme: CameraControlScheme = "ascent") {
    this.scheme = scheme;
    this.element = document.createElement("aside");
    this.element.className = "controls-hint";
    this.render(scheme);
    container.appendChild(this.element);
    window.addEventListener("keydown", this.handleInput);
    container.addEventListener("pointerdown", this.handleInput);
    container.addEventListener("wheel", this.handleInput);
    this.showTemporarily();
  }

  setScheme(scheme: CameraControlScheme): void {
    this.scheme = scheme;
    this.render(scheme);
    this.showTemporarily();
  }

  dispose(): void {
    if (this.timeoutId !== null) window.clearTimeout(this.timeoutId);
    window.removeEventListener("keydown", this.handleInput);
    this.element.parentElement?.removeEventListener("pointerdown", this.handleInput);
    this.element.parentElement?.removeEventListener("wheel", this.handleInput);
    this.element.remove();
  }

  private readonly handleInput = (event: Event): void => {
    if (event instanceof KeyboardEvent) {
      const cameraKeys = this.scheme === "prototype"
        ? ["KeyQ", "KeyE"]
        : ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"];
      if (!cameraKeys.includes(event.code)) return;
    }
    this.dismiss();
  };

  private dismiss(): void {
    this.element.dataset.dismissed = "true";
  }

  private render(scheme: CameraControlScheme): void {
    this.element.innerHTML = scheme === "prototype"
      ? `
        <span><kbd>Left-drag</kbd> Orbit</span>
        <span><kbd>Right-drag</kbd> Pan</span>
        <span><kbd>Middle-drag</kbd> Zoom</span>
        <span><kbd>Wheel</kbd> Zoom</span>
        <span><kbd>Click</kbd> Inspect</span>
      `
      : `
        <span><kbd>WASD</kbd> Pan</span>
        <span><kbd>Right-drag</kbd> Orbit</span>
        <span><kbd>Middle-drag</kbd> Pan</span>
        <span><kbd>Q</kbd><kbd>E</kbd> Rotate</span>
        <span><kbd>Wheel</kbd> Zoom</span>
        <span><kbd>Click</kbd> Inspect</span>
      `;
  }

  private showTemporarily(): void {
    delete this.element.dataset.dismissed;
    if (this.timeoutId !== null) window.clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => this.dismiss(), 8_000);
  }
}
