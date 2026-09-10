import type { CombatSnapshot, CombatantSnapshot } from "../combat/Combat";
import type { ExpeditionSnapshot } from "../expeditions/Expedition";

interface ExpeditionActions {
  close(): void;
  deploy(): boolean;
  returnToRefuge(): boolean;
}

export class ExpeditionOverlay {
  private readonly element: HTMLElement;
  private expanded = false;
  private lastRenderKey = "";
  private readonly panel: HTMLElement;
  private previousPhase: ExpeditionSnapshot["phase"] = "Briefing";
  private readonly toggle: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    private readonly getExpedition: () => Readonly<ExpeditionSnapshot>,
    private readonly getCombat: () => Readonly<CombatSnapshot>,
    private readonly canDeploy: () => boolean,
    private readonly actions: ExpeditionActions,
  ) {
    this.element = document.createElement("aside");
    this.element.className = "system-panel rift-panel expedition-overlay";
    this.element.setAttribute("aria-label", "Expedition command");
    this.element.innerHTML = `
      <button class="expedition-overlay__toggle" type="button" aria-expanded="false">EXPEDITION</button>
      <div class="expedition-overlay__panel" hidden></div>
    `;
    const toggle = this.element.querySelector<HTMLButtonElement>(".expedition-overlay__toggle");
    const panel = this.element.querySelector<HTMLElement>(".expedition-overlay__panel");
    if (!toggle || !panel) {
      throw new Error("Expedition overlay structure is incomplete.");
    }
    this.toggle = toggle;
    this.panel = panel;
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
    this.update();
  }

  update(): void {
    const expedition = this.getExpedition();
    const combat = this.getCombat();
    if (expedition.phase !== "Briefing" && expedition.phase !== this.previousPhase) {
      this.expanded = true;
    }
    this.previousPhase = expedition.phase;
    const renderKey = [
      this.expanded,
      this.canDeploy(),
      expedition.phase,
      expedition.attempt,
      expedition.resources.food,
      expedition.resources.riftShards,
      expedition.resources.scrap,
      expedition.report?.outcome ?? "",
      combat.result,
      combat.tick,
      ...combat.combatants.map((entry) => `${entry.id}:${Math.ceil(entry.hp)}:${entry.action}`),
    ].join("|");
    if (renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;
    this.render(expedition, combat);
  }

  open(): void {
    this.expanded = true;
    this.lastRenderKey = "";
    this.update();
  }

  close(): void {
    if (this.getExpedition().phase !== "Briefing") {
      return;
    }
    this.expanded = false;
    this.lastRenderKey = "";
    this.update();
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private render(
    expedition: Readonly<ExpeditionSnapshot>,
    combat: Readonly<CombatSnapshot>,
  ): void {
    const label = expedition.phase === "Combat"
      ? "EXPEDITION · FIELD"
      : expedition.phase === "Debrief"
        ? "EXPEDITION · REPORT"
        : "EXPEDITION";
    this.toggle.textContent = label;
    this.toggle.dataset.active = String(expedition.phase !== "Briefing");
    this.toggle.setAttribute("aria-expanded", String(this.expanded));
    this.panel.hidden = !this.expanded;
    if (!this.expanded) {
      return;
    }
    this.panel.innerHTML = expedition.phase === "Briefing"
      ? this.renderBriefing(expedition)
      : expedition.phase === "Combat"
        ? this.renderCombat(expedition, combat)
        : this.renderDebrief(expedition);
  }

  private renderBriefing(expedition: Readonly<ExpeditionSnapshot>): string {
    const { mission, resources } = expedition;
    const ready = this.canDeploy();
    return `
      ${this.renderHeader("MISSION BRIEFING", mission.difficulty)}
      <section class="expedition-overlay__mission">
        <span>${mission.objective}</span>
        <strong>${mission.name}</strong>
        <p>${mission.description}</p>
      </section>
      <div class="expedition-overlay__columns">
        <section><span class="expedition-overlay__heading">Threats</span><ul>${mission.threats.map((threat) => `<li>${this.escape(threat)}</li>`).join("")}</ul></section>
        <section><span class="expedition-overlay__heading">Expected recovery</span>${this.renderResources(mission.rewards)}</section>
      </div>
      ${this.renderStockpile(resources)}
      <p class="expedition-overlay__readiness" data-ready="${ready}">${ready ? "Squad ready for deployment." : "A complete three-hero squad is required."}</p>
      <button class="expedition-overlay__primary" type="button" data-expedition-action="deploy"${ready ? "" : " disabled"}>DEPLOY SQUAD</button>
    `;
  }

  private renderCombat(
    expedition: Readonly<ExpeditionSnapshot>,
    combat: Readonly<CombatSnapshot>,
  ): string {
    const heroes = combat.combatants.filter((entry) => entry.team === "Hero");
    const enemies = combat.combatants.filter((entry) => entry.team === "Enemy");
    return `
      ${this.renderHeader(expedition.mission.objective.toUpperCase(), "IN PROGRESS", false)}
      <div class="expedition-overlay__field-meta"><span>${this.escape(expedition.deployedSquadName ?? "Deployed squad")}</span><strong>ROUND ${combat.tick}</strong></div>
      <div class="expedition-overlay__teams">
        <section><span class="expedition-overlay__heading">Squad</span>${heroes.map((entry) => this.renderCombatant(entry)).join("")}</section>
        <section><span class="expedition-overlay__heading">Hostiles</span>${enemies.map((entry) => this.renderCombatant(entry)).join("")}</section>
      </div>
      <ol class="expedition-overlay__log" aria-live="polite">${combat.log.slice(0, 5).map((entry) => `<li data-tone="${entry.tone}"><b>T${entry.tick}</b><span>${this.escape(entry.message)}</span></li>`).join("")}</ol>
    `;
  }

  private renderDebrief(expedition: Readonly<ExpeditionSnapshot>): string {
    const report = expedition.report;
    if (!report) {
      return this.renderHeader("MISSION REPORT", "PENDING");
    }
    const success = report.outcome === "Victory";
    return `
      ${this.renderHeader("MISSION REPORT", report.outcome.toUpperCase(), false)}
      <section class="expedition-overlay__outcome" data-success="${success}">
        <strong>${success ? "ROUTE SECURED" : "DEPLOYMENT FAILED"}</strong>
        <p>${report.summary}</p>
      </section>
      <section>
        <span class="expedition-overlay__heading">Recovered</span>
        ${success ? this.renderResources(report.rewards) : '<p class="expedition-overlay__empty">No resources recovered.</p>'}
      </section>
      ${report.consequences.length > 0 ? `
        <section class="expedition-overlay__consequences">
          <span class="expedition-overlay__heading">Immediate consequences</span>
          ${report.consequences.map((entry) => `<div><strong>${this.escape(entry.heroName)}</strong><span>${this.escape(entry.detail)}</span></div>`).join("")}
          <small>Persistent injuries and permanent death unlock in later phases.</small>
        </section>
      ` : ""}
      ${this.renderStockpile(expedition.resources)}
      <button class="expedition-overlay__primary" type="button" data-expedition-action="return">RETURN TO REFUGE</button>
    `;
  }

  private renderHeader(title: string, status: string, close = true): string {
    return `<header><div><span>${this.escape(title)}</span><strong>${this.escape(status)}</strong></div>${close ? '<button type="button" data-expedition-action="close" aria-label="Close expedition panel">×</button>' : ""}</header>`;
  }

  private renderResources(resources: Readonly<ExpeditionSnapshot["resources"]>): string {
    return `<div class="expedition-overlay__resources"><span><b>${resources.scrap}</b> Scrap</span><span><b>${resources.food}</b> Food</span><span><b>${resources.riftShards}</b> Rift Shards</span></div>`;
  }

  private renderStockpile(resources: Readonly<ExpeditionSnapshot["resources"]>): string {
    return `<section class="expedition-overlay__stockpile"><span class="expedition-overlay__heading">Refuge stockpile</span>${this.renderResources(resources)}</section>`;
  }

  private renderCombatant(combatant: Readonly<CombatantSnapshot>): string {
    const health = Math.max(0, Math.round((combatant.hp / combatant.stats.maxHp) * 100));
    return `
      <div class="expedition-overlay__combatant" data-team="${combatant.team.toLowerCase()}" data-action="${combatant.action.toLowerCase()}">
        <div><strong>${this.escape(combatant.label)}</strong><span>${combatant.action}</span></div>
        <i><b style="--health:${health}%"></b></i>
        <small>${Math.ceil(combatant.hp)} / ${Math.round(combatant.stats.maxHp)} HP</small>
      </div>
    `;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!button) {
      return;
    }
    if (button === this.toggle) {
      this.expanded = !this.expanded;
    } else if (button.dataset.expeditionAction === "close") {
      this.actions.close();
    } else if (button.dataset.expeditionAction === "deploy" && this.actions.deploy()) {
      this.expanded = true;
    } else if (button.dataset.expeditionAction === "return" && this.actions.returnToRefuge()) {
      this.expanded = false;
      this.actions.close();
    }
    this.lastRenderKey = "";
    this.update();
  };

  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
