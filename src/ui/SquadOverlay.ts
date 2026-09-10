import type { Hero } from "../heroes/Hero";
import { getRelationshipLabel } from "../heroes/RelationshipSystem";
import type { HeroPortraitCache } from "../rendering/heroes/HeroPortraitCache";
import type { FormationPosition, Squad, SquadEvaluation, SquadRole } from "../squads/Squad";
import { SQUAD_SIZE } from "../squads/SquadSystem";

interface SquadActions {
  addHero(heroId: string): void;
  moveFormation(heroId: string, formation: FormationPosition): void;
  removeHero(heroId: string): void;
  rename(name: string): void;
  setRole(heroId: string, role: SquadRole): void;
}

const FORMATIONS: readonly FormationPosition[] = ["Front", "Middle", "Back"];
const ROLES: readonly SquadRole[] = ["Vanguard", "Damage", "Support"];

export class SquadOverlay {
  private readonly element: HTMLElement;
  private expanded = false;

  constructor(
    container: HTMLElement,
    private readonly getHeroes: () => readonly Readonly<Hero>[],
    private readonly getSquad: () => Readonly<Squad>,
    private readonly getEvaluation: () => Readonly<SquadEvaluation>,
    private readonly portraits: HeroPortraitCache,
    private readonly actions: SquadActions,
    private readonly onClose: () => void,
  ) {
    this.element = document.createElement("section");
    this.element.className = "system-panel party-panel";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Party formation");
    this.element.addEventListener("click", this.handleClick);
    this.element.addEventListener("change", this.handleChange);
    this.element.addEventListener("dragstart", this.handleDragStart);
    this.element.addEventListener("dragover", this.handleDragOver);
    this.element.addEventListener("drop", this.handleDrop);
    container.appendChild(this.element);
  }

  open(): void {
    this.expanded = true;
    this.element.hidden = false;
    this.render();
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

  updateEvaluation(): void {
    if (this.expanded) {
      this.renderSummary();
    }
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.removeEventListener("change", this.handleChange);
    this.element.removeEventListener("dragstart", this.handleDragStart);
    this.element.removeEventListener("dragover", this.handleDragOver);
    this.element.removeEventListener("drop", this.handleDrop);
    this.element.remove();
  }

  private render(): void {
    const squad = this.getSquad();
    this.element.innerHTML = `
      <header class="system-panel__header">
        <div><span>EXPEDITION FORMATION</span><input aria-label="Party name" maxlength="28" value="${this.escape(squad.name)}"></div>
        <strong>${squad.members.length}/${SQUAD_SIZE}</strong>
        <button type="button" data-party-action="close" aria-label="Close party panel">×</button>
      </header>
      <div class="party-layout">
        <div class="party-formation" aria-label="Formation slots"></div>
        <aside class="party-summary" data-party="summary"></aside>
      </div>
      <section class="party-reserves">
        <div class="section-heading"><span>Available heroes</span><small>Assign up to three</small></div>
        <div class="party-reserves__list"></div>
      </section>
    `;
    const formation = this.element.querySelector<HTMLElement>(".party-formation");
    const reserves = this.element.querySelector<HTMLElement>(".party-reserves__list");
    if (!formation || !reserves) {
      throw new Error("Party panel structure is incomplete.");
    }
    formation.replaceChildren(...FORMATIONS.map((position) => this.renderSlot(position, squad)));
    this.renderReserves(reserves, squad);
    this.renderSummary();
  }

  private renderSlot(position: FormationPosition, squad: Readonly<Squad>): HTMLElement {
    const slot = document.createElement("section");
    slot.className = "formation-slot";
    slot.dataset.formation = position;
    const label = document.createElement("span");
    label.className = "formation-slot__label";
    label.textContent = position.toUpperCase();
    slot.appendChild(label);
    const member = squad.members.find((candidate) => candidate.formation === position);
    const hero = member ? this.getHeroes().find((candidate) => candidate.id === member.heroId) : undefined;
    if (!member || !hero) {
      const empty = document.createElement("div");
      empty.className = "formation-slot__empty";
      empty.textContent = "Drop hero here";
      slot.appendChild(empty);
      return slot;
    }
    const card = this.createPartyCard(hero, member.role);
    card.draggable = true;
    card.dataset.heroId = hero.id;
    const controls = document.createElement("div");
    controls.className = "party-card__controls";
    const formationLabel = document.createElement("label");
    formationLabel.textContent = "Position";
    const formationSelect = document.createElement("select");
    formationSelect.dataset.partyField = "formation";
    formationSelect.dataset.heroId = hero.id;
    formationSelect.setAttribute("aria-label", `${hero.name} formation position`);
    formationSelect.innerHTML = this.renderOptions(FORMATIONS, position);
    formationLabel.appendChild(formationSelect);
    const roleLabel = document.createElement("label");
    roleLabel.textContent = "Role";
    const roleSelect = document.createElement("select");
    roleSelect.dataset.partyField = "role";
    roleSelect.dataset.heroId = hero.id;
    roleSelect.setAttribute("aria-label", `${hero.name} party role`);
    roleSelect.innerHTML = this.renderOptions(ROLES, member.role);
    roleLabel.appendChild(roleSelect);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.partyAction = "remove";
    remove.dataset.heroId = hero.id;
    remove.textContent = "Remove";
    controls.append(formationLabel, roleLabel, remove);
    slot.append(card, controls);
    return slot;
  }

  private createPartyCard(hero: Readonly<Hero>, role: SquadRole): HTMLElement {
    const card = document.createElement("article");
    card.className = "party-hero-card";
    const portrait = document.createElement("div");
    portrait.className = "party-hero-card__portrait";
    const url = this.portraits.get(hero.id);
    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      portrait.appendChild(image);
    } else {
      portrait.textContent = this.getInitials(hero.name);
    }
    const stars = document.createElement("span");
    stars.className = "party-hero-card__rank";
    stars.textContent = "★".repeat(hero.rank);
    const name = document.createElement("strong");
    name.textContent = hero.name;
    const details = document.createElement("span");
    details.textContent = `${role} · Level ${hero.level}`;
    card.append(portrait, stars, name, details);
    return card;
  }

  private renderReserves(container: HTMLElement, squad: Readonly<Squad>): void {
    const full = squad.members.length >= SQUAD_SIZE;
    const available = this.getHeroes().filter((hero) => !squad.members.some((member) => member.heroId === hero.id));
    container.replaceChildren(...available.map((hero) => {
      const row = document.createElement("div");
      row.className = "reserve-hero";
      const identity = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = hero.name;
      const detail = document.createElement("small");
      detail.textContent = `Level ${hero.level} · ${hero.origin.occupation}`;
      identity.append(name, detail);
      const add = document.createElement("button");
      add.type = "button";
      add.dataset.partyAction = "add";
      add.dataset.heroId = hero.id;
      add.disabled = full;
      add.textContent = "Assign →";
      row.append(identity, add);
      return row;
    }));
    if (available.length === 0) {
      container.textContent = "Every resident is assigned.";
    }
  }

  private renderSummary(): void {
    const container = this.element.querySelector<HTMLElement>("[data-party='summary']");
    if (!container) {
      return;
    }
    const squad = this.getSquad();
    const evaluation = this.getEvaluation();
    const members = squad.members
      .map((member) => this.getHeroes().find((hero) => hero.id === member.heroId))
      .filter((hero): hero is Readonly<Hero> => hero !== undefined);
    const pairings: string[] = [];
    members.forEach((hero, index) => {
      members.slice(index + 1).forEach((other) => {
        const profile = hero.relationships[other.id];
        if (profile) {
          pairings.push(`${hero.name.split(" ")[0]} ↔ ${other.name.split(" ")[0]} · ${getRelationshipLabel(profile)}`);
        }
      });
    });
    container.innerHTML = `
      <span class="section-heading">Party record</span>
      <dl>
        <div><dt>Status</dt><dd data-ready="${evaluation.isReady}">${evaluation.isReady ? "READY" : evaluation.isComplete ? "RECOVERY BLOCKED" : "FORMING"}</dd></div>
        ${evaluation.recoveringMembers ? `<div><dt>Recovering</dt><dd>${evaluation.recoveringMembers}</dd></div>` : ""}
        <div><dt>Power</dt><dd>${evaluation.combatPower}</dd></div>
        <div><dt>Defense</dt><dd>${evaluation.defense}</dd></div>
        <div><dt>Healing</dt><dd>${evaluation.healing}</dd></div>
        <div><dt>Average level</dt><dd>${evaluation.averageLevel.toFixed(1)}</dd></div>
        <div><dt>Cohesion</dt><dd>${evaluation.chemistry} · ${evaluation.cohesion}%</dd></div>
        <div><dt>Trust</dt><dd>${evaluation.trust}%</dd></div>
        <div><dt>Doctrine</dt><dd>${squad.doctrine}</dd></div>
      </dl>
      <div class="party-chemistry"><span class="section-heading">Chemistry</span>${pairings.length ? pairings.map((pairing) => `<p>${this.escape(pairing)}</p>`).join("") : "<p>Assign two heroes to reveal squad dynamics.</p>"}</div>
    `;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button) {
      return;
    }
    if (button.dataset.partyAction === "close") {
      this.onClose();
      return;
    }
    const heroId = button.dataset.heroId;
    if (!heroId) {
      return;
    }
    if (button.dataset.partyAction === "add") {
      this.actions.addHero(heroId);
    } else if (button.dataset.partyAction === "remove") {
      this.actions.removeHero(heroId);
    }
    this.render();
  };

  private readonly handleChange = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.actions.rename(target.value);
      this.render();
      return;
    }
    if (!(target instanceof HTMLSelectElement) || !target.dataset.heroId) {
      return;
    }
    if (target.dataset.partyField === "formation" && this.isFormation(target.value)) {
      this.actions.moveFormation(target.dataset.heroId, target.value);
    } else if (target.dataset.partyField === "role" && this.isRole(target.value)) {
      this.actions.setRole(target.dataset.heroId, target.value);
    }
    this.render();
  };

  private readonly handleDragStart = (event: DragEvent): void => {
    const card = (event.target as Element | null)?.closest<HTMLElement>("[data-hero-id]");
    if (card?.dataset.heroId && event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.heroId);
    }
  };

  private readonly handleDragOver = (event: DragEvent): void => {
    if ((event.target as Element | null)?.closest("[data-formation]")) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    }
  };

  private readonly handleDrop = (event: DragEvent): void => {
    const slot = (event.target as Element | null)?.closest<HTMLElement>("[data-formation]");
    const heroId = event.dataTransfer?.getData("text/plain");
    const formation = slot?.dataset.formation;
    if (!heroId || !this.isFormation(formation)) {
      return;
    }
    event.preventDefault();
    this.actions.moveFormation(heroId, formation);
    this.render();
  };

  private renderOptions<T extends string>(options: readonly T[], selected: T): string {
    return options.map((option) => `<option${option === selected ? " selected" : ""}>${option}</option>`).join("");
  }

  private getInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  private isFormation(value: string | undefined): value is FormationPosition {
    return value !== undefined && FORMATIONS.includes(value as FormationPosition);
  }

  private isRole(value: string): value is SquadRole {
    return ROLES.includes(value as SquadRole);
  }

  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
