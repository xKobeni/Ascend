import type {
  Hero,
  HeroAttributes,
  FallenHeroRecord,
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
import { getInjuryDefinition, hasRecoveringInjury } from "../heroes/InjurySystem";
import type { EquipmentSlot, EquipmentSnapshot } from "../equipment/EquipmentSystem";

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
  private readonly memorialContent: HTMLElement;
  private selectedHeroId: string | null = null;
  private selectedTab: "Equipment" | "Overview" | "Relations" | "Skills" | "Training" = "Overview";
  private equipmentRenderSignature: string | null = null;
  private skillForgeRenderSignature: string | null = null;

  constructor(
    container: HTMLElement,
    private readonly onQueueTraining: (heroId: string, type: TrainingType) => void,
    private readonly onToggleSkillLoadout: (heroId: string, definitionId: string) => void,
    private readonly onTreatInjury: (heroId: string, injuryId: string) => void,
    private readonly getMedicine: () => number,
    private readonly onClose: () => void,
    private readonly equipment?: {
      equip(heroId: string, itemId: string): void;
      getSnapshot(): Readonly<EquipmentSnapshot>;
      unequip(heroId: string, slot: EquipmentSlot): void;
    },
  ) {
    this.element = document.createElement("aside");
    this.element.className = "system-panel hero-detail-panel selection-overlay";
    this.element.hidden = true;
    this.element.setAttribute("aria-live", "polite");
    this.element.innerHTML = `
      <header class="system-panel__header">
        <div><span class="selection-overlay__eyebrow" data-selection="category"></span><h1 data-selection="label" tabindex="-1"></h1></div>
        <button type="button" data-selection-action="close" aria-label="Close hero details">×</button>
      </header>
      <span class="selection-overlay__detail" data-selection="detail"></span>
      <nav class="hero-detail-tabs" data-selection="tabs" aria-label="Hero detail sections">
        <button type="button" data-hero-tab="Overview" aria-pressed="true">Overview</button>
        <button type="button" data-hero-tab="Skills" aria-pressed="false">Skills</button>
        <button type="button" data-hero-tab="Training" aria-pressed="false">Training</button>
        <button type="button" data-hero-tab="Equipment" aria-pressed="false">Equipment</button>
        <button type="button" data-hero-tab="Relations" aria-pressed="false">Relations</button>
      </nav>
      <div class="hero-panel" data-selection="hero" hidden>
        <div data-hero-view="Overview">
          <div class="hero-panel__identity" data-hero="identity"></div>
          <div class="hero-panel__path" data-hero="path"></div>
          <div class="hero-panel__status" data-hero="status"></div>
          <div class="hero-panel__decision" data-hero="decision" hidden></div>
          <section><span class="hero-panel__heading">Needs</span><div class="hero-panel__meters hero-panel__needs" data-hero="needs"></div></section>
          <section><span class="hero-panel__heading">Traits</span><div class="hero-panel__traits" data-hero="traits"></div></section>
          <section><span class="hero-panel__heading">Core attributes</span><div class="hero-panel__grid" data-hero="attributes"></div></section>
          <section><span class="hero-panel__heading">Personality</span><div class="hero-panel__meters" data-hero="personality"></div></section>
          <div class="hero-panel__potential">Potential · Undiscovered</div>
        </div>
        <div data-hero-view="Skills" hidden>
          <section><span class="hero-panel__heading">Current disciplines</span><div class="hero-panel__grid" data-hero="skills"></div></section>
          <section class="hero-panel__skill-forge"><span class="hero-panel__heading">Known skills</span><div class="hero-panel__skill-summary" data-hero="skill-summary"></div><div class="hero-panel__skill-list" data-hero="skill-forge"></div><div class="hero-panel__skill-potential" data-hero="skill-potential"></div></section>
        </div>
        <div data-hero-view="Training" hidden>
          <section class="hero-panel__recovery">
            <div class="hero-panel__recovery-heading"><span class="hero-panel__heading">Recovery & treatment</span><small><b data-hero="medicine">0</b> Medicine</small></div>
            <div class="hero-panel__injuries" data-hero="injuries"></div>
            <div class="hero-panel__recovery-outcome" data-hero="recovery-outcome"></div>
          </section>
          <section class="hero-panel__training"><span class="hero-panel__heading">Training queue</span><div data-hero="training-active"></div><div class="hero-panel__training-progress"><i data-hero="training-progress"></i></div><div class="hero-panel__training-queue" data-hero="training-queue"></div><div class="hero-panel__training-actions"><button type="button" data-training-type="Strength Training">Strength</button><button type="button" data-training-type="Weapon Training">Weapon</button><button type="button" data-training-type="Defense Training">Defense</button></div><div class="hero-panel__training-outcome" data-hero="training-outcome"></div></section>
        </div>
        <div data-hero-view="Equipment" hidden>
          <section class="hero-equipment"><span class="hero-panel__heading">Equipped</span><div data-hero="equipment-slots"></div></section>
          <section class="hero-inventory"><span class="hero-panel__heading">Refuge inventory</span><div data-hero="equipment-inventory"></div></section>
        </div>
        <div data-hero-view="Relations" hidden>
          <section><span class="hero-panel__heading">Relationships</span><div class="hero-panel__relationships" data-hero="relationships"></div></section>
          <section><span class="hero-panel__heading">Memories</span><div class="hero-panel__memories" data-hero="memories"></div></section>
        </div>
      </div>
      <div class="memorial-record" data-selection="memorial" hidden></div>
    `;
    this.category = this.requireElement("category");
    this.detail = this.requireElement("detail");
    this.label = this.requireElement("label");
    this.heroContent = this.requireElement("hero");
    this.memorialContent = this.requireElement("memorial");
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
      this.equipmentRenderSignature = null;
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
    this.memorialContent.hidden = true;
    const tabs = this.requireElement("tabs");
    tabs.hidden = !hero;
    if (hero) {
      this.renderHero(hero, heroes);
      this.applySelectedTab();
    }
  }

  showHero(hero: Readonly<Hero>, heroes: readonly Readonly<Hero>[], tab: typeof this.selectedTab = "Overview"): void {
    this.selectedTab = tab;
    this.setSelection({
      category: "hero",
      detail: `Level ${hero.level} · Rank ${"★".repeat(hero.rank)}`,
      id: hero.id,
      label: hero.name,
    }, hero, heroes);
  }

  showMemorial(record: Readonly<FallenHeroRecord>): void {
    this.setSelection({
      category: "memorial",
      detail: `Day ${record.joinedDay} — Day ${record.diedDay}`,
      id: record.heroId,
      label: record.name,
    });
    this.memorialContent.hidden = false;
    this.memorialContent.innerHTML = `
      <span class="memorial-record__mark" aria-hidden="true">◇</span>
      <p>${this.escape(record.occupation)} · Level ${record.level}</p>
      <dl>
        <div><dt>Rank</dt><dd>${"★".repeat(record.rank)}</dd></div>
        <div><dt>Days alive</dt><dd>${record.daysAlive}</dd></div>
        <div><dt>Missions</dt><dd>${record.expeditions}</dd></div>
        <div><dt>Victories</dt><dd>${record.victories}</dd></div>
        <div><dt>Kills</dt><dd>${record.kills}</dd></div>
        <div><dt>Final party</dt><dd>${this.escape(record.finalSquadName)}</dd></div>
      </dl>
      <section><span class="hero-panel__heading">Cause of death</span><strong>${this.escape(record.causeOfDeath)}</strong></section>
    `;
  }

  close(): void {
    this.setSelection(null);
  }

  isOpen(): boolean {
    return !this.element.hidden;
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  updateHeroRuntime(hero: Readonly<Hero>, heroes: readonly Readonly<Hero>[]): void {
    const status = this.requireHeroElement("status");
    const activity =
      hero.movement.activity === "Walking" && hero.movement.destinationLabel
        ? `Walking → ${hero.movement.destinationLabel}`
        : hero.movement.activity;
    const injury = hero.injuries.find((candidate) => !candidate.permanent) ?? hero.injuries[0];
    status.textContent = injury ? `${activity} · ${injury.type}` : activity;
    status.dataset.activity = hero.movement.activity.toLowerCase();
    status.dataset.injured = String(Boolean(injury));
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
    this.renderRecovery(hero);
    this.renderTraining(hero);
    this.renderRelationships(hero, heroes);
    this.renderMemories(hero);
    this.renderValueGrid(this.requireHeroElement("attributes"), ATTRIBUTE_LABELS, hero.attributes);
    this.renderValueGrid(this.requireHeroElement("skills"), SKILL_LABELS, hero.skills);
    this.renderSkillForge(hero);
    this.renderEquipment(hero);
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
      button.disabled = occupiedSlots >= 3 || hasRecoveringInjury(hero);
      button.title = hasRecoveringInjury(hero)
        ? "Recovery must finish before deliberate training can resume."
        : occupiedSlots >= 3
          ? "Training queue is full."
          : "Add this assignment to the training queue.";
    });
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const tab = target?.closest<HTMLButtonElement>("[data-hero-tab]")?.dataset.heroTab;
    if (this.isHeroTab(tab)) {
      this.selectedTab = tab;
      this.applySelectedTab();
      return;
    }
    if (target?.closest("[data-selection-action='close']")) {
      this.onClose();
      return;
    }
    const skillButton = target?.closest<HTMLButtonElement>("[data-skill-id]");
    if (skillButton && this.selectedHeroId && skillButton.dataset.skillId) {
      this.onToggleSkillLoadout(this.selectedHeroId, skillButton.dataset.skillId);
      return;
    }
    const treatmentButton = target?.closest<HTMLButtonElement>("[data-injury-id]");
    if (treatmentButton && this.selectedHeroId && treatmentButton.dataset.injuryId) {
      this.onTreatInjury(this.selectedHeroId, treatmentButton.dataset.injuryId);
      return;
    }
    const equipmentButton = target?.closest<HTMLButtonElement>("[data-equipment-id]");
    if (equipmentButton && this.selectedHeroId && equipmentButton.dataset.equipmentId && this.equipment) {
      this.equipment.equip(this.selectedHeroId, equipmentButton.dataset.equipmentId);
      this.equipmentRenderSignature = null;
      return;
    }
    const unequipButton = target?.closest<HTMLButtonElement>("[data-unequip-slot]");
    if (unequipButton && this.selectedHeroId && this.isEquipmentSlot(unequipButton.dataset.unequipSlot) && this.equipment) {
      this.equipment.unequip(this.selectedHeroId, unequipButton.dataset.unequipSlot);
      this.equipmentRenderSignature = null;
      return;
    }
    const button = target?.closest<HTMLButtonElement>("[data-training-type]");
    const type = button?.dataset.trainingType;
    if (button && this.selectedHeroId && this.isTrainingType(type)) {
      this.onQueueTraining(this.selectedHeroId, type);
    }
  };

  private applySelectedTab(): void {
    this.heroContent.querySelectorAll<HTMLElement>("[data-hero-view]").forEach((view) => {
      view.hidden = view.dataset.heroView !== this.selectedTab;
    });
    this.element.querySelectorAll<HTMLButtonElement>("[data-hero-tab]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.heroTab === this.selectedTab));
    });
  }

  private isHeroTab(value: string | undefined): value is typeof this.selectedTab {
    return value !== undefined && ["Overview", "Skills", "Training", "Equipment", "Relations"].includes(value);
  }

  private isEquipmentSlot(value: string | undefined): value is EquipmentSlot {
    return value === "mainHand" || value === "offHand";
  }

  private renderEquipment(hero: Readonly<Hero>): void {
    const slots = this.requireHeroElement("equipment-slots");
    const inventory = this.requireHeroElement("equipment-inventory");
    const snapshot = this.equipment?.getSnapshot();
    if (!snapshot) {
      slots.textContent = "Equipment unavailable.";
      inventory.replaceChildren();
      return;
    }
    const loadout = snapshot.loadouts.find((entry) => entry.heroId === hero.id);
    const signature = JSON.stringify({ heroId: hero.id, revision: snapshot.revision });
    if (signature === this.equipmentRenderSignature) return;
    this.equipmentRenderSignature = signature;
    const equippedByItem = new Map<string, string>();
    snapshot.loadouts.forEach((entry) => {
      [entry.mainHand, entry.offHand].forEach((itemId) => {
        if (itemId) equippedByItem.set(itemId, entry.heroId);
      });
    });
    slots.replaceChildren(...(["mainHand", "offHand"] as const).map((slot) => {
      const itemId = loadout?.[slot] ?? null;
      const item = snapshot.items.find((entry) => entry.id === itemId);
      const row = document.createElement("article");
      row.className = "hero-equipment__slot";
      row.innerHTML = `<span>${slot === "mainHand" ? "MAIN HAND" : "OFF HAND"}</span><strong>${this.escape(item?.name ?? "Empty")}</strong>${item ? `<small>${this.formatEquipmentStats(item.stats)} · ${item.durability}% condition</small><button type="button" data-unequip-slot="${slot}">Unequip</button>` : ""}`;
      return row;
    }));
    inventory.replaceChildren(...snapshot.items.map((item) => {
      const ownerId = equippedByItem.get(item.id);
      const owner = ownerId ? (ownerId === hero.id ? "Equipped" : `With ${this.escape("another hero")}`) : "Available";
      const card = document.createElement("article");
      card.className = "hero-inventory__item";
      card.dataset.rarity = item.rarity;
      card.innerHTML = `<div><span>${item.type} · ${item.rarity}</span><strong>${this.escape(item.name)}</strong><small>${this.escape(item.description)}</small></div><div><b>${this.formatEquipmentStats(item.stats)}</b><small>${item.durability}% condition · ${owner}</small><button type="button" data-equipment-id="${item.id}" ${ownerId === hero.id ? "disabled" : ""}>${ownerId ? "Transfer" : "Equip"}</button></div>`;
      return card;
    }));
  }

  private formatEquipmentStats(stats: Readonly<{ damage: number; defense: number; range: number }>): string {
    return [stats.damage ? `Damage +${stats.damage}` : "", stats.defense ? `Defense +${stats.defense}` : "", stats.range ? `Range +${stats.range.toFixed(1)}` : ""]
      .filter(Boolean).join(" · ");
  }

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
        const record = hero.traitHistory.find((entry) => entry.name === trait);
        const item = document.createElement("article");
        item.className = "hero-trait";
        item.dataset.source = record?.source ?? "Generated";
        const name = document.createElement("strong");
        name.textContent = trait;
        const source = document.createElement("span");
        source.textContent = record?.source === "Earned"
          ? `Earned · Day ${record.acquiredDay}`
          : "Starting trait";
        const reason = document.createElement("small");
        reason.textContent = record?.reason ?? "Part of this hero's starting temperament.";
        item.append(name, source, reason);
        return item;
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

  private renderMemories(hero: Readonly<Hero>): void {
    const container = this.requireHeroElement("memories");
    if (hero.memories.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hero-panel__memory-empty";
      empty.textContent = "No defining memories recorded yet.";
      container.replaceChildren(empty);
      return;
    }
    container.replaceChildren(...hero.memories.map((memory) => {
      const row = document.createElement("article");
      row.className = "hero-memory";
      row.dataset.persistent = String(memory.persistent);
      const heading = document.createElement("div");
      const type = document.createElement("strong");
      const state = document.createElement("span");
      type.textContent = this.getMemoryLabel(memory.type);
      state.textContent = memory.persistent ? "Lasting" : `${Math.round(memory.weight)}% influence`;
      heading.append(type, state);
      const summary = document.createElement("p");
      summary.textContent = memory.summary;
      const time = document.createElement("small");
      time.textContent = memory.lastReinforcedDay === memory.createdDay
        ? `Formed on Day ${memory.createdDay}`
        : `Formed Day ${memory.createdDay} · Reinforced Day ${memory.lastReinforcedDay}`;
      row.append(heading, summary, time);
      return row;
    }));
  }

  private getMemoryLabel(type: Hero["memories"][number]["type"]): string {
    if (type === "ALLY_DIED") return "Ally Lost";
    if (type === "CRITICAL_INJURY") return "Critical Injury";
    if (type === "SAVED_ALLY") return "Saved an Ally";
    if (type === "WAS_SAVED") return "Was Saved";
    return "Guardian Defeated";
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

  private renderRecovery(hero: Readonly<Hero>): void {
    const medicine = this.getMedicine();
    this.requireHeroElement("medicine").textContent = String(medicine);
    this.requireHeroElement("recovery-outcome").textContent =
      hero.recovery.lastOutcome ?? "Untreated injuries recover slowly while resting in the infirmary.";
    const container = this.requireHeroElement("injuries");
    if (hero.injuries.length === 0) {
      container.innerHTML = '<p class="hero-panel__recovery-clear">No active injuries.</p>';
      return;
    }
    container.replaceChildren(...hero.injuries.map((injury) => {
      const definition = getInjuryDefinition(injury.type);
      const card = document.createElement("article");
      card.className = "hero-injury";
      card.dataset.severity = injury.severity.toLowerCase();
      const heading = document.createElement("div");
      const title = document.createElement("strong");
      const state = document.createElement("span");
      title.textContent = injury.type;
      state.textContent = injury.permanent ? "Permanent" : injury.treated ? "Treated" : "Untreated";
      heading.append(title, state);
      const detail = document.createElement("p");
      detail.textContent = definition.description;
      const recovery = document.createElement("div");
      recovery.className = "hero-injury__recovery";
      const time = document.createElement("small");
      const remaining = injury.remainingMinutes === null ? null : Math.ceil(injury.remainingMinutes / 60);
      time.textContent = injury.permanent
        ? `Lasting effect · ${injury.source} · Day ${injury.acquiredDay}`
        : `${remaining}h resting recovery · ${injury.source} · Day ${injury.acquiredDay}`;
      const meter = document.createElement("i");
      const progress = injury.remainingMinutes === null || injury.totalRecoveryMinutes === null
        ? 100
        : Math.round((1 - injury.remainingMinutes / injury.totalRecoveryMinutes) * 100);
      meter.style.setProperty("--recovery-progress", `${progress}%`);
      recovery.append(time, meter);
      const action = document.createElement("button");
      action.type = "button";
      action.dataset.injuryId = injury.id;
      action.disabled = injury.treated || medicine < definition.treatmentCost;
      action.textContent = injury.treated ? "Treated" : `Treat · ${definition.treatmentCost} Medicine`;
      action.title = injury.treated
        ? "Treatment has already been applied."
        : medicine < definition.treatmentCost
          ? "The refuge does not have enough Medicine."
          : "Consume Medicine and accelerate resting recovery.";
      card.append(heading, detail, recovery, action);
      return card;
    }));
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

  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
