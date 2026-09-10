export class ControlsHint {
  private readonly element: HTMLElement;
  private readonly timeoutId: number;

  constructor(container: HTMLElement) {
    this.element = document.createElement("aside");
    this.element.className = "controls-hint";
    this.element.innerHTML = `
      <span><kbd>WASD</kbd> Pan</span>
      <span><kbd>Q</kbd><kbd>E</kbd> Rotate</span>
      <span><kbd>Wheel</kbd> Zoom</span>
      <span><kbd>Click</kbd> Inspect</span>
    `;
    container.appendChild(this.element);
    window.addEventListener("keydown", this.handleInput);
    container.addEventListener("pointerdown", this.handleInput);
    container.addEventListener("wheel", this.handleInput);
    this.timeoutId = window.setTimeout(() => this.dismiss(), 8_000);
  }

  dispose(): void {
    window.clearTimeout(this.timeoutId);
    window.removeEventListener("keydown", this.handleInput);
    this.element.parentElement?.removeEventListener("pointerdown", this.handleInput);
    this.element.parentElement?.removeEventListener("wheel", this.handleInput);
    this.element.remove();
  }

  private readonly handleInput = (event: Event): void => {
    if (event instanceof KeyboardEvent && !["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(event.code)) {
      return;
    }
    this.dismiss();
  };

  private dismiss(): void {
    this.element.dataset.dismissed = "true";
  }
}
