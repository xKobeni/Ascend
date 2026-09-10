import type { Hero } from "../heroes/Hero";
import type { Squad } from "../squads/Squad";
import type { HeroPortraitCache } from "../rendering/heroes/HeroPortraitCache";

type RosterFilter = "All" | "Ready" | "Recovering" | "Training";

const FILTERS: readonly RosterFilter[] = ["All", "Ready", "Training", "Recovering"];

export class HeroRosterOverlay {
  private expanded = false;
  private filter: RosterFilter = "All";
  private readonly grid: HTMLElement;
  private readonly element: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly heroes: readonly Readonly<Hero>[],
    private readonly getSquad: () => Readonly<Squad>,
    private readonly portraits: HeroPortraitCache,
    private readonly onInspect: (heroId: string) => void,
    private readonly onClose: () => void,
  ) {
    this.element = document.createElement("section");
    this.element.className = "system-panel roster-panel";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Hero roster");
    this.element.innerHTML = `
      <header class="system-panel__header">
        <div><span>REFUGE PERSONNEL</span><h1>Heroes</h1></div>
        <strong>${heroes.length}</strong>
        <button type="button" data-roster-action="close" aria-label="Close hero roster">×</button>
      </header>
      <div class="roster-filters" role="toolbar" aria-label="Filter heroes">
        ${FILTERS.map((filter) => `<button type="button" data-roster-filter="${filter}" aria-pressed="${filter === "All"}">${filter}</button>`).join("")}
      </div>
      <div class="roster-grid"></div>
    `;
    const grid = this.element.querySelector<HTMLElement>(".roster-grid");
    if (!grid) {
      throw new Error("Hero roster grid is missing.");
    }
    this.grid = grid;
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  open(): void {
    this.expanded = true;
    this.element.hidden = false;
    this.render();
    this.element.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }

  close(): void {
    this.expanded = false;
    this.element.hidden = true;
  }

  refresh(): void {
    if (this.expanded) {
      this.render();
    }
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private render(): void {
    const squad = this.getSquad();
    const visibleHeroes = this.heroes.filter((hero) => this.matchesFilter(hero));
    this.grid.replaceChildren(...visibleHeroes.map((hero) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "hero-roster-card";
      card.dataset.heroId = hero.id;
      card.dataset.status = this.getStatus(hero).toLowerCase();
      card.setAttribute("aria-label", `Inspect ${hero.name}, level ${hero.level}, ${this.getStatus(hero)}`);

      const portrait = document.createElement("span");
      portrait.className = "hero-roster-card__portrait";
      const portraitUrl = this.portraits.get(hero.id);
      if (portraitUrl) {
        const image = document.createElement("img");
        image.src = portraitUrl;
        image.alt = "";
        portrait.appendChild(image);
      } else {
        const mark = document.createElement("span");
        mark.className = "hero-roster-card__mark";
        mark.textContent = this.getInitials(hero.name);
        portrait.appendChild(mark);
      }

      const rank = document.createElement("span");
      rank.className = "hero-roster-card__rank";
      rank.textContent = "★".repeat(hero.rank);
      const identity = document.createElement("span");
      identity.className = "hero-roster-card__identity";
      const name = document.createElement("strong");
      name.textContent = hero.name;
      const member = squad.members.find((candidate) => candidate.heroId === hero.id);
      const path = document.createElement("span");
      path.textContent = member ? `${member.role} · ${member.formation}` : hero.origin.occupation;
      identity.append(name, path);
      const footer = document.createElement("span");
      footer.className = "hero-roster-card__footer";
      const level = document.createElement("span");
      level.textContent = `LEVEL ${hero.level}`;
      const status = document.createElement("span");
      status.textContent = this.getStatus(hero);
      footer.append(level, status);
      card.append(portrait, rank, identity, footer);
      return card;
    }));
    if (visibleHeroes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "system-panel__empty";
      empty.textContent = `No heroes are currently ${this.filter.toLowerCase()}.`;
      this.grid.appendChild(empty);
    }
    this.element.querySelectorAll<HTMLButtonElement>("[data-roster-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.rosterFilter === this.filter));
    });
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button) {
      return;
    }
    if (button.dataset.rosterAction === "close") {
      this.onClose();
      return;
    }
    if (this.isFilter(button.dataset.rosterFilter)) {
      this.filter = button.dataset.rosterFilter;
      this.render();
      return;
    }
    if (button.dataset.heroId) {
      this.onInspect(button.dataset.heroId);
    }
  };

  private matchesFilter(hero: Readonly<Hero>): boolean {
    const status = this.getStatus(hero);
    return this.filter === "All" || status === this.filter;
  }

  private getStatus(hero: Readonly<Hero>): Exclude<RosterFilter, "All"> {
    if (hero.needs.health < 70 || hero.needs.fatigue > 75) {
      return "Recovering";
    }
    if (hero.training.active || hero.training.queue.length > 0) {
      return "Training";
    }
    return "Ready";
  }

  private getInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  private isFilter(value: string | undefined): value is RosterFilter {
    return value !== undefined && FILTERS.includes(value as RosterFilter);
  }
}
