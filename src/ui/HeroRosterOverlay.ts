import type { FallenHeroRecord, Hero } from "../heroes/Hero";
import type { Squad } from "../squads/Squad";
import type { HeroPortraitCache } from "../rendering/heroes/HeroPortraitCache";
import type { DormitorySnapshot } from "../refuge/DormitorySystem";

type RosterFilter = "All" | "Ready" | "Recovering" | "Training";

const FILTERS: readonly RosterFilter[] = ["All", "Ready", "Training", "Recovering"];

export class HeroRosterOverlay {
  private expanded = false;
  private filter: RosterFilter = "All";
  private readonly grid: HTMLElement;
  private readonly element: HTMLElement;
  private lastSignature = "";

  constructor(
    container: HTMLElement,
    private readonly getHeroes: () => readonly Readonly<Hero>[],
    private readonly getFallenHeroes: () => readonly Readonly<FallenHeroRecord>[],
    private readonly getSquad: () => Readonly<Squad>,
    private readonly getRiftShards: () => number,
    private readonly getScrap: () => number,
    private readonly getRecruitmentCost: () => number,
    private readonly getDormitory: () => Readonly<DormitorySnapshot>,
    private readonly portraits: HeroPortraitCache,
    private readonly onInspect: (heroId: string) => void,
    private readonly onInspectMemorial: (heroId: string) => void,
    private readonly onRecruit: () => void,
    private readonly onUpgradeDormitory: () => void,
    private readonly onClose: () => void,
  ) {
    this.element = document.createElement("section");
    this.element.className = "system-panel roster-panel";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Hero roster");
    this.element.innerHTML = `
      <header class="system-panel__header">
        <div><span>REFUGE PERSONNEL</span><h1>Heroes</h1></div>
        <button type="button" class="roster-recruit" data-roster-action="recruit">OPEN GATE · ${this.getRecruitmentCost()} SHARDS</button>
        <strong data-roster-count></strong>
        <button type="button" data-roster-action="close" aria-label="Close hero roster">×</button>
      </header>
      <section class="dormitory-status" aria-label="Dormitory status">
        <div><span>DORMITORY</span><strong data-dormitory="occupancy"></strong><small data-dormitory="comfort"></small></div>
        <div class="dormitory-status__effects"><span data-dormitory="fatigue"></span><span data-dormitory="morale"></span></div>
        <button type="button" data-roster-action="upgrade-dormitory"></button>
      </section>
      <div class="roster-filters" role="toolbar" aria-label="Filter heroes">
        ${FILTERS.map((filter) => `<button type="button" data-roster-filter="${filter}" aria-pressed="${filter === "All"}">${filter}</button>`).join("")}
      </div>
      <div class="roster-grid"></div>
      <section class="memorial-ledger" data-roster-memorial hidden></section>
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
      this.lastSignature = "";
      this.render();
    }
  }

  update(): void {
    if (!this.expanded) return;
    const signature = this.getSignature();
    if (signature !== this.lastSignature) this.render();
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private render(): void {
    this.lastSignature = this.getSignature();
    const squad = this.getSquad();
    const heroes = this.getHeroes();
    const visibleHeroes = heroes.filter((hero) => this.matchesFilter(hero));
    const count = this.element.querySelector<HTMLElement>("[data-roster-count]");
    const dormitory = this.getDormitory();
    if (count) {
      count.textContent = `${heroes.length} / ${dormitory.capacity}`;
    }
    this.renderDormitory(dormitory);
    const recruit = this.element.querySelector<HTMLButtonElement>("[data-roster-action='recruit']");
    if (recruit) {
      const full = dormitory.occupied >= dormitory.capacity;
      const lacksShards = this.getRiftShards() < this.getRecruitmentCost();
      recruit.disabled = full || lacksShards;
      recruit.title = full
        ? "Upgrade the Dormitory before recruiting another hero."
        : lacksShards
          ? "Secure Rift Shards through a successful expedition."
          : "Open the Dimensional Gate";
      recruit.setAttribute("aria-label", recruit.disabled
        ? `Open Gate unavailable. ${recruit.title}`
        : `Open Dimensional Gate for ${this.getRecruitmentCost()} Rift Shards.`);
    }
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
      const injury = hero.injuries.find((candidate) => !candidate.permanent) ?? hero.injuries[0];
      status.textContent = injury ? injury.type : this.getStatus(hero);
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
    this.renderMemorials();
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
    if (button.dataset.rosterAction === "recruit") {
      this.onRecruit();
      return;
    }
    if (button.dataset.rosterAction === "upgrade-dormitory") {
      this.onUpgradeDormitory();
      this.render();
      return;
    }
    if (this.isFilter(button.dataset.rosterFilter)) {
      this.filter = button.dataset.rosterFilter;
      this.render();
      return;
    }
    if (button.dataset.heroId) {
      this.onInspect(button.dataset.heroId);
    } else if (button.dataset.memorialHeroId) {
      this.onInspectMemorial(button.dataset.memorialHeroId);
    }
  };

  private renderMemorials(): void {
    const container = this.element.querySelector<HTMLElement>("[data-roster-memorial]");
    if (!container) {
      return;
    }
    const fallen = this.getFallenHeroes();
    container.hidden = fallen.length === 0;
    if (fallen.length === 0) {
      container.replaceChildren();
      return;
    }
    const heading = document.createElement("div");
    heading.className = "section-heading";
    heading.textContent = "Memorial record";
    const list = document.createElement("div");
    list.className = "memorial-ledger__list";
    fallen.forEach((record) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.memorialHeroId = record.heroId;
      button.setAttribute("aria-label", `View memorial record for ${record.name}`);
      const name = document.createElement("strong");
      name.textContent = record.name;
      const details = document.createElement("span");
      details.textContent = `Day ${record.joinedDay} — ${record.diedDay} · ${record.causeOfDeath}`;
      button.append(name, details);
      list.appendChild(button);
    });
    container.replaceChildren(heading, list);
  }

  private renderDormitory(dormitory: Readonly<DormitorySnapshot>): void {
    const occupancy = this.element.querySelector<HTMLElement>("[data-dormitory='occupancy']");
    const comfort = this.element.querySelector<HTMLElement>("[data-dormitory='comfort']");
    const fatigue = this.element.querySelector<HTMLElement>("[data-dormitory='fatigue']");
    const morale = this.element.querySelector<HTMLElement>("[data-dormitory='morale']");
    const upgrade = this.element.querySelector<HTMLButtonElement>("[data-roster-action='upgrade-dormitory']");
    if (!occupancy || !comfort || !fatigue || !morale || !upgrade) {
      throw new Error("Dormitory status structure is incomplete.");
    }
    occupancy.textContent = `${dormitory.occupied} / ${dormitory.capacity} beds`;
    comfort.textContent = `Level ${dormitory.level} · ${dormitory.comfort} comfort`;
    fatigue.textContent = `Rest fatigue ×${dormitory.fatigueRecoveryMultiplier.toFixed(2)}`;
    morale.textContent = `Rest morale +${dormitory.moraleRecoveryBonus.toFixed(1)}/hr`;
    if (dormitory.upgradeCost === null) {
      upgrade.textContent = "MAXIMUM CAPACITY";
      upgrade.disabled = true;
      upgrade.title = "The Phase 19 dormitory is fully upgraded.";
      upgrade.setAttribute("aria-label", "Dormitory is at maximum capacity.");
      return;
    }
    upgrade.textContent = `UPGRADE · ${dormitory.upgradeCost} SCRAP`;
    upgrade.disabled = this.getScrap() < dormitory.upgradeCost;
    upgrade.title = upgrade.disabled
      ? `Requires ${dormitory.upgradeCost} Scrap.`
      : `Increase capacity and improve rest comfort.`;
    upgrade.setAttribute("aria-label", upgrade.disabled
      ? `Dormitory upgrade unavailable. ${upgrade.title}`
      : `Upgrade Dormitory for ${dormitory.upgradeCost} Scrap.`);
  }

  private matchesFilter(hero: Readonly<Hero>): boolean {
    const status = this.getStatus(hero);
    return this.filter === "All" || status === this.filter;
  }

  private getStatus(hero: Readonly<Hero>): Exclude<RosterFilter, "All"> {
    if (hero.injuries.length > 0 || hero.needs.health < 70 || hero.needs.fatigue > 75) {
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

  private getSignature(): string {
    const squad = this.getSquad();
    return JSON.stringify({
      filter: this.filter,
      riftShards: this.getRiftShards(),
      scrap: this.getScrap(),
      dormitory: this.getDormitory(),
      heroes: this.getHeroes().map((hero) => [
        hero.id,
        Math.round(hero.needs.health),
        Math.round(hero.needs.fatigue),
        hero.training.active?.type,
        hero.training.queue.length,
        hero.injuries.map((injury) => [injury.id, injury.treated]),
      ]),
      memorials: this.getFallenHeroes().map((record) => [record.heroId, record.diedDay]),
      squad: squad.members,
    });
  }
}
