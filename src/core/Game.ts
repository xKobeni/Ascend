import { Simulation } from "../simulation/Simulation";
import { HeroPortraitCache } from "../rendering/heroes/HeroPortraitCache";
import { CombatOverlay } from "../ui/CombatOverlay";
import { ControlsHint } from "../ui/ControlsHint";
import { DebugOverlay } from "../ui/DebugOverlay";
import { ExpeditionOverlay } from "../ui/ExpeditionOverlay";
import { HeroRosterOverlay } from "../ui/HeroRosterOverlay";
import { HudShell, type HudSection } from "../ui/HudShell";
import { NotificationCenter } from "../ui/NotificationCenter";
import { SelectionOverlay } from "../ui/SelectionOverlay";
import { SquadOverlay } from "../ui/SquadOverlay";
import { EventBus } from "./EventBus";
import { GameClock } from "./GameClock";
import { Renderer, type RendererEvents } from "./Renderer";

type GameEvents = RendererEvents;
type HeroDetailTab = "Overview" | "Relations" | "Skills" | "Training";

export class Game {
  private activeHudSection: HudSection = "Refuge";
  private animationFrameId: number | null = null;
  private readonly clock = new GameClock();
  private readonly combatOverlay: CombatOverlay;
  private readonly controlsHint: ControlsHint;
  private readonly debugOverlay: DebugOverlay;
  private readonly events = new EventBus<GameEvents>();
  private readonly expeditionOverlay: ExpeditionOverlay;
  private heroDetailReturn: "Heroes" | "Refuge" = "Refuge";
  private readonly heroRosterOverlay: HeroRosterOverlay;
  private readonly hudShell: HudShell;
  private readonly notificationCenter: NotificationCenter;
  private readonly portraits = new HeroPortraitCache();
  private readonly renderer: Renderer;
  private selectedHeroId: string | null = null;
  private readonly selectionOverlay: SelectionOverlay;
  private readonly simulation = new Simulation();
  private readonly squadOverlay: SquadOverlay;
  private readonly unsubscribeEvents: Array<() => void> = [];

  constructor(private readonly container: HTMLElement) {
    const heroes = this.simulation.getHeroes();
    this.renderer = new Renderer(container, this.events, heroes);
    this.controlsHint = new ControlsHint(container);
    this.selectionOverlay = new SelectionOverlay(
      container,
      (heroId, type) => this.simulation.queueTraining(heroId, type),
      (heroId, definitionId) => this.simulation.toggleSkillLoadout(heroId, definitionId),
      (heroId, injuryId) => this.simulation.treatHeroInjury(heroId, injuryId),
      () => this.simulation.getExpeditionSnapshot().resources.medicine,
      () => this.closeHeroDetail(),
    );
    this.heroRosterOverlay = new HeroRosterOverlay(
      container,
      heroes,
      () => this.simulation.getSquad(),
      this.portraits,
      (heroId) => this.openHeroDetail(heroId, "Overview", "Heroes"),
      () => this.activateHudSection("Refuge", true),
    );
    this.squadOverlay = new SquadOverlay(
      container,
      heroes,
      () => this.simulation.getSquad(),
      () => this.simulation.getSquadEvaluation(),
      this.portraits,
      {
        addHero: (heroId) => this.simulation.addHeroToSquad(heroId),
        moveFormation: (heroId, formation) => this.simulation.moveHeroToSquadFormation(heroId, formation),
        removeHero: (heroId) => this.simulation.removeHeroFromSquad(heroId),
        rename: (name) => this.simulation.renameSquad(name),
        setRole: (heroId, role) => this.simulation.setSquadRole(heroId, role),
      },
      () => this.activateHudSection("Refuge", true),
    );
    this.expeditionOverlay = new ExpeditionOverlay(
      container,
      () => this.simulation.getExpeditionSnapshot(),
      () => this.simulation.getCombatSnapshot(),
      () => this.simulation.getSquadEvaluation().isReady,
      {
        close: () => this.activateHudSection("Refuge", true),
        deploy: () => this.simulation.startExpedition(),
        returnToRefuge: () => this.simulation.returnFromExpedition(),
      },
    );
    this.combatOverlay = new CombatOverlay(
      container,
      () => this.simulation.getCombatSnapshot(),
      () => this.simulation.getSquadEvaluation().isComplete,
      {
        exit: () => this.simulation.exitCombatSandbox(),
        start: () => this.simulation.startCombatSandbox(),
      },
    );
    this.debugOverlay = new DebugOverlay(container, {
      canStartArena: () => this.simulation.getCombatSnapshot().result === "Idle" &&
        this.simulation.getExpeditionSnapshot().phase === "Briefing" &&
        this.simulation.getSquadEvaluation().isComplete,
      onVisibilityChange: (open) => this.renderer.setUiInteractionActive(
        open || this.activeHudSection !== "Refuge" || this.selectionOverlay.isOpen(),
      ),
      startArena: () => {
        this.activateHudSection("Refuge");
        return this.simulation.startCombatSandbox();
      },
    });
    this.hudShell = new HudShell(container, (section) => this.activateHudSection(section));
    this.notificationCenter = new NotificationCenter(
      container,
      (heroId) => this.openHeroDetail(heroId, "Skills", "Refuge"),
    );

    this.unsubscribeEvents.push(
      this.events.on("contextLost", () => this.debugOverlay.setRendererStatus("lost")),
      this.events.on("contextRestored", () => this.debugOverlay.setRendererStatus("ready")),
      this.events.on("selectionChanged", (selection) => {
        if (!selection) {
          if (this.selectedHeroId && this.heroDetailReturn === "Refuge") {
            this.selectionOverlay.close();
            this.selectedHeroId = null;
            this.renderer.setUiInteractionActive(false);
          }
          return;
        }
        if (selection.category === "hero") {
          this.openHeroDetail(selection.id, "Overview", "Refuge");
          return;
        }
        this.closePlayerPanels();
        this.hudShell.setActive("Refuge");
        this.activeHudSection = "Refuge";
        this.selectionOverlay.setSelection(selection);
        this.renderer.setUiInteractionActive(true);
      }),
    );
    window.addEventListener("keydown", this.handleKeyDown);
    void this.portraits.generateAll(heroes, () => {
      this.heroRosterOverlay.refresh();
      this.squadOverlay.refresh();
    });
  }

  start(): void {
    if (this.animationFrameId !== null) {
      return;
    }
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.animationFrameId = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.unsubscribeEvents.forEach((unsubscribe) => unsubscribe());
    this.events.clear();
    this.controlsHint.dispose();
    this.combatOverlay.dispose();
    this.debugOverlay.dispose();
    this.expeditionOverlay.dispose();
    this.heroRosterOverlay.dispose();
    this.hudShell.dispose();
    this.notificationCenter.dispose();
    this.selectionOverlay.dispose();
    this.squadOverlay.dispose();
    this.portraits.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  private readonly frame = (timestampMs: number): void => {
    const clockFrame = this.clock.advance(timestampMs, (deltaSeconds) => this.simulation.step(deltaSeconds));
    const combatSnapshot = this.simulation.getCombatSnapshot();
    const expeditionSnapshot = this.simulation.getExpeditionSnapshot();
    this.container.dataset.mode = expeditionSnapshot.phase !== "Briefing"
      ? "expedition"
      : combatSnapshot.result !== "Idle"
        ? "combat"
        : "refuge";
    this.renderer.render(timestampMs / 1_000, clockFrame.frameDeltaSeconds, combatSnapshot);
    const simulationSnapshot = this.simulation.getSnapshot();
    this.hudShell.update(simulationSnapshot, expeditionSnapshot.resources);
    this.debugOverlay.update(timestampMs, simulationSnapshot, this.renderer.getCameraDiagnostics());
    this.notificationCenter.update(
      this.simulation.getHeroes(),
      this.simulation.getSocialEvents(),
      expeditionSnapshot,
    );
    this.heroRosterOverlay.update();
    this.squadOverlay.updateEvaluation();
    this.combatOverlay.update();
    this.expeditionOverlay.update();
    if (this.selectedHeroId) {
      const selectedHero = this.simulation.getHero(this.selectedHeroId);
      if (selectedHero) {
        this.selectionOverlay.updateHeroRuntime(selectedHero, this.simulation.getHeroes());
      }
    }
    this.animationFrameId = requestAnimationFrame(this.frame);
  };

  private activateHudSection(section: HudSection, restoreFocus = false): void {
    if (this.simulation.getExpeditionSnapshot().phase !== "Briefing" ||
      this.simulation.getCombatSnapshot().result !== "Idle") {
      return;
    }
    this.closePlayerPanels();
    this.activeHudSection = section;
    this.hudShell.setActive(section);
    this.renderer.setUiInteractionActive(section !== "Refuge");
    if (section === "Heroes") {
      this.heroRosterOverlay.open();
    } else if (section === "Party") {
      this.squadOverlay.open();
    } else if (section === "Rift") {
      this.expeditionOverlay.open();
    }
    if (restoreFocus) {
      this.hudShell.focus(section);
    }
  }

  private openHeroDetail(
    heroId: string,
    tab: HeroDetailTab,
    returnTo: "Heroes" | "Refuge",
  ): void {
    const hero = this.simulation.getHero(heroId);
    if (!hero || this.simulation.getExpeditionSnapshot().phase !== "Briefing" ||
      this.simulation.getCombatSnapshot().result !== "Idle") {
      return;
    }
    this.closePlayerPanels();
    this.activeHudSection = "Heroes";
    this.hudShell.setActive("Heroes");
    this.heroDetailReturn = returnTo;
    this.selectedHeroId = heroId;
    this.renderer.setUiInteractionActive(true);
    this.selectionOverlay.showHero(hero, this.simulation.getHeroes(), tab);
  }

  private closeHeroDetail(): void {
    const returnTo = this.heroDetailReturn;
    this.selectionOverlay.close();
    this.selectedHeroId = null;
    this.activateHudSection(returnTo, true);
  }

  private closePlayerPanels(): void {
    this.heroRosterOverlay.close();
    this.selectionOverlay.close();
    this.selectedHeroId = null;
    this.squadOverlay.close();
    this.expeditionOverlay.close();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Escape" ||
      (this.activeHudSection === "Refuge" && !this.selectionOverlay.isOpen())) {
      return;
    }
    event.preventDefault();
    if (this.selectedHeroId) {
      this.closeHeroDetail();
      return;
    }
    this.activateHudSection("Refuge", true);
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      this.clock.resetFrameTime();
    }
  };
}
