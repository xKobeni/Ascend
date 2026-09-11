import type { ExpeditionResources } from "../expeditions/Expedition";
import type { SimulationSnapshot } from "../simulation/Simulation";
import type { DormitorySnapshot } from "../refuge/DormitorySystem";
import type { ResourceEconomySnapshot } from "../economy/ResourceEconomySystem";

export type HudSection = "Heroes" | "Party" | "Refuge" | "Rift";

export class HudShell {
  private activeSection: HudSection = "Refuge";
  private readonly element: HTMLElement;
  private readonly economyStatus: HTMLElement;
  private readonly heroCount: HTMLElement;
  private readonly resourceValues: Record<keyof ExpeditionResources, HTMLElement>;
  private readonly time: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly onSectionChange: (section: HudSection) => void,
    private readonly onCameraSettings: () => void,
  ) {
    this.element = document.createElement("div");
    this.element.className = "hud-shell";
    this.element.innerHTML = `
      <header class="hud-topbar">
        <div class="hud-brand">
          <div><strong>ASCENT</strong><span>Refuge command</span></div>
          <button type="button" class="hud-camera-settings" data-hud-action="camera-settings" aria-label="Open camera settings">CAMERA</button>
        </div>
        <div class="hud-time" data-hud="time">DAY 1 · 07:00</div>
        <div class="hud-resources" aria-label="Refuge resources">
          <span><i>SCRAP</i><b data-resource="scrap">0</b></span>
          <span data-resource-item="food"><i>FOOD</i><b data-resource="food">0</b></span>
          <span><i>MEDICINE</i><b data-resource="medicine">0</b></span>
          <span><i>SHARDS</i><b data-resource="riftShards">0</b></span>
          <span><i>HEROES</i><b data-hud="heroes">0</b></span>
        </div>
      </header>
      <aside class="economy-status" data-economy-status="Stocked" aria-label="Refuge provisions">
        <span>PROVISIONS</span><strong data-economy="status">STOCKED</strong>
        <small><b data-economy="days">0.0</b> days · <b data-economy="demand">0</b> Food/day</small>
      </aside>
      <nav class="hud-navigation" aria-label="Primary command navigation">
        ${(["Heroes", "Party", "Refuge", "Rift"] as const).map((section) => `
          <button type="button" data-hud-section="${section}" aria-pressed="${section === "Refuge"}">
            <span>${this.getSymbol(section)}</span>${section}
          </button>
        `).join("")}
      </nav>
    `;
    const time = this.element.querySelector<HTMLElement>("[data-hud='time']");
    const heroCount = this.element.querySelector<HTMLElement>("[data-hud='heroes']");
    const scrap = this.element.querySelector<HTMLElement>("[data-resource='scrap']");
    const food = this.element.querySelector<HTMLElement>("[data-resource='food']");
    const medicine = this.element.querySelector<HTMLElement>("[data-resource='medicine']");
    const riftShards = this.element.querySelector<HTMLElement>("[data-resource='riftShards']");
    const economyStatus = this.element.querySelector<HTMLElement>(".economy-status");
    if (!time || !heroCount || !scrap || !food || !medicine || !riftShards || !economyStatus) {
      throw new Error("HUD shell structure is incomplete.");
    }
    this.time = time;
    this.economyStatus = economyStatus;
    this.heroCount = heroCount;
    this.resourceValues = { food, medicine, riftShards, scrap };
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  update(
    snapshot: Readonly<SimulationSnapshot>,
    resources: Readonly<ExpeditionResources>,
    dormitory: Readonly<DormitorySnapshot>,
    economy: Readonly<ResourceEconomySnapshot>,
  ): void {
    const hours = Math.floor(snapshot.minuteOfDay / 60);
    const minutes = Math.floor(snapshot.minuteOfDay % 60);
    this.time.textContent = `DAY ${snapshot.day} · ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    this.heroCount.textContent = `${snapshot.heroCount}/${dormitory.capacity}`;
    this.resourceValues.scrap.textContent = String(resources.scrap);
    this.resourceValues.food.textContent = String(resources.food);
    this.resourceValues.medicine.textContent = String(resources.medicine);
    this.resourceValues.riftShards.textContent = String(resources.riftShards);
    const foodResource = this.resourceValues.food.closest<HTMLElement>("[data-resource-item='food']");
    if (foodResource) {
      foodResource.dataset.state = economy.provisionStatus;
    }
    this.updateEconomyStatus(economy);
  }

  setActive(section: HudSection): void {
    this.activeSection = section;
    this.element.querySelectorAll<HTMLButtonElement>("[data-hud-section]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.hudSection === section));
    });
    this.economyStatus.hidden = section !== "Refuge";
  }

  focus(section: HudSection): void {
    this.element.querySelector<HTMLButtonElement>(`[data-hud-section="${section}"]`)?.focus();
  }

  focusCameraSettings(): void {
    this.element.querySelector<HTMLButtonElement>("[data-hud-action='camera-settings']")?.focus();
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const action = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-hud-action]")?.dataset.hudAction;
    if (action === "camera-settings") {
      this.onCameraSettings();
      return;
    }
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-hud-section]");
    const section = button?.dataset.hudSection;
    if (!this.isSection(section) || section === this.activeSection) {
      return;
    }
    this.onSectionChange(section);
  };

  private updateEconomyStatus(economy: Readonly<ResourceEconomySnapshot>): void {
    const status = this.economyStatus.querySelector<HTMLElement>("[data-economy='status']");
    const days = this.economyStatus.querySelector<HTMLElement>("[data-economy='days']");
    const demand = this.economyStatus.querySelector<HTMLElement>("[data-economy='demand']");
    if (!status || !days || !demand) {
      throw new Error("Economy status structure is incomplete.");
    }
    this.economyStatus.dataset.economyStatus = economy.provisionStatus;
    status.textContent = economy.provisionStatus.toUpperCase();
    days.textContent = economy.provisionDays === null ? "—" : economy.provisionDays.toFixed(1);
    demand.textContent = String(economy.dailyFoodDemand);
    this.economyStatus.title = economy.provisionStatus === "Empty"
      ? "Meals provide no hunger recovery while Food is empty."
      : economy.provisionStatus === "Low"
        ? "The refuge has one day or less of Food remaining."
        : "The refuge has more than one day of Food remaining.";
  }

  private getSymbol(section: HudSection): string {
    return section === "Heroes" ? "◇" : section === "Party" ? "Ⅲ" : section === "Refuge" ? "⌂" : "△";
  }

  private isSection(value: string | undefined): value is HudSection {
    return value !== undefined && ["Heroes", "Party", "Refuge", "Rift"].includes(value);
  }
}
