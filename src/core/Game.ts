import { Simulation } from "../simulation/Simulation";
import { DebugOverlay } from "../ui/DebugOverlay";
import { ControlsHint } from "../ui/ControlsHint";
import { SelectionOverlay } from "../ui/SelectionOverlay";
import { SocialLogOverlay } from "../ui/SocialLogOverlay";
import { EventBus } from "./EventBus";
import { GameClock } from "./GameClock";
import { Renderer, type RendererEvents } from "./Renderer";

type GameEvents = RendererEvents;

export class Game {
  private animationFrameId: number | null = null;
  private readonly clock = new GameClock();
  private readonly controlsHint: ControlsHint;
  private readonly debugOverlay: DebugOverlay;
  private readonly events = new EventBus<GameEvents>();
  private readonly renderer: Renderer;
  private selectedHeroId: string | null = null;
  private readonly selectionOverlay: SelectionOverlay;
  private readonly simulation = new Simulation();
  private readonly socialLogOverlay: SocialLogOverlay;
  private readonly unsubscribeEvents: Array<() => void> = [];

  constructor(private readonly container: HTMLElement) {
    this.renderer = new Renderer(container, this.events, this.simulation.getHeroes());
    this.debugOverlay = new DebugOverlay(container);
    this.controlsHint = new ControlsHint(container);
    this.selectionOverlay = new SelectionOverlay(container);
    this.socialLogOverlay = new SocialLogOverlay(container);

    this.unsubscribeEvents.push(
      this.events.on("contextLost", () => this.debugOverlay.setRendererStatus("lost")),
      this.events.on("contextRestored", () => this.debugOverlay.setRendererStatus("ready")),
      this.events.on("selectionChanged", (selection) => {
        this.selectedHeroId = selection?.category === "hero" ? selection.id : null;
        const hero = selection?.category === "hero" ? this.simulation.getHero(selection.id) : undefined;
        this.selectionOverlay.setSelection(selection, hero, this.simulation.getHeroes());
      }),
    );
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
    this.unsubscribeEvents.forEach((unsubscribe) => unsubscribe());
    this.events.clear();
    this.controlsHint.dispose();
    this.debugOverlay.dispose();
    this.selectionOverlay.dispose();
    this.socialLogOverlay.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  private readonly frame = (timestampMs: number): void => {
    const clockFrame = this.clock.advance(timestampMs, (deltaSeconds) => this.simulation.step(deltaSeconds));
    this.renderer.render(timestampMs / 1_000, clockFrame.frameDeltaSeconds);
    this.debugOverlay.update(
      timestampMs,
      this.simulation.getSnapshot(),
      this.renderer.getCameraDiagnostics(),
    );
    this.socialLogOverlay.update(this.simulation.getSocialEvents());
    if (this.selectedHeroId) {
      const selectedHero = this.simulation.getHero(this.selectedHeroId);
      if (selectedHero) {
        this.selectionOverlay.updateHeroRuntime(selectedHero, this.simulation.getHeroes());
      }
    }
    this.animationFrameId = requestAnimationFrame(this.frame);
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      this.clock.resetFrameTime();
    }
  };
}
