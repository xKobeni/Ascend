import type { CameraControlScheme } from "../rendering/CameraController";

const STORAGE_KEY = "ascent.camera-control-scheme";

export function loadCameraControlScheme(): CameraControlScheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "prototype" ? "prototype" : "ascent";
  } catch {
    return "ascent";
  }
}

export function saveCameraControlScheme(scheme: CameraControlScheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // The setting still applies for this session when storage is unavailable.
  }
}

export class CameraSettingsOverlay {
  private readonly element: HTMLElement;
  private scheme: CameraControlScheme;

  constructor(
    container: HTMLElement,
    initialScheme: CameraControlScheme,
    private readonly actions: {
      close(): void;
      select(scheme: CameraControlScheme): void;
    },
  ) {
    this.scheme = initialScheme;
    this.element = document.createElement("section");
    this.element.className = "camera-settings";
    this.element.hidden = true;
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-labelledby", "camera-settings-title");
    this.element.innerHTML = `
      <div class="camera-settings__panel">
        <header>
          <div><span>CONTROLS</span><strong id="camera-settings-title">Camera Settings</strong></div>
          <button type="button" data-camera-action="close" aria-label="Close camera settings">×</button>
        </header>
        <p>Choose how mouse input moves through the Refuge.</p>
        <div class="camera-settings__choices" role="radiogroup" aria-label="Camera control preset">
          <button type="button" role="radio" data-camera-scheme="ascent">
            <span>DEFAULT</span><strong>ASCENT Controls</strong>
            <small>Right-drag orbit · Middle-drag pan · WASD pan · Wheel zoom</small>
          </button>
          <button type="button" role="radio" data-camera-scheme="prototype">
            <span>ALTERNATIVE</span><strong>Prototype Controls</strong>
            <small>Left-drag orbit · Right-drag pan · Middle-drag or wheel zoom · WASD off</small>
          </button>
        </div>
        <small class="camera-settings__note">A short click still selects or places. Only a drag moves the camera. Your choice is saved on this device.</small>
      </div>
    `;
    this.element.addEventListener("click", this.handleClick);
    this.element.addEventListener("keydown", this.handleKeyDown);
    container.appendChild(this.element);
    this.update(initialScheme);
  }

  isOpen(): boolean {
    return !this.element.hidden;
  }

  open(): void {
    this.element.hidden = false;
    this.focusSelected();
  }

  close(): void {
    this.element.hidden = true;
  }

  update(scheme: CameraControlScheme): void {
    this.scheme = scheme;
    this.element.querySelectorAll<HTMLButtonElement>("[data-camera-scheme]").forEach((button) => {
      button.setAttribute("aria-checked", String(button.dataset.cameraScheme === scheme));
    });
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.removeEventListener("keydown", this.handleKeyDown);
    this.element.remove();
  }

  private focusSelected(): void {
    this.element.querySelector<HTMLButtonElement>(`[data-camera-scheme="${this.scheme}"]`)?.focus();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (button?.dataset.cameraAction === "close") {
      this.actions.close();
      return;
    }
    const scheme = button?.dataset.cameraScheme;
    if (scheme !== "ascent" && scheme !== "prototype") return;
    this.update(scheme);
    this.actions.select(scheme);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen() || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) return;
    event.preventDefault();
    const scheme = this.scheme === "ascent" ? "prototype" : "ascent";
    this.update(scheme);
    this.actions.select(scheme);
    this.focusSelected();
  };
}
