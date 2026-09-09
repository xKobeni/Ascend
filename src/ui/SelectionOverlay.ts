import type { SelectionDetails } from "../rendering/SelectionRaycaster";

export class SelectionOverlay {
  private readonly element: HTMLElement;
  private readonly category: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly label: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement("aside");
    this.element.className = "selection-overlay";
    this.element.hidden = true;
    this.element.setAttribute("aria-live", "polite");
    this.element.innerHTML = `
      <span class="selection-overlay__eyebrow" data-selection="category"></span>
      <strong data-selection="label"></strong>
      <span class="selection-overlay__detail" data-selection="detail"></span>
    `;
    this.category = this.requireElement("category");
    this.detail = this.requireElement("detail");
    this.label = this.requireElement("label");
    container.appendChild(this.element);
  }

  setSelection(selection: SelectionDetails | null): void {
    this.element.hidden = selection === null;
    if (!selection) {
      return;
    }
    this.category.textContent = selection.category;
    this.label.textContent = selection.label;
    this.detail.textContent = selection.detail ?? "";
    this.detail.hidden = !selection.detail;
  }

  dispose(): void {
    this.element.remove();
  }

  private requireElement(name: string): HTMLElement {
    const element = this.element.querySelector<HTMLElement>(`[data-selection="${name}"]`);
    if (!element) {
      throw new Error(`Selection overlay is missing the ${name} element.`);
    }
    return element;
  }
}
