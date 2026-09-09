import type {
  Hero,
  HeroAttributes,
  HeroNeeds,
  HeroSkills,
  Personality,
} from "../heroes/Hero";
import type { SelectionDetails } from "../rendering/SelectionRaycaster";

const ATTRIBUTE_LABELS: ReadonlyArray<[keyof HeroAttributes, string]> = [
  ["strength", "Strength"],
  ["agility", "Agility"],
  ["endurance", "Endurance"],
  ["intelligence", "Intelligence"],
  ["willpower", "Willpower"],
  ["leadership", "Leadership"],
];

const SKILL_LABELS: ReadonlyArray<[keyof HeroSkills, string]> = [
  ["sword", "Sword"],
  ["spear", "Spear"],
  ["medicine", "Medicine"],
  ["defense", "Defense"],
  ["leadership", "Leadership"],
];

const PERSONALITY_LABELS: ReadonlyArray<[keyof Personality, string]> = [
  ["bravery", "Bravery"],
  ["discipline", "Discipline"],
  ["aggression", "Aggression"],
  ["empathy", "Empathy"],
  ["loyalty", "Loyalty"],
  ["ambition", "Ambition"],
];

const NEED_LABELS: ReadonlyArray<[
  keyof HeroNeeds,
  string,
  "high-good" | "low-good",
]> = [
  ["hunger", "Hunger", "high-good"],
  ["fatigue", "Fatigue", "low-good"],
  ["morale", "Morale", "high-good"],
  ["health", "Health", "high-good"],
  ["stress", "Stress", "low-good"],
  ["social", "Social", "high-good"],
];

export class SelectionOverlay {
  private readonly element: HTMLElement;
  private readonly category: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly label: HTMLElement;
  private readonly heroContent: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement("aside");
    this.element.className = "selection-overlay";
    this.element.hidden = true;
    this.element.setAttribute("aria-live", "polite");
    this.element.innerHTML = `
      <span class="selection-overlay__eyebrow" data-selection="category"></span>
      <strong data-selection="label"></strong>
      <span class="selection-overlay__detail" data-selection="detail"></span>
      <div class="hero-panel" data-selection="hero" hidden>
        <div class="hero-panel__identity" data-hero="identity"></div>
        <div class="hero-panel__status" data-hero="status"></div>
        <div class="hero-panel__decision" data-hero="decision" hidden></div>
        <section>
          <span class="hero-panel__heading">Needs</span>
          <div class="hero-panel__meters hero-panel__needs" data-hero="needs"></div>
        </section>
        <section>
          <span class="hero-panel__heading">Traits</span>
          <div class="hero-panel__traits" data-hero="traits"></div>
        </section>
        <section>
          <span class="hero-panel__heading">Core attributes</span>
          <div class="hero-panel__grid" data-hero="attributes"></div>
        </section>
        <section>
          <span class="hero-panel__heading">Skills</span>
          <div class="hero-panel__grid" data-hero="skills"></div>
        </section>
        <section>
          <span class="hero-panel__heading">Personality</span>
          <div class="hero-panel__meters" data-hero="personality"></div>
        </section>
        <div class="hero-panel__potential">Potential · Undiscovered</div>
      </div>
    `;
    this.category = this.requireElement("category");
    this.detail = this.requireElement("detail");
    this.label = this.requireElement("label");
    this.heroContent = this.requireElement("hero");
    container.appendChild(this.element);
  }

  setSelection(selection: SelectionDetails | null, hero?: Readonly<Hero>): void {
    this.element.hidden = selection === null;
    if (!selection) {
      return;
    }
    this.category.textContent = selection.category;
    this.label.textContent = selection.label;
    this.detail.textContent = selection.detail ?? "";
    this.detail.hidden = !selection.detail;
    this.heroContent.hidden = !hero;
    if (hero) {
      this.renderHero(hero);
    }
  }

  dispose(): void {
    this.element.remove();
  }

  updateHeroRuntime(hero: Readonly<Hero>): void {
    const status = this.requireHeroElement("status");
    status.textContent =
      hero.movement.activity === "Walking" && hero.movement.destinationLabel
        ? `Walking → ${hero.movement.destinationLabel}`
        : hero.movement.activity;
    status.dataset.activity = hero.movement.activity.toLowerCase();
    const decision = this.requireHeroElement("decision");
    decision.textContent = hero.movement.decisionReason
      ? `Need override · ${hero.movement.decisionReason}`
      : "Scheduled routine";
    decision.hidden = false;
    decision.dataset.source = hero.movement.decisionSource.toLowerCase();
    this.renderNeeds(hero);
  }

  private renderHero(hero: Readonly<Hero>): void {
    const identity = this.requireHeroElement("identity");
    identity.textContent = `${hero.previousOccupation} · Age ${hero.age}`;
    this.updateHeroRuntime(hero);

    const traits = this.requireHeroElement("traits");
    traits.replaceChildren(
      ...hero.traits.map((trait) => {
        const chip = document.createElement("span");
        chip.textContent = trait;
        return chip;
      }),
    );

    this.renderValueGrid(this.requireHeroElement("attributes"), ATTRIBUTE_LABELS, hero.attributes);
    this.renderValueGrid(this.requireHeroElement("skills"), SKILL_LABELS, hero.skills);

    const personality = this.requireHeroElement("personality");
    personality.replaceChildren(
      ...PERSONALITY_LABELS.map(([key, label]) => {
        const row = document.createElement("div");
        row.className = "hero-panel__meter";
        const percentage = Math.round(hero.personality[key] * 100);
        row.innerHTML = `<span>${label}</span><span>${percentage}%</span><i></i>`;
        const meter = row.querySelector<HTMLElement>("i");
        if (meter) {
          meter.style.setProperty("--meter-value", `${percentage}%`);
        }
        return row;
      }),
    );
  }

  private renderNeeds(hero: Readonly<Hero>): void {
    const needs = this.requireHeroElement("needs");
    needs.replaceChildren(
      ...NEED_LABELS.map(([key, label, direction]) => {
        const row = document.createElement("div");
        row.className = "hero-panel__meter hero-panel__need";
        const percentage = Math.round(hero.needs[key]);
        const condition = direction === "high-good" ? percentage : 100 - percentage;
        row.dataset.condition = condition < 35 ? "critical" : condition < 60 ? "warning" : "stable";

        const name = document.createElement("span");
        const value = document.createElement("span");
        const meter = document.createElement("i");
        name.textContent = label;
        value.textContent = `${percentage}%`;
        meter.style.setProperty("--meter-value", `${percentage}%`);
        row.append(name, value, meter);
        return row;
      }),
    );
  }

  private renderValueGrid<Values extends object>(
    container: HTMLElement,
    labels: ReadonlyArray<[keyof Values, string]>,
    values: Readonly<Values>,
  ): void {
    container.replaceChildren(
      ...labels.map(([key, label]) => {
        const row = document.createElement("div");
        const name = document.createElement("span");
        const value = document.createElement("strong");
        name.textContent = label;
        value.textContent = String(values[key]);
        row.append(name, value);
        return row;
      }),
    );
  }

  private requireHeroElement(name: string): HTMLElement {
    const element = this.heroContent.querySelector<HTMLElement>(`[data-hero="${name}"]`);
    if (!element) {
      throw new Error(`Hero panel is missing the ${name} element.`);
    }
    return element;
  }

  private requireElement(name: string): HTMLElement {
    const element = this.element.querySelector<HTMLElement>(`[data-selection="${name}"]`);
    if (!element) {
      throw new Error(`Selection overlay is missing the ${name} element.`);
    }
    return element;
  }
}
