import type { Hero } from "../heroes/Hero";
import type {
  FormationPosition,
  Squad,
  SquadEvaluation,
  SquadRole,
} from "../squads/Squad";
import { SQUAD_SIZE } from "../squads/SquadSystem";

interface SquadActions {
  addHero(heroId: string): void;
  removeHero(heroId: string): void;
  rename(name: string): void;
  setFormation(heroId: string, formation: FormationPosition): void;
  setRole(heroId: string, role: SquadRole): void;
}

const FORMATIONS: readonly FormationPosition[] = ["Front", "Middle", "Back"];
const ROLES: readonly SquadRole[] = ["Vanguard", "Damage", "Support"];

export class SquadOverlay {
  private readonly element: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private expanded = false;

  constructor(
    container: HTMLElement,
    private readonly heroes: readonly Readonly<Hero>[],
    private readonly getSquad: () => Readonly<Squad>,
    private readonly getEvaluation: () => Readonly<SquadEvaluation>,
    private readonly actions: SquadActions,
  ) {
    this.element = document.createElement("aside");
    this.element.className = "squad-overlay";
    this.element.setAttribute("aria-label", "Squad editor");
    this.element.innerHTML = `
      <button class="squad-overlay__toggle" type="button" aria-expanded="false"></button>
      <div class="squad-overlay__panel" hidden></div>
    `;
    const toggle = this.element.querySelector<HTMLButtonElement>(".squad-overlay__toggle");
    const panel = this.element.querySelector<HTMLElement>(".squad-overlay__panel");
    if (!toggle || !panel) {
      throw new Error("Squad editor structure is incomplete.");
    }
    this.toggle = toggle;
    this.panel = panel;
    this.element.addEventListener("click", this.handleClick);
    this.element.addEventListener("change", this.handleChange);
    container.appendChild(this.element);
    this.render();
  }

  updateEvaluation(): void {
    if (!this.expanded) {
      return;
    }
    this.renderEvaluation(this.getEvaluation());
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.removeEventListener("change", this.handleChange);
    this.element.remove();
  }

  private render(): void {
    const squad = this.getSquad();
    const evaluation = this.getEvaluation();
    this.toggle.textContent = `SQUAD ${squad.members.length}/${SQUAD_SIZE}`;
    this.toggle.dataset.ready = String(evaluation.isComplete);
    this.toggle.setAttribute("aria-expanded", String(this.expanded));
    this.panel.hidden = !this.expanded;
    if (!this.expanded) {
      return;
    }

    this.panel.innerHTML = `
      <header>
        <div>
          <span class="squad-overlay__eyebrow">Expedition team</span>
          <input aria-label="Squad name" maxlength="28" value="${this.escapeAttribute(squad.name)}">
        </div>
        <button type="button" data-squad-action="close" aria-label="Close squad editor">×</button>
      </header>
      <div class="squad-overlay__meta">
        <span>Doctrine · ${squad.doctrine}</span>
        <strong data-squad="status">${evaluation.isComplete ? "READY" : `${squad.members.length} OF ${SQUAD_SIZE}`}</strong>
      </div>
      <div class="squad-overlay__evaluation" data-squad="evaluation"></div>
      <section>
        <span class="squad-overlay__heading">Formation</span>
        <div class="squad-overlay__members" data-squad="members"></div>
      </section>
      <section>
        <span class="squad-overlay__heading">Available heroes</span>
        <div class="squad-overlay__roster" data-squad="roster"></div>
      </section>
    `;
    this.renderEvaluation(evaluation);
    this.renderMembers(squad);
    this.renderRoster(squad);
  }

  private renderEvaluation(evaluation: Readonly<SquadEvaluation>): void {
    const container = this.panel.querySelector<HTMLElement>("[data-squad='evaluation']");
    const status = this.panel.querySelector<HTMLElement>("[data-squad='status']");
    if (!container || !status) {
      return;
    }
    status.textContent = evaluation.isComplete
      ? "READY"
      : `${this.getSquad().members.length} OF ${SQUAD_SIZE}`;
    status.dataset.ready = String(evaluation.isComplete);
    container.innerHTML = `
      <div><span>AVG LEVEL</span><strong>${evaluation.averageLevel.toFixed(1)}</strong></div>
      <div><span>COMBAT</span><strong>${evaluation.combatPower}</strong></div>
      <div><span>HEALING</span><strong>${evaluation.healing}</strong></div>
      <div><span>DEFENSE</span><strong>${evaluation.defense}</strong></div>
    `;
  }

  private renderMembers(squad: Readonly<Squad>): void {
    const container = this.panel.querySelector<HTMLElement>("[data-squad='members']");
    if (!container) {
      return;
    }
    if (squad.members.length === 0) {
      container.textContent = "Add three heroes to create the squad.";
      container.className = "squad-overlay__members squad-overlay__empty";
      return;
    }

    container.replaceChildren(
      ...squad.members.map((member) => {
        const hero = this.heroes.find((candidate) => candidate.id === member.heroId);
        const card = document.createElement("article");
        card.className = "squad-member";
        card.innerHTML = `
          <div class="squad-member__identity">
            <strong>${hero?.name ?? "Unknown hero"}</strong>
            <span>Lv ${hero?.level ?? 0} · ${hero?.previousOccupation ?? "Unknown"}</span>
          </div>
          <button type="button" data-squad-action="remove" data-hero-id="${member.heroId}" aria-label="Remove ${hero?.name ?? "hero"}">×</button>
          <label>Position<select data-squad-field="formation" data-hero-id="${member.heroId}">${this.renderOptions(FORMATIONS, member.formation)}</select></label>
          <label>Role<select data-squad-field="role" data-hero-id="${member.heroId}">${this.renderOptions(ROLES, member.role)}</select></label>
        `;
        return card;
      }),
    );
  }

  private renderRoster(squad: Readonly<Squad>): void {
    const container = this.panel.querySelector<HTMLElement>("[data-squad='roster']");
    if (!container) {
      return;
    }
    const full = squad.members.length >= SQUAD_SIZE;
    container.replaceChildren(
      ...this.heroes.map((hero) => {
        const assigned = squad.members.some((member) => member.heroId === hero.id);
        const row = document.createElement("div");
        const identity = document.createElement("span");
        const button = document.createElement("button");
        identity.textContent = `${hero.name} · Lv ${hero.level}`;
        button.type = "button";
        button.textContent = assigned ? "Assigned" : "Add";
        button.dataset.squadAction = "add";
        button.dataset.heroId = hero.id;
        button.disabled = assigned || full;
        row.append(identity, button);
        return row;
      }),
    );
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button) {
      return;
    }
    if (button === this.toggle || button.dataset.squadAction === "close") {
      this.expanded = button === this.toggle ? !this.expanded : false;
      this.render();
      return;
    }
    const heroId = button.dataset.heroId;
    if (!heroId) {
      return;
    }
    if (button.dataset.squadAction === "add") {
      this.actions.addHero(heroId);
    } else if (button.dataset.squadAction === "remove") {
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
    if (target.dataset.squadField === "formation" && this.isFormation(target.value)) {
      this.actions.setFormation(target.dataset.heroId, target.value);
    } else if (target.dataset.squadField === "role" && this.isRole(target.value)) {
      this.actions.setRole(target.dataset.heroId, target.value);
    }
    this.render();
  };

  private renderOptions<T extends string>(options: readonly T[], selected: T): string {
    return options
      .map((option) => `<option${option === selected ? " selected" : ""}>${option}</option>`)
      .join("");
  }

  private isFormation(value: string): value is FormationPosition {
    return FORMATIONS.includes(value as FormationPosition);
  }

  private isRole(value: string): value is SquadRole {
    return ROLES.includes(value as SquadRole);
  }

  private escapeAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
}
