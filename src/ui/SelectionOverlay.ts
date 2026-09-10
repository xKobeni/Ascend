import type {
  Hero,
  HeroAttributes,
  HeroNeeds,
  HeroSkills,
  Personality,
  TrainingType,
} from "../heroes/Hero";
import type { SelectionDetails } from "../rendering/SelectionRaycaster";
import { getRelationshipLabel } from "../heroes/RelationshipSystem";
import { skillDefinitionRegistry } from "../skills/SkillDefinitionRegistry";
import { ACTIVE_SKILL_SLOTS, PASSIVE_SKILL_SLOTS } from "../skills/SkillLoadoutSystem";
import { getSkillXpToNextLevel } from "../skills/SkillProgressionSystem";

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

const TRAINING_TYPES: readonly TrainingType[] = [
  "Strength Training",
  "Weapon Training",
  "Defense Training",
];

export class SelectionOverlay {
  private readonly element: HTMLElement;
  private readonly category: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly label: HTMLElement;
  private readonly heroContent: HTMLElement;
  private selectedHeroId: string | null = null;
  private skillForgeRenderSignature: string | null = null;

  constructor(
    container: HTMLElement,
    private readonly onQueueTraining: (heroId: string, type: TrainingType) => void,
    private readonly onToggleSkillLoadout: (heroId: string, definitionId: string) => void,
  ) {
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
        <div class="hero-panel__path" data-hero="path"></div>
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
        <section class="hero-panel__skill-forge">
          <span class="hero-panel__heading">Hero Skill Forge</span>
          <div class="hero-panel__skill-summary" data-hero="skill-summary"></div>
          <div class="hero-panel__skill-list" data-hero="skill-forge"></div>
          <div class="hero-panel__skill-potential" data-hero="skill-potential"></div>
        </section>
        <section class="hero-panel__training">
          <span class="hero-panel__heading">Training queue</span>
          <div data-hero="training-active"></div>
          <div class="hero-panel__training-progress"><i data-hero="training-progress"></i></div>
          <div class="hero-panel__training-queue" data-hero="training-queue"></div>
          <div class="hero-panel__training-actions">
            <button type="button" data-training-type="Strength Training">Strength</button>
            <button type="button" data-training-type="Weapon Training">Weapon</button>
            <button type="button" data-training-type="Defense Training">Defense</button>
          </div>
          <div class="hero-panel__training-outcome" data-hero="training-outcome"></div>
        </section>
        <section>
          <span class="hero-panel__heading">Personality</span>
          <div class="hero-panel__meters" data-hero="personality"></div>
        </section>
        <section>
          <span class="hero-panel__heading">Relationships</span>
          <div class="hero-panel__relationships" data-hero="relationships"></div>
        </section>
        <div class="hero-panel__potential">Potential · Undiscovered</div>
      </div>
    `;
    this.category = this.requireElement("category");
    this.detail = this.requireElement("detail");
    this.label = this.requireElement("label");
    this.heroContent = this.requireElement("hero");
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  setSelection(
    selection: SelectionDetails | null,
    hero?: Readonly<Hero>,
    heroes: readonly Readonly<Hero>[] = [],
  ): void {
    this.element.hidden = selection === null;
    const nextHeroId = selection?.category === "hero" ? selection.id : null;
    if (nextHeroId !== this.selectedHeroId) {
      this.skillForgeRenderSignature = null;
    }
    this.selectedHeroId = nextHeroId;
    if (!selection) {
      return;
    }
    this.category.textContent = selection.category;
    this.label.textContent = selection.label;
    this.detail.textContent = selection.detail ?? "";
    this.detail.hidden = !selection.detail;
    this.heroContent.hidden = !hero;
    if (hero) {
      this.renderHero(hero, heroes);
    }
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  updateHeroRuntime(hero: Readonly<Hero>, heroes: readonly Readonly<Hero>[]): void {
    const status = this.requireHeroElement("status");
    status.textContent =
      hero.movement.activity === "Walking" && hero.movement.destinationLabel
        ? `Walking → ${hero.movement.destinationLabel}`
        : hero.movement.activity;
    status.dataset.activity = hero.movement.activity.toLowerCase();
    const decision = this.requireHeroElement("decision");
    decision.textContent =
      hero.movement.decisionSource === "Need" && hero.movement.decisionReason
        ? `Need override · ${hero.movement.decisionReason}`
        : hero.movement.decisionSource === "Training"
          ? "Player-assigned training"
          : "Scheduled routine";
    decision.hidden = false;
    decision.dataset.source = hero.movement.decisionSource.toLowerCase();
    this.renderNeeds(hero);
    this.renderTraining(hero);
    this.renderRelationships(hero, heroes);
    this.renderValueGrid(this.requireHeroElement("attributes"), ATTRIBUTE_LABELS, hero.attributes);
    this.renderValueGrid(this.requireHeroElement("skills"), SKILL_LABELS, hero.skills);
    this.renderSkillForge(hero);
  }

  private renderTraining(hero: Readonly<Hero>): void {
    const active = this.requireHeroElement("training-active");
    const progress = this.requireHeroElement("training-progress");
    const queue = this.requireHeroElement("training-queue");
    const outcome = this.requireHeroElement("training-outcome");
    const assignment = hero.training.active;

    active.textContent = assignment ? assignment.type : "No active assignment";
    progress.style.setProperty("--training-progress", `${assignment?.progress ?? 0}%`);
    queue.textContent = hero.training.queue.length
      ? `Next · ${hero.training.queue.join(" · ")}`
      : "Queue empty";
    outcome.textContent = hero.training.lastOutcome ?? "Choose a focus to begin deliberate training.";

    const occupiedSlots = hero.training.queue.length + Number(assignment !== null);
    this.heroContent.querySelectorAll<HTMLButtonElement>("[data-training-type]").forEach((button) => {
      button.disabled = occupiedSlots >= 3;
    });
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const skillButton = target?.closest<HTMLButtonElement>("[data-skill-id]");
    if (skillButton && this.selectedHeroId && skillButton.dataset.skillId) {
      this.onToggleSkillLoadout(this.selectedHeroId, skillButton.dataset.skillId);
      return;
    }
    const button = target?.closest<HTMLButtonElement>("[data-training-type]");
    const type = button?.dataset.trainingType;
    if (button && this.selectedHeroId && this.isTrainingType(type)) {
      this.onQueueTraining(this.selectedHeroId, type);
    }
  };

  private renderSkillForge(hero: Readonly<Hero>): void {
    const knownSkills = Object.values(hero.skillForge.known).sort((left, right) => {
      const leftDefinition = skillDefinitionRegistry.require(left.definitionId);
      const rightDefinition = skillDefinitionRegistry.require(right.definitionId);
      return leftDefinition.category.localeCompare(rightDefinition.category) ||
        leftDefinition.name.localeCompare(rightDefinition.name);
    });
    const signature = JSON.stringify({
      active: hero.skillForge.loadout.active,
      hiddenPotentialSlots: hero.skillForge.hiddenPotentialSlots,
      known: knownSkills.map((skill) => [
        skill.definitionId,
        skill.level,
        skill.xp,
        Math.round(skill.proficiency * 1000),
        skill.mastery,
      ]),
      passive: hero.skillForge.loadout.passive,
    });
    if (signature === this.skillForgeRenderSignature) {
      return;
    }
    this.skillForgeRenderSignature = signature;
    const summary = this.requireHeroElement("skill-summary");
    summary.textContent = `Known ${knownSkills.length} · Active ${hero.skillForge.loadout.active.length}/${ACTIVE_SKILL_SLOTS} · Passive ${hero.skillForge.loadout.passive.length}/${PASSIVE_SKILL_SLOTS}`;

    const list = this.requireHeroElement("skill-forge");
    list.replaceChildren(...knownSkills.map((skill) => {
      const definition = skillDefinitionRegistry.require(skill.definitionId);
      const prepared = definition.type === "reaction" ||
        hero.skillForge.loadout.active.includes(skill.definitionId) ||
        hero.skillForge.loadout.passive.includes(skill.definitionId);
      const relevantLoadout = definition.type === "passive"
        ? hero.skillForge.loadout.passive
        : hero.skillForge.loadout.active;
      const relevantCapacity = definition.type === "passive" ? PASSIVE_SKILL_SLOTS : ACTIVE_SKILL_SLOTS;
      const xpTarget = getSkillXpToNextLevel(skill.level);
      const progress = skill.mastery ? 100 : Math.min(100, Math.round(skill.xp / xpTarget * 100));
      const card = document.createElement("article");
      card.className = "hero-skill";
      card.dataset.prepared = String(prepared);

      const header = document.createElement("div");
      header.className = "hero-skill__header";
      const name = document.createElement("strong");
      name.textContent = definition.name;
      const level = document.createElement("span");
      level.textContent = skill.mastery ? "Mastered" : `Lv ${skill.level}`;
      header.append(name, level);

      const metadata = document.createElement("small");
      metadata.textContent = `${definition.category} · ${definition.type} · ${definition.rarity}`;
      const meter = document.createElement("i");
      meter.className = "hero-skill__progress";
      meter.style.setProperty("--skill-progress", `${progress}%`);
      const details = document.createElement("small");
      details.textContent = skill.mastery
        ? `Proficiency ${Math.round(skill.proficiency * 100)}% · ${skill.source}`
        : `${skill.xp}/${xpTarget} XP · Proficiency ${Math.round(skill.proficiency * 100)}% · ${skill.source}`;
      details.title = skill.discoveryReason;
      const reason = document.createElement("small");
      reason.className = "hero-skill__reason";
      reason.textContent = skill.discoveryReason;

      const action = document.createElement("button");
      action.type = "button";
      action.dataset.skillId = skill.definitionId;
      action.textContent = definition.type === "reaction"
        ? "Automatic"
        : prepared
          ? "Prepared"
          : "Ready";
      action.disabled = definition.type === "reaction" || (!prepared && relevantLoadout.length >= relevantCapacity);
      action.title = definition.type === "reaction"
        ? "Reactions trigger automatically when their conditions are met."
        : prepared
          ? "Remove this skill from the current loadout."
          : action.disabled
            ? "This loadout is full. Remove another skill first."
            : "Prepare this skill for use.";
      card.append(header, metadata, meter, details, reason, action);
      return card;
    }));

    const potential = this.requireHeroElement("skill-potential");
    potential.replaceChildren(...Array.from({ length: hero.skillForge.hiddenPotentialSlots }, () => {
      const unknown = document.createElement("span");
      unknown.textContent = "???";
      unknown.title = "Undiscovered skill potential";
      return unknown;
    }));
  }

  private isTrainingType(value: string | undefined): value is TrainingType {
    return value !== undefined && TRAINING_TYPES.includes(value as TrainingType);
  }

  private renderHero(hero: Readonly<Hero>, heroes: readonly Readonly<Hero>[]): void {
    const identity = this.requireHeroElement("identity");
    const genderLabel = hero.appearance.gender === "female" ? "Female" : "Male";
    identity.textContent = `${genderLabel} · ${hero.origin.occupation} (${hero.origin.category}) · Age ${hero.age}`;
    const path = this.requireHeroElement("path");
    const reputation = hero.reputation.title ?? "Unproven";
    path.textContent = `Class · ${hero.heroClass}  |  Refuge role · ${hero.socialRole}  |  Reputation · ${reputation}`;
    path.title = `Origin aptitudes: ${hero.origin.aptitudes.join(", ")}`;
    this.updateHeroRuntime(hero, heroes);

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

  private renderRelationships(hero: Readonly<Hero>, heroes: readonly Readonly<Hero>[]): void {
    const relationships = this.requireHeroElement("relationships");
    relationships.replaceChildren(
      ...heroes
        .filter((other) => other.id !== hero.id)
        .sort(
          (left, right) =>
            (hero.relationships[right.id]?.metrics.affinity ?? 0) -
            (hero.relationships[left.id]?.metrics.affinity ?? 0),
        )
        .map((other) => {
          const profile = hero.relationships[other.id];
          if (!profile) {
            return document.createDocumentFragment();
          }
          const { affinity, respect, trust } = profile.metrics;
          const row = document.createElement("div");
          const name = document.createElement("span");
          const relationship = document.createElement("span");
          name.textContent = other.name;
          const label = getRelationshipLabel(profile);
          relationship.innerHTML = `<strong>${label}</strong><small>A ${affinity > 0 ? "+" : ""}${affinity} · T ${trust} · R ${respect}</small>`;
          relationship.title = `Affinity ${affinity}, Trust ${trust}, Respect ${respect}, Rivalry ${profile.metrics.rivalry}, Fear ${profile.metrics.fear}, Jealousy ${profile.metrics.jealousy}`;
          row.dataset.relationship = label.toLowerCase().replace(" ", "-");
          row.append(name, relationship);
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
