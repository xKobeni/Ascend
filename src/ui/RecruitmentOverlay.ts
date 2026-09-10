import type { RecruitmentResult } from "../simulation/Simulation";
import type { HeroPortraitCache } from "../rendering/heroes/HeroPortraitCache";
import { skillDefinitionRegistry } from "../skills/SkillDefinitionRegistry";

export class RecruitmentOverlay {
  private readonly element: HTMLElement;
  private result: Readonly<RecruitmentResult> | null = null;

  constructor(
    container: HTMLElement,
    private readonly portraits: HeroPortraitCache,
    private readonly onClose: () => void,
  ) {
    this.element = document.createElement("section");
    this.element.className = "system-panel recruitment-panel";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Dimensional Gate recruitment result");
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  open(result: Readonly<RecruitmentResult>): void {
    this.result = result;
    this.element.hidden = false;
    this.render();
    this.element.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }

  close(): void {
    this.result = null;
    this.element.hidden = true;
    this.element.replaceChildren();
  }

  isOpen(): boolean {
    return !this.element.hidden;
  }

  refresh(): void {
    if (this.result) {
      this.render();
    }
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private render(): void {
    const result = this.result;
    if (!result) {
      return;
    }
    const { hero } = result;
    const portraitUrl = this.portraits.get(hero.id);
    const knownSkills = Object.values(hero.skillForge.known)
      .map((skill) => skillDefinitionRegistry.require(skill.definitionId).name);
    this.element.innerHTML = `
      <header class="system-panel__header">
        <div><span>DIMENSIONAL GATE</span><h1 tabindex="-1">New arrival</h1></div>
        <strong>${result.cost} SHARDS</strong>
        <button type="button" data-recruitment-action="close" aria-label="Continue to hero roster">×</button>
      </header>
      <div class="recruitment-reveal">
        <div class="recruitment-reveal__portrait">
          ${portraitUrl
            ? `<img src="${portraitUrl}" alt="Procedural portrait of ${this.escape(hero.name)}">`
            : `<span>${this.escape(this.getInitials(hero.name))}</span>`}
        </div>
        <article class="recruitment-reveal__record">
          <span>RESONANCE ${result.seed}</span>
          <div class="recruitment-reveal__rank" aria-label="Rank ${result.rank}">${"★".repeat(result.rank)}</div>
          <h2>${this.escape(hero.name)}</h2>
          <p>${this.escape(hero.origin.occupation)} · ${this.escape(hero.origin.category)} · Age ${hero.age}</p>
          <section><strong>Visible traits</strong><div>${hero.traits.map((trait) => `<span>${this.escape(trait)}</span>`).join("")}</div></section>
          <section><strong>Visible skills</strong><div>${knownSkills.map((skill) => `<span>${this.escape(skill)}</span>`).join("") || "<small>Undiscovered potential</small>"}</div></section>
          <small>Hidden potential remains concealed. Class and equipment are not assigned.</small>
        </article>
      </div>
      <button type="button" class="recruitment-reveal__continue" data-recruitment-action="close">Enter the Refuge</button>
    `;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if ((event.target as Element | null)?.closest("[data-recruitment-action='close']")) {
      this.onClose();
    }
  };

  private getInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
