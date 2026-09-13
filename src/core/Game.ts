import { Simulation } from "../simulation/Simulation";
import { HeroPortraitCache } from "../rendering/heroes/HeroPortraitCache";
import { CombatOverlay } from "../ui/CombatOverlay";
import { ControlsHint } from "../ui/ControlsHint";
import { DebugOverlay } from "../ui/DebugOverlay";
import { ExpeditionOverlay } from "../ui/ExpeditionOverlay";
import { HeroRosterOverlay } from "../ui/HeroRosterOverlay";
import { HudShell, type HudSection } from "../ui/HudShell";
import { NotificationCenter } from "../ui/NotificationCenter";
import { RecruitmentOverlay } from "../ui/RecruitmentOverlay";
import { SelectionOverlay } from "../ui/SelectionOverlay";
import { SquadOverlay } from "../ui/SquadOverlay";
import { RefugeBuildOverlay } from "../ui/RefugeBuildOverlay";
import { SmithyOverlay } from "../ui/SmithyOverlay";
import {
  CameraSettingsOverlay,
  loadCameraControlScheme,
  saveCameraControlScheme,
} from "../ui/CameraSettingsOverlay";
import type { CameraControlScheme } from "../rendering/CameraController";
import type {
  PlacementValidation,
  RefugeLayoutTool,
  RefugeStructureId,
} from "../refuge/RefugeLayoutSystem";
import type { FacilityRecipeId } from "../refuge/ConstructionSystem";
import { EventBus } from "./EventBus";
import { GameClock } from "./GameClock";
import { Renderer, type RendererEvents } from "./Renderer";

type GameEvents = RendererEvents;
type HeroDetailTab = "Class" | "Equipment" | "Overview" | "Relations" | "Skills" | "Training";

interface RefugeBuildDraft {
  facilityId: RefugeStructureId;
  rotation: number;
  validation: PlacementValidation;
}

interface RefugeEnvironmentDraft {
  environmentId: string;
  validation: PlacementValidation;
}

interface ConstructionDraft {
  recipeId: FacilityRecipeId;
  rotation: number;
  validation: PlacementValidation;
}

export class Game {
  private activeHudSection: HudSection = "Refuge";
  private animationFrameId: number | null = null;
  private buildDraft: RefugeBuildDraft | null = null;
  private buildEnvironmentDraft: RefugeEnvironmentDraft | null = null;
  private constructionDraft: ConstructionDraft | null = null;
  private buildModeActive = false;
  private buildTool: RefugeLayoutTool | null = null;
  private readonly buildOverlay: RefugeBuildOverlay;
  private cameraControlScheme: CameraControlScheme;
  private readonly cameraSettingsOverlay: CameraSettingsOverlay;
  private readonly clock = new GameClock();
  private readonly combatOverlay: CombatOverlay;
  private readonly controlsHint: ControlsHint;
  private readonly debugOverlay: DebugOverlay;
  private debugOverlayOpen = false;
  private readonly events = new EventBus<GameEvents>();
  private readonly expeditionOverlay: ExpeditionOverlay;
  private heroDetailReturn: "Heroes" | "Refuge" = "Refuge";
  private readonly heroRosterOverlay: HeroRosterOverlay;
  private readonly hudShell: HudShell;
  private readonly notificationCenter: NotificationCenter;
  private lastBuildConstructionRevision = -1;
  private readonly portraits = new HeroPortraitCache();
  private readonly renderer: Renderer;
  private readonly recruitmentOverlay: RecruitmentOverlay;
  private selectedHeroId: string | null = null;
  private readonly selectionOverlay: SelectionOverlay;
  private readonly simulation = new Simulation();
  private readonly squadOverlay: SquadOverlay;
  private readonly smithyOverlay: SmithyOverlay;
  private readonly unsubscribeEvents: Array<() => void> = [];

  constructor(private readonly container: HTMLElement) {
    const heroes = this.simulation.getHeroes();
    this.renderer = new Renderer(
      container, this.events, heroes, this.simulation.getRefugeLayout(), this.simulation.getConstructionSnapshot(),
      this.simulation.getEquipmentSnapshot(),
    );
    this.cameraControlScheme = loadCameraControlScheme();
    this.renderer.setCameraControlScheme(this.cameraControlScheme);
    this.controlsHint = new ControlsHint(container, this.cameraControlScheme);
    this.cameraSettingsOverlay = new CameraSettingsOverlay(container, this.cameraControlScheme, {
      close: () => this.closeCameraSettings(true),
      select: (scheme) => this.selectCameraControlScheme(scheme),
    });
    this.selectionOverlay = new SelectionOverlay(
      container,
      (heroId, type) => this.simulation.queueTraining(heroId, type),
      (heroId, definitionId) => this.simulation.toggleSkillLoadout(heroId, definitionId),
      (heroId, injuryId) => this.simulation.treatHeroInjury(heroId, injuryId),
      () => this.simulation.getExpeditionSnapshot().resources.medicine,
      () => this.closeHeroDetail(),
      {
        equip: (heroId, itemId) => { this.simulation.equipItem(heroId, itemId); },
        getSnapshot: () => this.simulation.getEquipmentSnapshot(),
        unequip: (heroId, slot) => { this.simulation.unequipItem(heroId, slot); },
      },
      {
        getOptions: (heroId) => this.simulation.getHeroClassOptions(heroId),
        select: (heroId, heroClass) => { this.simulation.selectHeroClass(heroId, heroClass); },
      },
    );
    this.recruitmentOverlay = new RecruitmentOverlay(
      container,
      this.portraits,
      () => this.activateHudSection("Heroes", true),
    );
    this.heroRosterOverlay = new HeroRosterOverlay(
      container,
      () => this.simulation.getHeroes(),
      () => this.simulation.getFallenHeroes(),
      () => this.simulation.getSquad(),
      () => this.simulation.getExpeditionSnapshot().resources.riftShards,
      () => this.simulation.getExpeditionSnapshot().resources.scrap,
      () => this.simulation.getRecruitmentCost(),
      () => this.simulation.getDormitorySnapshot(),
      this.portraits,
      (heroId) => this.openHeroDetail(heroId, "Overview", "Heroes"),
      (heroId) => this.openMemorial(heroId, "Heroes"),
      () => this.openRecruitment(),
      () => this.simulation.upgradeDormitory(),
      () => this.activateHudSection("Refuge", true),
    );
    this.squadOverlay = new SquadOverlay(
      container,
      () => this.simulation.getHeroes(),
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
      onVisibilityChange: (open) => {
        this.debugOverlayOpen = open;
        this.syncRendererInteractionState();
      },
      startArena: () => {
        this.activateHudSection("Refuge");
        return this.simulation.startCombatSandbox();
      },
    });
    this.hudShell = new HudShell(
      container,
      (section) => this.activateHudSection(section),
      () => this.openCameraSettings(),
    );
    this.notificationCenter = new NotificationCenter(
      container,
      (heroId) => this.openHeroDetail(heroId, "Skills", "Refuge"),
    );
    this.smithyOverlay = new SmithyOverlay(container, {
      close: () => this.closeSmithy(true),
      craft: (recipeId) => {
        this.simulation.startCrafting(recipeId);
        this.refreshSmithyUi();
      },
      repair: (itemId) => {
        this.simulation.startEquipmentRepair(itemId);
        this.refreshSmithyUi();
      },
    });
    this.buildOverlay = new RefugeBuildOverlay(container, {
      cancel: () => this.cancelBuildDraft(),
      confirm: () => this.confirmBuildDraft(),
      enter: () => this.enterBuildMode(),
      exit: () => this.exitBuildMode(true),
      nudge: (dx, dz) => this.nudgeBuildDraft(dx, dz),
      openSmithy: () => {
        this.exitBuildMode(false);
        this.openSmithy();
      },
      pan: (dx, dz) => this.renderer.panCamera(dx * 3, dz * 3),
      rotate: () => this.rotateBuildDraft(),
      removeEnvironment: () => this.removeBuildEnvironment(),
      selectTool: (tool) => this.selectBuildTool(tool),
      selectRecipe: (recipeId) => this.selectConstructionRecipe(recipeId),
      toggleBuilder: (siteId, heroId) => {
        this.simulation.toggleConstructionBuilder(siteId, heroId);
        this.refreshBuildUi();
      },
      store: () => this.storeBuildFacility(),
      undo: () => {
        this.simulation.undoRefugeLayout();
        this.refreshBuildUi();
      },
    });
    this.refreshBuildUi();

    this.unsubscribeEvents.push(
      this.events.on("contextLost", () => this.debugOverlay.setRendererStatus("lost")),
      this.events.on("contextRestored", () => this.debugOverlay.setRendererStatus("ready")),
      this.events.on("buildGroundHovered", (point) => this.updateBuildPointer(point.x, point.z, false)),
      this.events.on("buildGroundActivated", (point) => this.updateBuildPointer(point.x, point.z, true)),
      this.events.on("selectionChanged", (selection) => {
        if (this.buildModeActive) {
          if (!selection) return;
          const structure = this.simulation.getRefugeLayout().facilities.find((entry) => entry.id === selection.id);
          if (structure) {
            this.selectBuildTool(structure.id);
            return;
          }
          const environment = [...this.simulation.getRefugeLayout().trees, ...this.simulation.getRefugeLayout().rocks]
            .find((entry) => entry.id === selection.id && entry.placed);
          if (environment) {
            this.buildTool = null;
            this.buildDraft = null;
            this.buildEnvironmentDraft = {
              environmentId: environment.id,
              validation: this.simulation.validateRefugeEnvironment(environment.id, environment.x, environment.z),
            };
            this.refreshBuildUi();
          }
          return;
        }
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
        if (selection.category === "memorial") {
          this.openMemorial(selection.id, "Refuge");
          return;
        }
        if (selection.category === "base" && selection.id === "dimensional-gate") {
          this.activateHudSection("Heroes");
          return;
        }
        if (selection.category === "facility" && selection.id === "dormitory") {
          this.activateHudSection("Heroes");
          return;
        }
        const construction = this.simulation.getConstructionSnapshot().sites.find((site) => site.id === selection.id);
        if (construction?.recipeId === "smithy" && construction.state === "Complete") {
          this.openSmithy();
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
    this.cameraSettingsOverlay.dispose();
    this.buildOverlay.dispose();
    this.combatOverlay.dispose();
    this.debugOverlay.dispose();
    this.expeditionOverlay.dispose();
    this.heroRosterOverlay.dispose();
    this.hudShell.dispose();
    this.notificationCenter.dispose();
    this.recruitmentOverlay.dispose();
    this.selectionOverlay.dispose();
    this.smithyOverlay.dispose();
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
    const heroes = this.simulation.getHeroes();
    const fallenHeroes = this.simulation.getFallenHeroes();
    this.renderer.render(
      timestampMs / 1_000,
      clockFrame.frameDeltaSeconds,
      combatSnapshot,
      heroes,
      fallenHeroes,
      this.simulation.getRefugeLayout(),
      this.simulation.getConstructionSnapshot(),
      this.simulation.getEquipmentSnapshot(),
    );
    const simulationSnapshot = this.simulation.getSnapshot();
    this.hudShell.update(
      simulationSnapshot,
      expeditionSnapshot.resources,
      this.simulation.getDormitorySnapshot(),
      this.simulation.getResourceEconomySnapshot(),
    );
    this.debugOverlay.update(timestampMs, simulationSnapshot, this.renderer.getCameraDiagnostics());
    this.notificationCenter.update(
      heroes,
      this.simulation.getSocialEvents(),
      expeditionSnapshot,
      fallenHeroes,
      this.simulation.getResourceEconomySnapshot(),
      this.simulation.getCraftingSnapshot(),
    );
    this.heroRosterOverlay.update();
    this.squadOverlay.updateEvaluation();
    this.combatOverlay.update();
    this.expeditionOverlay.update();
    this.refreshSmithyUi();
    const constructionRevision = this.simulation.getConstructionSnapshot().revision;
    if (this.buildModeActive && constructionRevision !== this.lastBuildConstructionRevision) {
      this.refreshBuildUi();
    }
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
    if (this.buildModeActive) {
      this.exitBuildMode(false);
    }
    this.closePlayerPanels();
    this.activeHudSection = section;
    this.hudShell.setActive(section);
    this.renderer.setUiInteractionActive(section !== "Refuge");
    this.buildOverlay.setAvailable(section === "Refuge");
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
    this.buildOverlay.setAvailable(false);
    this.selectionOverlay.showHero(hero, this.simulation.getHeroes(), tab);
  }

  private openRecruitment(): void {
    const result = this.simulation.recruitHero();
    if (!result) {
      return;
    }
    this.closePlayerPanels();
    this.activeHudSection = "Heroes";
    this.hudShell.setActive("Heroes");
    this.renderer.setUiInteractionActive(true);
    this.buildOverlay.setAvailable(false);
    this.recruitmentOverlay.open(result);
    void this.portraits.generateAll([result.hero], () => {
      this.recruitmentOverlay.refresh();
      this.heroRosterOverlay.refresh();
      this.squadOverlay.refresh();
    });
  }

  private closeHeroDetail(): void {
    const returnTo = this.heroDetailReturn;
    this.selectionOverlay.close();
    this.selectedHeroId = null;
    this.activateHudSection(returnTo, true);
  }

  private openMemorial(heroId: string, returnTo: "Heroes" | "Refuge"): void {
    const record = this.simulation.getFallenHero(heroId);
    if (!record || this.simulation.getExpeditionSnapshot().phase !== "Briefing" ||
      this.simulation.getCombatSnapshot().result !== "Idle") {
      return;
    }
    this.closePlayerPanels();
    this.activeHudSection = "Heroes";
    this.hudShell.setActive("Heroes");
    this.heroDetailReturn = returnTo;
    this.selectedHeroId = null;
    this.renderer.setUiInteractionActive(true);
    this.buildOverlay.setAvailable(false);
    this.selectionOverlay.showMemorial(record);
  }

  private closePlayerPanels(): void {
    this.cameraSettingsOverlay.close();
    this.heroRosterOverlay.close();
    this.recruitmentOverlay.close();
    this.selectionOverlay.close();
    this.selectedHeroId = null;
    this.squadOverlay.close();
    this.expeditionOverlay.close();
    this.smithyOverlay.close();
  }

  private openCameraSettings(): void {
    if (this.buildModeActive || this.simulation.getExpeditionSnapshot().phase !== "Briefing" ||
      this.simulation.getCombatSnapshot().result !== "Idle") return;
    this.cameraSettingsOverlay.open();
    this.renderer.setUiInteractionActive(true);
  }

  private closeCameraSettings(restoreFocus: boolean): void {
    if (!this.cameraSettingsOverlay.isOpen()) return;
    this.cameraSettingsOverlay.close();
    this.syncRendererInteractionState();
    if (restoreFocus) this.hudShell.focusCameraSettings();
  }

  private selectCameraControlScheme(scheme: CameraControlScheme): void {
    this.cameraControlScheme = scheme;
    saveCameraControlScheme(scheme);
    this.renderer.setCameraControlScheme(scheme);
    this.controlsHint.setScheme(scheme);
  }

  private syncRendererInteractionState(): void {
    this.renderer.setUiInteractionActive(
      this.cameraSettingsOverlay.isOpen() || this.debugOverlayOpen ||
      this.activeHudSection !== "Refuge" || this.selectionOverlay.isOpen() || this.smithyOverlay.isOpen(),
    );
  }

  private openSmithy(): void {
    if (!this.simulation.isSmithyOperational() ||
      this.simulation.getExpeditionSnapshot().phase !== "Briefing" ||
      this.simulation.getCombatSnapshot().result !== "Idle") return;
    this.closePlayerPanels();
    this.activeHudSection = "Refuge";
    this.hudShell.setActive("Refuge");
    this.buildOverlay.setAvailable(false);
    this.smithyOverlay.open();
    this.refreshSmithyUi();
    this.renderer.setUiInteractionActive(true);
  }

  private closeSmithy(restoreFocus: boolean): void {
    if (!this.smithyOverlay.isOpen()) return;
    this.smithyOverlay.close();
    this.buildOverlay.setAvailable(true);
    this.syncRendererInteractionState();
    if (restoreFocus) this.hudShell.focus("Refuge");
  }

  private refreshSmithyUi(): void {
    this.smithyOverlay.update({
      crafting: this.simulation.getCraftingSnapshot(),
      equipment: this.simulation.getEquipmentSnapshot(),
      recipes: this.simulation.getCraftingRecipes(),
      resources: this.simulation.getExpeditionSnapshot().resources,
    });
  }

  private enterBuildMode(): void {
    if (this.buildModeActive || this.activeHudSection !== "Refuge" ||
      this.simulation.getExpeditionSnapshot().phase !== "Briefing" ||
      this.simulation.getCombatSnapshot().result !== "Idle") {
      return;
    }
    this.closePlayerPanels();
    this.buildModeActive = true;
    this.buildTool = null;
    this.buildDraft = null;
    this.buildEnvironmentDraft = null;
    this.constructionDraft = null;
    this.container.dataset.buildMode = "true";
    this.renderer.setUiInteractionActive(false);
    this.renderer.setBuildMode(true);
    this.refreshBuildUi();
  }

  private exitBuildMode(restoreFocus: boolean): void {
    if (!this.buildModeActive) return;
    this.buildModeActive = false;
    this.buildTool = null;
    this.buildDraft = null;
    this.buildEnvironmentDraft = null;
    this.constructionDraft = null;
    delete this.container.dataset.buildMode;
    this.renderer.setBuildMode(false);
    this.renderer.setBuildPreview(null);
    this.refreshBuildUi();
    if (restoreFocus) this.hudShell.focus("Refuge");
  }

  private selectBuildTool(tool: RefugeLayoutTool): void {
    if (!this.buildModeActive) return;
    this.buildTool = tool;
    this.buildEnvironmentDraft = null;
    this.constructionDraft = null;
    if (this.isFacilityTool(tool)) {
      const facility = this.simulation.getRefugeLayout().facilities.find((candidate) => candidate.id === tool);
      if (facility) {
        this.buildDraft = {
          facilityId: facility.id,
          rotation: facility.rotation,
          validation: this.simulation.validateRefugeFacility(facility.id, facility.x, facility.z),
        };
      }
    } else {
      this.buildDraft = null;
      this.renderer.setBuildPreview(null);
    }
    this.refreshBuildUi();
  }

  private selectConstructionRecipe(recipeId: FacilityRecipeId): void {
    if (!this.buildModeActive) return;
    const recipe = this.simulation.getFacilityRecipes().find((entry) => entry.id === recipeId);
    if (!recipe) return;
    this.buildTool = null;
    this.buildDraft = null;
    this.buildEnvironmentDraft = null;
    this.constructionDraft = {
      recipeId,
      rotation: 0,
      validation: this.simulation.validateConstructionPlacement(recipeId, 0, 0),
    };
    this.refreshBuildUi();
  }

  private updateBuildPointer(x: number, z: number, activate: boolean): void {
    if (!this.buildModeActive || (!this.buildTool && !this.buildEnvironmentDraft && !this.constructionDraft)) return;
    if (this.constructionDraft) {
      this.constructionDraft.validation = this.simulation.validateConstructionPlacement(
        this.constructionDraft.recipeId, x, z,
      );
      this.refreshBuildUi();
      return;
    }
    if (this.buildEnvironmentDraft) {
      this.buildEnvironmentDraft.validation = this.simulation.validateRefugeEnvironment(
        this.buildEnvironmentDraft.environmentId, x, z,
      );
      this.refreshBuildUi();
      return;
    }
    const tool = this.buildTool;
    if (!tool) return;
    if (this.isFacilityTool(tool)) {
      const current = this.simulation.getRefugeLayout().facilities.find((facility) => facility.id === this.buildTool);
      if (!current) return;
      this.buildDraft = {
        facilityId: current.id,
        rotation: this.buildDraft?.rotation ?? current.rotation,
        validation: this.simulation.validateRefugeFacility(current.id, x, z),
      };
      this.refreshBuildUi();
      return;
    }
    const validation = this.simulation.validateRefugeTrail(x, z);
    this.renderer.setBuildPreview({ radius: 0.82, rotation: 0, valid: validation.valid, x: validation.x, z: validation.z });
    if (activate) {
      if (this.buildTool === "trail") this.simulation.addRefugeTrail(x, z);
      else this.simulation.removeRefugeTrail(x, z);
      this.refreshBuildUi();
    }
  }

  private rotateBuildDraft(): void {
    if (this.constructionDraft) {
      this.constructionDraft.rotation = (this.constructionDraft.rotation + Math.PI / 2) % (Math.PI * 2);
      this.refreshBuildUi();
      return;
    }
    if (!this.buildDraft) return;
    this.buildDraft.rotation = (this.buildDraft.rotation + Math.PI / 2) % (Math.PI * 2);
    this.refreshBuildUi();
  }

  private nudgeBuildDraft(dx: number, dz: number): void {
    if (this.constructionDraft) {
      const { x, z } = this.constructionDraft.validation;
      this.constructionDraft.validation = this.simulation.validateConstructionPlacement(
        this.constructionDraft.recipeId, x + dx * 2, z + dz * 2,
      );
      this.refreshBuildUi();
      return;
    }
    if (this.buildEnvironmentDraft) {
      const { x, z } = this.buildEnvironmentDraft.validation;
      this.buildEnvironmentDraft.validation = this.simulation.validateRefugeEnvironment(
        this.buildEnvironmentDraft.environmentId, x + dx * 2, z + dz * 2,
      );
      this.refreshBuildUi();
      return;
    }
    if (!this.buildDraft) return;
    const { x, z } = this.buildDraft.validation;
    this.buildDraft.validation = this.simulation.validateRefugeFacility(
      this.buildDraft.facilityId,
      x + dx * 2,
      z + dz * 2,
    );
    this.refreshBuildUi();
  }

  private confirmBuildDraft(): void {
    if (this.constructionDraft?.validation.valid) {
      const draft = this.constructionDraft;
      if (this.simulation.createConstructionSite(
        draft.recipeId, draft.validation.x, draft.validation.z, draft.rotation,
      )) {
        this.constructionDraft = null;
        this.renderer.setBuildPreview(null);
      }
      this.refreshBuildUi();
      return;
    }
    if (this.buildEnvironmentDraft?.validation.valid) {
      const draft = this.buildEnvironmentDraft;
      if (this.simulation.moveRefugeEnvironment(draft.environmentId, draft.validation.x, draft.validation.z)) {
        this.buildEnvironmentDraft = null;
        this.renderer.setBuildPreview(null);
      }
      this.refreshBuildUi();
      return;
    }
    if (!this.buildDraft?.validation.valid) return;
    const draft = this.buildDraft;
    if (this.simulation.moveRefugeFacility(
      draft.facilityId,
      draft.validation.x,
      draft.validation.z,
      draft.rotation,
    )) {
      this.buildDraft = null;
      this.buildTool = null;
      this.renderer.setBuildPreview(null);
    }
    this.refreshBuildUi();
  }

  private cancelBuildDraft(): void {
    this.buildDraft = null;
    this.buildEnvironmentDraft = null;
    this.constructionDraft = null;
    this.buildTool = null;
    this.renderer.setBuildPreview(null);
    this.refreshBuildUi();
  }

  private storeBuildFacility(): void {
    const id = this.buildDraft?.facilityId;
    if (!id || !["dormitory", "infirmary", "storage", "training"].includes(id)) return;
    if (this.simulation.storeRefugeFacility(id as "dormitory" | "infirmary" | "storage" | "training")) {
      this.buildDraft = null;
      this.buildTool = null;
      this.renderer.setBuildPreview(null);
      this.refreshBuildUi();
    }
  }

  private removeBuildEnvironment(): void {
    const id = this.buildEnvironmentDraft?.environmentId;
    if (!id) return;
    if (this.simulation.removeRefugeEnvironment(id)) {
      this.buildEnvironmentDraft = null;
      this.renderer.setBuildPreview(null);
      this.refreshBuildUi();
    }
  }

  private refreshBuildUi(): void {
    const layout = this.simulation.getRefugeLayout();
    this.lastBuildConstructionRevision = this.simulation.getConstructionSnapshot().revision;
    if (this.buildDraft) {
      const facility = layout.facilities.find((candidate) => candidate.id === this.buildDraft?.facilityId);
      if (facility) {
        this.renderer.setBuildPreview({
          radius: facility.footprintRadius,
          rotation: this.buildDraft.rotation,
          valid: this.buildDraft.validation.valid,
          x: this.buildDraft.validation.x,
          z: this.buildDraft.validation.z,
        });
      }
    }
    if (this.buildEnvironmentDraft) {
      const environment = [...layout.trees, ...layout.rocks].find((entry) => entry.id === this.buildEnvironmentDraft?.environmentId);
      if (environment) {
        this.renderer.setBuildPreview({
          radius: environment.footprintRadius,
          rotation: environment.rotation,
          valid: this.buildEnvironmentDraft.validation.valid,
          x: this.buildEnvironmentDraft.validation.x,
          z: this.buildEnvironmentDraft.validation.z,
        });
      }
    }
    if (this.constructionDraft) {
      const recipe = this.simulation.getFacilityRecipes().find((entry) => entry.id === this.constructionDraft?.recipeId);
      if (recipe) {
        this.renderer.setBuildPreview({
          radius: recipe.footprintRadius,
          rotation: this.constructionDraft.rotation,
          valid: this.constructionDraft.validation.valid,
          x: this.constructionDraft.validation.x,
          z: this.constructionDraft.validation.z,
        });
      }
    }
    this.buildOverlay.update({
      active: this.buildModeActive,
      canUndo: this.simulation.canUndoRefugeLayout(),
      construction: this.simulation.getConstructionSnapshot(),
      constructionRecipeId: this.constructionDraft?.recipeId ?? null,
      draft: this.buildDraft?.validation ?? this.buildEnvironmentDraft?.validation ?? this.constructionDraft?.validation ?? null,
      environmentId: this.buildEnvironmentDraft?.environmentId ?? null,
      getRecipeCost: (recipeId) => this.simulation.getFacilityScrapCost(recipeId),
      heroes: this.simulation.getHeroes(),
      layout,
      recipes: this.simulation.getFacilityRecipes(),
      rotation: this.buildDraft?.rotation ?? this.constructionDraft?.rotation ?? 0,
      scrap: this.simulation.getExpeditionSnapshot().resources.scrap,
      tool: this.buildTool,
    });
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Escape" && this.smithyOverlay.isOpen()) {
      event.preventDefault();
      this.closeSmithy(true);
      return;
    }
    if (event.code === "Escape" && this.cameraSettingsOverlay.isOpen()) {
      event.preventDefault();
      this.closeCameraSettings(true);
      return;
    }
    if (this.buildModeActive && !this.isEditableTarget(event.target)) {
      if (event.code === "Escape") {
        event.preventDefault();
        if (this.buildDraft || this.buildEnvironmentDraft || this.constructionDraft) this.cancelBuildDraft();
        else this.exitBuildMode(true);
        return;
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        this.rotateBuildDraft();
        return;
      }
      if (event.code === "Enter") {
        event.preventDefault();
        this.confirmBuildDraft();
        return;
      }
      const direction = event.code === "ArrowUp" ? [0, -1]
        : event.code === "ArrowDown" ? [0, 1]
          : event.code === "ArrowLeft" ? [-1, 0]
            : event.code === "ArrowRight" ? [1, 0]
              : null;
      if (direction) {
        event.preventDefault();
        this.nudgeBuildDraft(direction[0] ?? 0, direction[1] ?? 0);
        return;
      }
    }
    if (event.code !== "Escape" ||
      (this.activeHudSection === "Refuge" && !this.selectionOverlay.isOpen())) {
      return;
    }
    event.preventDefault();
    if (this.recruitmentOverlay.isOpen()) {
      this.activateHudSection("Heroes", true);
      return;
    }
    if (this.selectionOverlay.isOpen()) {
      this.closeHeroDetail();
      return;
    }
    this.activateHudSection("Refuge", true);
  };

  private isFacilityTool(tool: RefugeLayoutTool): tool is RefugeStructureId {
    return !["trail", "erase-trail"].includes(tool);
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      this.clock.resetFrameTime();
    }
  };
}
