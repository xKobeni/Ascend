export class ControlsHint {
  private readonly element: HTMLElement;

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
  }

  dispose(): void {
    this.element.remove();
  }
}
