import type { CombatSnapshot, CombatantSnapshot } from "../combat/Combat";

interface CombatActions {
  exit(): void;
  start(): boolean;
}

export class CombatOverlay {
  private expanded = false;
  private readonly element: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private lastRenderKey = "";
  private previousResult = "Idle";

  constructor(
    container: HTMLElement,
    private readonly getSnapshot: () => Readonly<CombatSnapshot>,
    private readonly canStart: () => boolean,
    private readonly actions: CombatActions,
  ) {
    this.element = document.createElement("aside");
    this.element.className = "combat-overlay";
    this.element.setAttribute("aria-label", "Combat sandbox");
    this.element.innerHTML = `
      <button class="combat-overlay__toggle" type="button" aria-expanded="false">ARENA</button>
      <div class="combat-overlay__panel" hidden></div>
    `;
    const toggle = this.element.querySelector<HTMLButtonElement>(".combat-overlay__toggle");
    const panel = this.element.querySelector<HTMLElement>(".combat-overlay__panel");
    if (!toggle || !panel) {
      throw new Error("Combat overlay structure is incomplete.");
    }
    this.toggle = toggle;
    this.panel = panel;
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
    this.update();
  }

  update(): void {
    const snapshot = this.getSnapshot();
    if (snapshot.result !== "Idle" && this.previousResult === "Idle") {
      this.expanded = true;
    }
    this.previousResult = snapshot.result;
    const renderKey = [
      this.expanded,
      this.canStart(),
      snapshot.result,
      snapshot.tick,
      ...snapshot.combatants.map((combatant) => `${combatant.id}:${Math.ceil(combatant.hp)}:${combatant.action}`),
    ].join("|");
    if (renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;
    this.render(snapshot);
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private render(snapshot: Readonly<CombatSnapshot>): void {
    const active = snapshot.result !== "Idle";
    this.toggle.textContent = active ? `ARENA · ${snapshot.result.toUpperCase()}` : "ARENA";
    this.toggle.dataset.active = String(active);
    this.toggle.setAttribute("aria-expanded", String(this.expanded));
    this.panel.hidden = !this.expanded;
    if (!this.expanded) {
      return;
    }

    const ready = this.canStart();
    this.panel.innerHTML = `
      <header>
        <div><span>COMBAT SANDBOX</span><strong>${snapshot.result.toUpperCase()}</strong></div>
        <button type="button" data-combat-action="close" aria-label="Close combat panel">×</button>
      </header>
      ${active ? this.renderCombat(snapshot) : this.renderSetup(ready)}
    `;
  }

  private renderSetup(ready: boolean): string {
    return `
      <p>${ready ? "Squad ready for an isolated 3v3 test." : "Form a complete three-hero squad before entering the arena."}</p>
      <button class="combat-overlay__primary" type="button" data-combat-action="start"${ready ? "" : " disabled"}>START 3V3 TEST</button>
    `;
  }

  private renderCombat(snapshot: Readonly<CombatSnapshot>): string {
    const heroes = snapshot.combatants.filter((combatant) => combatant.team === "Hero");
    const enemies = snapshot.combatants.filter((combatant) => combatant.team === "Enemy");
    const ended = snapshot.result !== "Running";
    return `
      <div class="combat-overlay__teams">
        <section><span>HERO SQUAD</span>${heroes.map((combatant) => this.renderCombatant(combatant)).join("")}</section>
        <section><span>RIFT HOSTILES</span>${enemies.map((combatant) => this.renderCombatant(combatant)).join("")}</section>
      </div>
      <ol class="combat-overlay__log" aria-live="polite">
        ${snapshot.log.slice(0, 5).map((entry) => `<li data-tone="${entry.tone}"><b>T${entry.tick}</b>${entry.message}</li>`).join("")}
      </ol>
      <div class="combat-overlay__actions">
        ${ended ? '<button type="button" data-combat-action="start">RETRY</button>' : ""}
        <button type="button" data-combat-action="exit">RETURN TO REFUGE</button>
      </div>
    `;
  }

  private renderCombatant(combatant: Readonly<CombatantSnapshot>): string {
    const health = Math.max(0, Math.round((combatant.hp / combatant.stats.maxHp) * 100));
    return `
      <article data-team="${combatant.team.toLowerCase()}" data-action="${combatant.action.toLowerCase()}">
        <div><strong>${combatant.label}</strong><span>${combatant.action}</span></div>
        <div class="combat-overlay__health"><i style="--health:${health}%"></i></div>
        <small>${Math.ceil(combatant.hp)} / ${Math.round(combatant.stats.maxHp)} HP · ATK ${Math.round(combatant.stats.attack)} · DEF ${Math.round(combatant.stats.defense)}</small>
      </article>
    `;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button) {
      return;
    }
    if (button === this.toggle) {
      this.expanded = !this.expanded;
      this.lastRenderKey = "";
      this.update();
      return;
    }
    const action = button.dataset.combatAction;
    if (action === "close") {
      this.expanded = false;
    } else if (action === "start" && this.actions.start()) {
      this.expanded = true;
    } else if (action === "exit") {
      this.actions.exit();
      this.expanded = false;
    }
    this.lastRenderKey = "";
    this.update();
  };
}
