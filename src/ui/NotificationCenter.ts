import type { ExpeditionSnapshot } from "../expeditions/Expedition";
import type { Hero } from "../heroes/Hero";
import type { SocialEvent } from "../heroes/RelationshipSystem";
import { skillDefinitionRegistry } from "../skills/SkillDefinitionRegistry";

interface NotificationEntry {
  expiresAt: number;
  id: number;
  message: string;
  tone: "danger" | "neutral" | "success";
}

export class NotificationCenter {
  private readonly discovery: HTMLElement;
  private discoveryHeroId: string | null = null;
  private readonly element: HTMLElement;
  private initialized = false;
  private lastExpeditionPhase: ExpeditionSnapshot["phase"] = "Briefing";
  private latestSocialEventId = 0;
  private readonly list: HTMLOListElement;
  private nextId = 1;
  private readonly notifications: NotificationEntry[] = [];
  private readonly skillLevels = new Map<string, number>();
  private readonly trainingOutcomes = new Map<string, string | null>();

  constructor(
    container: HTMLElement,
    private readonly onInspectHero: (heroId: string) => void,
  ) {
    this.element = document.createElement("aside");
    this.element.className = "notification-center";
    this.element.setAttribute("aria-label", "System messages");
    this.element.innerHTML = `<ol class="notification-feed" aria-live="polite"></ol>`;
    this.discovery = document.createElement("section");
    this.discovery.className = "discovery-notice";
    this.discovery.hidden = true;
    this.discovery.setAttribute("aria-live", "polite");
    const list = this.element.querySelector<HTMLOListElement>("ol");
    if (!list) {
      throw new Error("Notification feed is missing.");
    }
    this.list = list;
    this.element.addEventListener("click", this.handleClick);
    this.discovery.addEventListener("click", this.handleClick);
    container.append(this.element, this.discovery);
  }

  update(
    heroes: readonly Readonly<Hero>[],
    socialEvents: readonly Readonly<SocialEvent>[],
    expedition: Readonly<ExpeditionSnapshot>,
  ): void {
    if (!this.initialized) {
      this.initialize(heroes, socialEvents, expedition);
      return;
    }
    this.captureSocialEvents(socialEvents);
    this.captureHeroChanges(heroes);
    this.captureExpeditionChange(expedition);
    const now = performance.now();
    const before = this.notifications.length;
    this.notifications.splice(0, this.notifications.length, ...this.notifications.filter((entry) => entry.expiresAt > now));
    if (before !== this.notifications.length) {
      this.renderFeed();
    }
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.discovery.removeEventListener("click", this.handleClick);
    this.element.remove();
    this.discovery.remove();
  }

  private initialize(
    heroes: readonly Readonly<Hero>[],
    socialEvents: readonly Readonly<SocialEvent>[],
    expedition: Readonly<ExpeditionSnapshot>,
  ): void {
    heroes.forEach((hero) => {
      this.trainingOutcomes.set(hero.id, hero.training.lastOutcome);
      Object.values(hero.skillForge.known).forEach((skill) => {
        this.skillLevels.set(`${hero.id}:${skill.definitionId}`, skill.level);
      });
    });
    this.latestSocialEventId = socialEvents[0]?.id ?? 0;
    this.lastExpeditionPhase = expedition.phase;
    this.initialized = true;
  }

  private captureSocialEvents(events: readonly Readonly<SocialEvent>[]): void {
    const fresh = events.filter((event) => event.id > this.latestSocialEventId).reverse();
    fresh.forEach((event) => this.push(event.message, event.type === "argument" ? "danger" : "neutral"));
    this.latestSocialEventId = Math.max(this.latestSocialEventId, events[0]?.id ?? 0);
  }

  private captureHeroChanges(heroes: readonly Readonly<Hero>[]): void {
    heroes.forEach((hero) => {
      const previousOutcome = this.trainingOutcomes.get(hero.id) ?? null;
      if (hero.training.lastOutcome && hero.training.lastOutcome !== previousOutcome) {
        this.push(`${hero.name} · ${hero.training.lastOutcome}`, "success");
      }
      this.trainingOutcomes.set(hero.id, hero.training.lastOutcome);
      Object.values(hero.skillForge.known).forEach((skill) => {
        const key = `${hero.id}:${skill.definitionId}`;
        const previousLevel = this.skillLevels.get(key);
        if (previousLevel === undefined) {
          this.showDiscovery(hero, skill.definitionId);
        } else if (skill.level > previousLevel) {
          const name = skillDefinitionRegistry.require(skill.definitionId).name;
          this.push(`${hero.name} · ${name} ${previousLevel} → ${skill.level}`, "success");
        }
        this.skillLevels.set(key, skill.level);
      });
    });
  }

  private captureExpeditionChange(expedition: Readonly<ExpeditionSnapshot>): void {
    if (expedition.phase === this.lastExpeditionPhase) {
      return;
    }
    if (expedition.phase === "Combat") {
      this.push(`${expedition.deployedSquadName ?? "Party"} entered the Rift.`, "neutral");
    } else if (expedition.phase === "Debrief" && expedition.report) {
      this.push(
        expedition.report.outcome === "Victory" ? "Rift route secured." : "The party returned under pressure.",
        expedition.report.outcome === "Victory" ? "success" : "danger",
      );
    } else if (expedition.phase === "Briefing") {
      this.push("The party has returned to the refuge.", "neutral");
    }
    this.lastExpeditionPhase = expedition.phase;
  }

  private showDiscovery(hero: Readonly<Hero>, definitionId: string): void {
    const definition = skillDefinitionRegistry.require(definitionId);
    this.discoveryHeroId = hero.id;
    this.discovery.hidden = false;
    this.discovery.innerHTML = `
      <span>SKILL DISCOVERED</span>
      <strong>${this.escape(definition.name)}</strong>
      <p>${this.escape(hero.name)} developed a new ${definition.type} skill.</p>
      <div><button type="button" data-notification-action="view">View record</button><button type="button" data-notification-action="dismiss" aria-label="Dismiss skill discovery">×</button></div>
    `;
  }

  private push(message: string, tone: NotificationEntry["tone"]): void {
    this.notifications.unshift({
      expiresAt: performance.now() + 9_000,
      id: this.nextId,
      message,
      tone,
    });
    this.nextId += 1;
    this.notifications.splice(4);
    this.renderFeed();
  }

  private renderFeed(): void {
    this.list.replaceChildren(...this.notifications.map((entry) => {
      const item = document.createElement("li");
      item.dataset.tone = entry.tone;
      item.textContent = entry.message;
      return item;
    }));
    this.element.hidden = this.notifications.length === 0;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const action = (event.target as Element | null)?.closest<HTMLButtonElement>("button")?.dataset.notificationAction;
    if (action === "view" && this.discoveryHeroId) {
      const heroId = this.discoveryHeroId;
      this.dismissDiscovery();
      this.onInspectHero(heroId);
    } else if (action === "dismiss") {
      this.dismissDiscovery();
    }
  };

  private dismissDiscovery(): void {
    this.discoveryHeroId = null;
    this.discovery.hidden = true;
    this.discovery.replaceChildren();
  }

  private escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
