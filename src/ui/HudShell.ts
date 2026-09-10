import type { ExpeditionResources } from "../expeditions/Expedition";
import type { SimulationSnapshot } from "../simulation/Simulation";

export type HudSection = "Heroes" | "Party" | "Refuge" | "Rift";

export class HudShell {
  private activeSection: HudSection = "Refuge";
  private readonly element: HTMLElement;
  private readonly heroCount: HTMLElement;
  private readonly resourceValues: Record<keyof ExpeditionResources, HTMLElement>;
  private readonly time: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly onSectionChange: (section: HudSection) => void,
  ) {
    this.element = document.createElement("div");
    this.element.className = "hud-shell";
    this.element.innerHTML = `
      <header class="hud-topbar">
        <div class="hud-brand"><strong>ASCENT</strong><span>Refuge command</span></div>
        <div class="hud-time" data-hud="time">DAY 1 · 07:00</div>
        <div class="hud-resources" aria-label="Refuge resources">
          <span><i>SCRAP</i><b data-resource="scrap">0</b></span>
          <span><i>FOOD</i><b data-resource="food">0</b></span>
          <span><i>SHARDS</i><b data-resource="riftShards">0</b></span>
          <span><i>HEROES</i><b data-hud="heroes">0</b></span>
        </div>
      </header>
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
    const riftShards = this.element.querySelector<HTMLElement>("[data-resource='riftShards']");
    if (!time || !heroCount || !scrap || !food || !riftShards) {
      throw new Error("HUD shell structure is incomplete.");
    }
    this.time = time;
    this.heroCount = heroCount;
    this.resourceValues = { food, riftShards, scrap };
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  update(
    snapshot: Readonly<SimulationSnapshot>,
    resources: Readonly<ExpeditionResources>,
  ): void {
    const hours = Math.floor(snapshot.minuteOfDay / 60);
    const minutes = Math.floor(snapshot.minuteOfDay % 60);
    this.time.textContent = `DAY ${snapshot.day} · ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    this.heroCount.textContent = String(snapshot.heroCount);
    this.resourceValues.scrap.textContent = String(resources.scrap);
    this.resourceValues.food.textContent = String(resources.food);
    this.resourceValues.riftShards.textContent = String(resources.riftShards);
  }

  setActive(section: HudSection): void {
    this.activeSection = section;
    this.element.querySelectorAll<HTMLButtonElement>("[data-hud-section]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.hudSection === section));
    });
  }

  focus(section: HudSection): void {
    this.element.querySelector<HTMLButtonElement>(`[data-hud-section="${section}"]`)?.focus();
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-hud-section]");
    const section = button?.dataset.hudSection;
    if (!this.isSection(section) || section === this.activeSection) {
      return;
    }
    this.onSectionChange(section);
  };

  private getSymbol(section: HudSection): string {
    return section === "Heroes" ? "◇" : section === "Party" ? "Ⅲ" : section === "Refuge" ? "⌂" : "△";
  }

  private isSection(value: string | undefined): value is HudSection {
    return value !== undefined && ["Heroes", "Party", "Refuge", "Rift"].includes(value);
  }
}
