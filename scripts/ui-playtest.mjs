import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9337;
const appUrl = "http://127.0.0.1:41777/";
const profile = await mkdtemp(join(tmpdir(), "ascent-ui-"));
const output = new URL("../artifacts/ui-redesign/", import.meta.url);
await mkdir(output, { recursive: true });

const server = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "--host", "127.0.0.1",
  "--port", "41777",
  "--strictPort",
], { stdio: "ignore" });

for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    if ((await fetch(appUrl)).ok) break;
  } catch {
    // Vite startup is asynchronous.
  }
  if (attempt === 59) throw new Error("Could not start the ASCENT playtest server.");
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const browser = spawn(browserPath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  appUrl,
], { stdio: "ignore" });

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let socket;
let nextId = 0;
const pending = new Map();
const runtimeExceptions = [];

try {
  let target;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      target = targets.find((entry) => entry.type === "page" && entry.url === appUrl);
      if (target) break;
    } catch {
      // Browser startup is asynchronous.
    }
    await pause(100);
  }
  if (!target) throw new Error("Could not attach to the ASCENT browser target.");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      runtimeExceptions.push(message.params.exceptionDetails.text);
    }
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request?.reject(new Error(message.error.message));
    else request?.resolve(message.result);
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label, timeout = 12_000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  const screenshot = async (name) => {
    const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(new URL(name, output), Buffer.from(result.data, "base64"));
  };
  const setViewport = async (width, height) => {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await command("Page.reload", { ignoreCache: true });
    await pause(250);
    await waitFor("document.readyState === 'complete' && document.querySelectorAll('.hud-navigation button').length === 4 && document.querySelector('canvas')?.width > 0", `${width}px HUD`);
    await pause(600);
  };

  await command("Page.enable");
  await command("Runtime.enable");
  await setViewport(1440, 900);
  const layoutValidation = await evaluate(`(async () => {
    const [{ RefugeLayoutSystem }, { createRefugeNavigationPoints }] = await Promise.all([
      import('/src/refuge/RefugeLayoutSystem.ts'),
      import('/src/base/NavigationPoints.ts'),
    ]);
    const first = new RefugeLayoutSystem();
    const second = new RefugeLayoutSystem();
    const initial = first.getSnapshot();
    const deterministic = JSON.stringify(initial.trees) === JSON.stringify(second.getSnapshot().trees);
    const invalidCenter = !first.validateFacility('dormitory', 0, 0).valid;
    let candidate = null;
    for (let x = -24; x <= 24 && !candidate; x += 2) {
      for (let z = -24; z <= 24; z += 2) {
        const validation = first.validateFacility('dormitory', x, z);
        if (validation.valid && (validation.x !== -18 || validation.z !== -14)) {
          candidate = validation;
          break;
        }
      }
    }
    const moved = candidate ? first.moveFacility('dormitory', candidate.x, candidate.z, Math.PI / 2) : false;
    const movedLayout = first.getSnapshot();
    const navigation = createRefugeNavigationPoints(movedLayout);
    const dormitory = movedLayout.facilities.find((facility) => facility.id === 'dormitory');
    const destinationsFollow = Boolean(dormitory) && navigation.focus.Resting.x === dormitory.x && navigation.focus.Resting.z === dormitory.z;
    let trailPoint = null;
    for (let x = -20; x <= 20 && !trailPoint; x += 2) {
      for (let z = -20; z <= 20; z += 2) {
        const validation = first.validateTrail(x, z);
        if (validation.valid) { trailPoint = validation; break; }
      }
    }
    const trailAdded = trailPoint ? first.addTrail(trailPoint.x, trailPoint.z) : false;
    const disconnectedRejected = !first.validateTrail(20, -20).valid;
    const trailCount = first.getSnapshot().trails.length;
    const undo = first.undo();
    const environment = second.getSnapshot().trees.find((entry) => entry.placed);
    const environmentRemoved = environment ? second.removeEnvironment(environment.id) : false;
    const environmentUndo = second.undo();
    const criticalProtected = !second.storeFacility('command-hall');
    const facilityStored = second.storeFacility('storage') && second.getSnapshot().facilities.find((entry) => entry.id === 'storage')?.placed === false;
    const facilityStoreUndo = second.undo();
    return {
      deterministic,
      destinationsFollow,
      disconnectedRejected,
      facilityCount: initial.facilities.length,
      invalidCenter,
      moved,
      revision: movedLayout.revision,
      trailAdded,
      trailCount,
      treeCount: initial.trees.length,
      rockCount: initial.rocks.length,
      planeSize: initial.planeSize,
      environmentRemoved,
      environmentUndo,
      criticalProtected,
      facilityStored,
      facilityStoreUndo,
      undo,
    };
  })()`);
  assert(
    layoutValidation.deterministic && layoutValidation.destinationsFollow && layoutValidation.disconnectedRejected && layoutValidation.facilityCount === 8 &&
      layoutValidation.invalidCenter && layoutValidation.moved && layoutValidation.revision === 1 &&
      layoutValidation.trailAdded && layoutValidation.trailCount === 1 && layoutValidation.treeCount === 28 && layoutValidation.rockCount === 16 &&
      layoutValidation.planeSize === 72 && layoutValidation.environmentRemoved && layoutValidation.environmentUndo && layoutValidation.criticalProtected &&
      layoutValidation.facilityStored && layoutValidation.facilityStoreUndo && layoutValidation.undo,
    `Phase 21 layout validation failed (${JSON.stringify(layoutValidation)}).`,
  );
  const recoveryValidation = await evaluate(`(async () => {
    const [{ Simulation }, { InjurySystem, getInjuryModifiers }, { HeroManager }] = await Promise.all([
      import('/src/simulation/Simulation.ts'),
      import('/src/heroes/InjurySystem.ts'),
      import('/src/heroes/HeroManager.ts'),
    ]);
    const simulation = new Simulation();
    const hero = simulation.getHeroes()[0];
    const recovery = new InjurySystem();
    const injury = recovery.inflictExpeditionInjury(hero, 'Withdrawn', 0.82, 1);
    simulation.getHeroes().slice(0, 3).forEach((member) => simulation.addHeroToSquad(member.id));
    const medicineBefore = simulation.getExpeditionSnapshot().resources.medicine;
    const trainingBlocked = !simulation.queueTraining(hero.id, 'Strength Training');
    const deploymentBlocked = !simulation.getSquadEvaluation().isReady && !simulation.startExpedition();
    const treated = simulation.treatHeroInjury(hero.id, injury.id);
    const medicineAfter = simulation.getExpeditionSnapshot().resources.medicine;
    const modifiers = getInjuryModifiers(hero);
    hero.movement.activity = 'Resting';
    recovery.step([hero], 20_000);
    const manager = new HeroManager();
    const consequenceHeroes = manager.generateInitialRoster(3);
    const consequenceSquad = {
      doctrine: 'Balanced', id: 'phase-14-validation', name: 'Recovery Test',
      members: consequenceHeroes.map((member, index) => ({
        formation: ['Front', 'Middle', 'Back'][index],
        heroId: member.id,
        role: ['Vanguard', 'Damage', 'Support'][index],
      })),
    };
    const consequences = manager.applyExpeditionConsequences(
      consequenceSquad,
      { combatants: consequenceHeroes.map((member) => ({ id: member.id, hp: 18, stats: { maxHp: 100 } })) },
      'Withdrawn',
      1,
    );
    return {
      consequenceInjuries: consequences.length === 3 && consequenceHeroes.every((member) => member.injuries.length === 1),
      deploymentBlocked,
      medicineAfter,
      medicineBefore,
      modifierApplied: modifiers.attack < 1 && modifiers.defense < 1,
      recovered: hero.injuries.length === 0,
      trainingBlocked,
      treated,
      treatmentCost: medicineBefore - medicineAfter,
    };
  })()`);
  assert(
    recoveryValidation.trainingBlocked && recoveryValidation.deploymentBlocked &&
      recoveryValidation.treated && recoveryValidation.treatmentCost > 0 &&
      recoveryValidation.modifierApplied && recoveryValidation.recovered &&
      recoveryValidation.consequenceInjuries,
    `Phase 14 recovery validation failed (${JSON.stringify(recoveryValidation)}).`,
  );
  const memoryValidation = await evaluate(`(async () => {
    const [{ HeroManager }, { MemorySystem, getMemoryCombatInfluence }, { scoreCombatActions }, { SelectionOverlay }] = await Promise.all([
      import('/src/heroes/HeroManager.ts'),
      import('/src/memories/MemorySystem.ts'),
      import('/src/combat/UtilityAI.ts'),
      import('/src/ui/SelectionOverlay.ts'),
    ]);
    const manager = new HeroManager();
    const heroes = manager.generateInitialRoster(3);
    const saver = heroes[0];
    const saved = heroes[1];
    const trustBefore = saved.relationships[saver.id].metrics.trust;
    const fearBefore = saved.relationships[saver.id].metrics.fear;
    manager.recordCombatMemory({ actorId: saver.id, targetId: saved.id, type: 'PROTECTED_ALLY' }, 1);
    const trustAfterFirst = saved.relationships[saver.id].metrics.trust;
    manager.recordCombatMemory({ actorId: saver.id, targetId: saved.id, type: 'PROTECTED_ALLY' }, 1);
    const trustAfterDuplicate = saved.relationships[saver.id].metrics.trust;
    manager.recordCombatMemory({ actorId: saver.id, targetId: saved.id, type: 'PROTECTED_ALLY' }, 2);
    const rescueMemory = saved.memories.find((memory) => memory.type === 'WAS_SAVED');

    const memories = new MemorySystem();
    memories.recordCriticalInjury(saved, 'Concussion', 2);
    const influence = getMemoryCombatInfluence(saved.memories, saver.id);
    const baseActor = {
      action: 'Idle', attributes: { agility: 3, endurance: 3, intelligence: 3, leadership: 2, strength: 3, willpower: 3 },
      formation: 'Middle', hp: 71, id: saved.id, medicine: 0,
      personality: { aggression: 0.2, ambition: 0.2, bravery: 0.9, discipline: 0.6, empathy: 0.5, loyalty: 0.5 },
      position: { x: 0, z: 0 }, preparedSkillIds: new Set(), relationships: {}, role: 'Damage',
      stats: { attack: 20, defense: 10, maxHp: 100, range: 2, speed: 2 }, tacticalRole: 'Striker', traits: [],
    };
    const opponent = {
      action: 'Idle', formation: 'Front', hp: 100, id: 'memory-threat', position: { x: 1, z: 0 },
      stats: { attack: 20, defense: 8, maxHp: 100, range: 2, speed: 2 }, tacticalRole: 'Skirmisher',
    };
    const withoutMemory = scoreCombatActions({ ...baseActor, memories: [] }, [baseActor], [opponent]);
    const withMemory = scoreCombatActions({ ...baseActor, memories: saved.memories }, [baseActor], [opponent]);
    const retreatWithout = withoutMemory.scores.find((score) => score.action === 'Retreat');
    const retreatWith = withMemory.scores.find((score) => score.action === 'Retreat');

    const overlay = new SelectionOverlay(document.querySelector('#app'), () => undefined, () => undefined, () => undefined, () => 0, () => undefined);
    overlay.showHero(saved, heroes, 'Relations');
    const renderedMemories = document.querySelectorAll('.hero-memory').length;
    const lastingMemory = [...document.querySelectorAll('.hero-memory')].some((entry) => entry.dataset.persistent === 'true');
    overlay.dispose();

    memories.step(heroes, 20 * 24 * 60);
    return {
      duplicateSuppressed: trustAfterDuplicate === trustAfterFirst,
      fearReduced: saved.relationships[saver.id].metrics.fear < fearBefore,
      historyRecorded: saved.relationships[saver.id].history[0]?.type === 'help',
      influenceBounded: influence.fear > 0 && influence.fear <= 1 && influence.protect > 0 && influence.protect <= 1,
      lastingMemory,
      persistentRetained: saved.memories.some((memory) => memory.type === 'CRITICAL_INJURY'),
      relationshipChanged: trustAfterFirst > trustBefore,
      renderedMemories,
      rescueDecayed: !saved.memories.some((memory) => memory.type === 'WAS_SAVED'),
      rescueRecorded: Boolean(rescueMemory && rescueMemory.lastReinforcedDay === 2),
      utilityChanged: !retreatWithout.valid && retreatWith.valid && retreatWith.score > retreatWithout.score,
    };
  })()`);
  assert(
    memoryValidation.duplicateSuppressed && memoryValidation.fearReduced && memoryValidation.historyRecorded &&
      memoryValidation.influenceBounded && memoryValidation.lastingMemory &&
      memoryValidation.persistentRetained && memoryValidation.relationshipChanged &&
      memoryValidation.renderedMemories === 2 && memoryValidation.rescueDecayed &&
      memoryValidation.rescueRecorded && memoryValidation.utilityChanged,
    `Phase 16 memory validation failed (${JSON.stringify(memoryValidation)}).`,
  );
  const traitValidation = await evaluate(`(async () => {
    const [{ HeroManager }, { MemorySystem }, { TraitEvolutionSystem }, { SelectionOverlay }, { NotificationCenter }] = await Promise.all([
      import('/src/heroes/HeroManager.ts'),
      import('/src/memories/MemorySystem.ts'),
      import('/src/heroes/TraitEvolutionSystem.ts'),
      import('/src/ui/SelectionOverlay.ts'),
      import('/src/ui/NotificationCenter.ts'),
    ]);
    const earnedNames = new Set(['Battle-Hardened', 'Veteran', "Survivor's Guilt", 'Protective', 'Ruthless']);
    const clearEarned = (hero) => {
      hero.traits = hero.traits.filter((name) => !earnedNames.has(name));
      hero.traitHistory = hero.traitHistory.filter((trait) => !earnedNames.has(trait.name));
    };
    const manager = new HeroManager();
    const heroes = manager.generateInitialRoster(3);
    const veteran = heroes[0];
    clearEarned(veteran);
    veteran.career.expeditions = 10;
    veteran.career.kills = 6;
    veteran.personality.bravery = 0.5;
    veteran.personality.discipline = 0.5;
    const memories = new MemorySystem();
    memories.recordCriticalInjury(veteran, 'Concussion', 8);
    const evolution = new TraitEvolutionSystem();
    const before = { ...veteran.personality };
    const awards = evolution.evaluate(veteran, 12);
    const afterFirst = JSON.stringify(veteran.personality);
    const duplicateAwards = evolution.evaluate(veteran, 13);

    const survivor = heroes[1];
    clearEarned(survivor);
    memories.recordAllyDeath(survivor, veteran, 'Trusted Friend', 12);
    evolution.evaluate(survivor, 12);

    const protector = heroes[2];
    clearEarned(protector);
    manager.recordCombatMemory({ actorId: protector.id, targetId: survivor.id, type: 'PROTECTED_ALLY' }, 14);
    manager.recordCombatMemory({ actorId: protector.id, targetId: survivor.id, type: 'PROTECTED_ALLY' }, 15);

    const ruthlessManager = new HeroManager();
    const ruthless = ruthlessManager.generateInitialRoster(1)[0];
    clearEarned(ruthless);
    ruthless.career.kills = 10;
    ruthless.personality.empathy = 0.3;
    const notification = new NotificationCenter(document.querySelector('#app'), () => undefined);
    const expedition = {
      attempt: 0, deployedSquadName: null,
      mission: { description: '', difficulty: 'Moderate', id: 'trait-test', name: 'Trait Test', objective: 'Test', rewards: {food:0,medicine:0,riftShards:0,scrap:0}, threats: [] },
      phase: 'Briefing', report: null, resources: {food:0,medicine:0,riftShards:0,scrap:0},
    };
    notification.update([ruthless], [], expedition, []);
    evolution.evaluate(ruthless, 16);
    notification.update([ruthless], [], expedition, []);
    const traitNotice = [...document.querySelectorAll('.notification-feed li')].some((entry) => entry.textContent.includes('earned Ruthless'));
    notification.dispose();

    const overlay = new SelectionOverlay(document.querySelector('#app'), () => undefined, () => undefined, () => undefined, () => 0, () => undefined);
    overlay.showHero(veteran, heroes, 'Overview');
    const renderedEarned = document.querySelectorAll('.hero-trait[data-source="Earned"]').length;
    const renderedSource = [...document.querySelectorAll('.hero-trait')].some((entry) => entry.textContent.includes('Earned · Day 12') && entry.textContent.includes('surviving 10 expeditions'));
    overlay.dispose();

    return {
      battleHardened: veteran.traits.includes('Battle-Hardened'),
      bounded: Object.values(veteran.personality).every((value) => value >= 0.04 && value <= 0.98),
      driftApplied: veteran.personality.bravery > before.bravery && veteran.personality.discipline > before.discipline,
      idempotent: duplicateAwards.length === 0 && JSON.stringify(veteran.personality) === afterFirst,
      metadata: awards.every((trait) => trait.source === 'Earned' && trait.reason.length > 20 && trait.acquiredDay === 12),
      protective: protector.traits.includes('Protective'),
      renderedEarned,
      renderedSource,
      ruthless: ruthless.traits.includes('Ruthless'),
      survivorGuilt: survivor.traits.includes("Survivor's Guilt"),
      traitNotice,
      veteran: veteran.traits.includes('Veteran'),
    };
  })()`);
  assert(
    traitValidation.battleHardened && traitValidation.bounded && traitValidation.driftApplied &&
      traitValidation.idempotent && traitValidation.metadata && traitValidation.protective &&
      traitValidation.renderedEarned === 2 && traitValidation.renderedSource && traitValidation.ruthless &&
      traitValidation.survivorGuilt && traitValidation.traitNotice && traitValidation.veteran,
    `Phase 17 trait validation failed (${JSON.stringify(traitValidation)}).`,
  );
  const recruitmentValidation = await evaluate(`(async () => {
    const [{ Simulation }, { RecruitmentSystem }, { DormitorySystem }, { NeedsSystem }, { HeroGenerator }, { Random }, { createInitialMovement }, { validateHeroAppearanceConfig }, { HeroPortraitCache }, { RecruitmentOverlay }, { NotificationCenter }, { ProceduralBaseScene }, THREE] = await Promise.all([
      import('/src/simulation/Simulation.ts'),
      import('/src/recruitment/RecruitmentSystem.ts'),
      import('/src/refuge/DormitorySystem.ts'),
      import('/src/heroes/NeedsSystem.ts'),
      import('/src/heroes/HeroGenerator.ts'),
      import('/src/core/Random.ts'),
      import('/src/base/NavigationPoints.ts'),
      import('/src/heroes/HeroAppearanceConfig.ts'),
      import('/src/rendering/heroes/HeroPortraitCache.ts'),
      import('/src/ui/RecruitmentOverlay.ts'),
      import('/src/ui/NotificationCenter.ts'),
      import('/src/rendering/ProceduralBaseScene.ts'),
      import('/node_modules/three/build/three.module.js'),
    ]);
    const recruitment = new RecruitmentSystem(new Random(91));
    const rolls = Array.from({ length: 600 }, (_, index) => recruitment.createRoll(index + 1));
    const ranks = new Set(rolls.map((roll) => roll.rank));
    const fixedRoll = recruitment.createRoll(187451);
    const deterministicRank = JSON.stringify(fixedRoll) === JSON.stringify(recruitment.createRoll(187451));

    const simulation = new Simulation();
    const initialHeroes = simulation.getHeroes();
    const notification = new NotificationCenter(document.querySelector('#app'), () => undefined);
    notification.update(initialHeroes, [], simulation.getExpeditionSnapshot(), []);
    simulation.getExpeditionSnapshot().resources.riftShards = 3;
    const capacityBlocked = simulation.recruitHero(187450) === null;
    const shardsPreservedAtCapacity = simulation.getExpeditionSnapshot().resources.riftShards === 3;
    simulation.getExpeditionSnapshot().resources.scrap = 12;
    const upgraded = simulation.upgradeDormitory();
    const dormitoryAfterUpgrade = simulation.getDormitorySnapshot();
    const scrapAfterUpgrade = simulation.getExpeditionSnapshot().resources.scrap;
    const shardsBefore = simulation.getExpeditionSnapshot().resources.riftShards;
    const result = simulation.recruitHero(187451);
    const shardsAfter = simulation.getExpeditionSnapshot().resources.riftShards;
    const countAfter = simulation.getHeroes().length;
    const blocked = simulation.recruitHero(187452) === null;
    if (!result) throw new Error('Seeded recruitment unexpectedly failed.');
    notification.update(simulation.getHeroes(), [], simulation.getExpeditionSnapshot(), []);
    const recruitmentNotice = [...document.querySelectorAll('.notification-feed li')].some((entry) => entry.textContent.includes(result.hero.name + ' emerged'));
    notification.dispose();

    const dormitory = new DormitorySystem();
    const basicRest = dormitory.getSnapshot(5);
    dormitory.upgrade();
    const settledRest = dormitory.getSnapshot(5);
    const basicHero = structuredClone(initialHeroes[0]);
    const settledHero = structuredClone(initialHeroes[0]);
    [basicHero, settledHero].forEach((hero) => {
      hero.movement.activity = 'Resting';
      Object.assign(hero.needs, { fatigue: 80, health: 100, hunger: 100, morale: 50, social: 100, stress: 0 });
    });
    const needs = new NeedsSystem();
    needs.step([basicHero], 60, basicRest);
    needs.step([settledHero], 60, settledRest);
    const comfortImprovesRecovery = settledHero.needs.fatigue < basicHero.needs.fatigue && settledHero.needs.morale > basicHero.needs.morale;

    const maximumSimulation = new Simulation();
    maximumSimulation.getExpeditionSnapshot().resources.scrap = 36;
    const firstMaximumUpgrade = maximumSimulation.upgradeDormitory();
    const secondMaximumUpgrade = maximumSimulation.upgradeDormitory();
    const scrapAtMaximum = maximumSimulation.getExpeditionSnapshot().resources.scrap;
    const maximumBlocked = maximumSimulation.upgradeDormitory() === false;
    const maximumDormitory = maximumSimulation.getDormitorySnapshot();

    const reproduced = new HeroGenerator(new Random(result.seed)).generate(
      createInitialMovement(initialHeroes.length),
      initialHeroes.length,
      new Set(initialHeroes.map((hero) => hero.name)),
      result.seed,
    );
    const appearanceReproduced = JSON.stringify(result.hero.appearance) === JSON.stringify(reproduced.appearance);
    const validImport = validateHeroAppearanceConfig(JSON.parse(JSON.stringify(result.hero.appearance)));
    const invalidImport = validateHeroAppearanceConfig({ ...result.hero.appearance, height: 99 });

    const gateScene = new THREE.Scene();
    const gateSelectables = [];
    const refuge = new ProceduralBaseScene(gateScene, gateSelectables);
    const gateActive = gateSelectables.some((root) => root.name === 'Dimensional Gate');
    refuge.dispose();

    const portraits = new HeroPortraitCache();
    await portraits.generateAll([result.hero], () => undefined);
    const portraitUrl = portraits.get(result.hero.id);
    const reveal = new RecruitmentOverlay(document.querySelector('#app'), portraits, () => undefined);
    reveal.open(result);
    const revealText = [...document.querySelectorAll('.recruitment-panel')].at(-1)?.textContent ?? '';
    const revealPortrait = document.querySelector('.recruitment-reveal__portrait img')?.getAttribute('src') ?? '';
    const revealRank = document.querySelector('.recruitment-reveal__rank')?.textContent?.length ?? 0;
    reveal.dispose();
    portraits.dispose();

    return {
      appearanceReproduced,
      blocked,
      capacityBlocked,
      countAfter,
      comfortImprovesRecovery,
      deterministicRank,
      generationSeed: result.hero.generationSeed,
      gateActive,
      hiddenPotentialPresent: Object.values(result.hero.hiddenPotential).every((value) => value >= 0.25 && value <= 0.98),
      invalidRejected: invalidImport === null,
      joinedRelationships: Object.keys(result.hero.relationships).length === initialHeroes.length,
      maximum: firstMaximumUpgrade && secondMaximumUpgrade && maximumBlocked && maximumDormitory.capacity === 10 && maximumDormitory.upgradeCost === null && scrapAtMaximum === 0,
      portrait: Boolean(portraitUrl?.startsWith('blob:') && revealPortrait.startsWith('blob:')),
      ranks: [...ranks].sort(),
      recruitmentNotice,
      reveal: revealText.includes(result.hero.name) && revealText.includes(result.hero.origin.occupation) && revealText.includes('Visible traits') && revealText.includes('Visible skills'),
      revealRank,
      shardsAfter,
      shardsBefore,
      shardsPreservedAtCapacity,
      upgrade: upgraded && dormitoryAfterUpgrade.capacity === 7 && dormitoryAfterUpgrade.comfort === 'Settled' && scrapAfterUpgrade === 0,
      validImport: Boolean(validImport),
    };
  })()`);
  assert(
    recruitmentValidation.appearanceReproduced && recruitmentValidation.blocked && recruitmentValidation.capacityBlocked &&
      recruitmentValidation.countAfter === 6 && recruitmentValidation.deterministicRank &&
      recruitmentValidation.comfortImprovesRecovery &&
      recruitmentValidation.generationSeed === 187451 && recruitmentValidation.gateActive && recruitmentValidation.hiddenPotentialPresent &&
      recruitmentValidation.invalidRejected && recruitmentValidation.joinedRelationships && recruitmentValidation.maximum &&
      recruitmentValidation.portrait && JSON.stringify(recruitmentValidation.ranks) === JSON.stringify([1, 2, 3]) &&
      recruitmentValidation.recruitmentNotice && recruitmentValidation.reveal &&
      recruitmentValidation.revealRank >= 1 && recruitmentValidation.revealRank <= 3 &&
      recruitmentValidation.shardsBefore === 3 && recruitmentValidation.shardsAfter === 0 &&
      recruitmentValidation.shardsPreservedAtCapacity && recruitmentValidation.upgrade && recruitmentValidation.validImport,
    `Phase 18-19 recruitment and capacity validation failed (${JSON.stringify(recruitmentValidation)}).`,
  );
  const economyValidation = await evaluate(`(async () => {
    const [{ ResourceEconomySystem }, { NeedsSystem }, { HeroGenerator }, { Random }, { createInitialMovement }, { NotificationCenter }] = await Promise.all([
      import('/src/economy/ResourceEconomySystem.ts'),
      import('/src/heroes/NeedsSystem.ts'),
      import('/src/heroes/HeroGenerator.ts'),
      import('/src/core/Random.ts'),
      import('/src/base/NavigationPoints.ts'),
      import('/src/ui/NotificationCenter.ts'),
    ]);
    let food = 2;
    const economy = new ResourceEconomySystem();
    const consumeFood = (amount) => {
      if (amount <= 0 || food < amount) return false;
      food -= amount;
      return true;
    };
    economy.step(5, 288, food, consumeFood);
    const firstConsumption = food === 1 && economy.getSnapshot(5, food).foodConsumed === 1;
    economy.step(5, 576, food, consumeFood);
    const emptySnapshot = economy.getSnapshot(5, food);
    const shortageTracked = food === 0 && emptySnapshot.foodConsumed === 2 && emptySnapshot.foodShortfall === 1 && emptySnapshot.provisionStatus === 'Empty';

    const generator = new HeroGenerator(new Random(404));
    const fed = generator.generate(createInitialMovement(0), 0, new Set());
    const empty = structuredClone(fed);
    [fed, empty].forEach((hero) => {
      hero.movement.activity = 'Eating';
      Object.assign(hero.needs, { fatigue: 20, health: 100, hunger: 40, morale: 60, social: 60, stress: 20 });
    });
    const needs = new NeedsSystem();
    needs.step([fed], 60, { fatigueRecoveryMultiplier: 1, foodSupply: 'Stocked', moraleRecoveryBonus: 0 });
    needs.step([empty], 60, { fatigueRecoveryMultiplier: 1, foodSupply: 'Empty', moraleRecoveryBonus: 0 });
    const emptyMealsMatter = fed.needs.hunger > empty.needs.hunger && empty.needs.morale < fed.needs.morale && empty.needs.stress > fed.needs.stress;

    const notificationHost = document.createElement('div');
    document.querySelector('#app').appendChild(notificationHost);
    const notifications = new NotificationCenter(notificationHost, () => undefined);
    const expedition = {
      attempt: 0, deployedSquadName: null,
      mission: { description: '', difficulty: 'Moderate', id: 'test', name: 'Test', objective: 'Eliminate Enemies', rewards: {food:8,medicine:2,riftShards:3,scrap:18}, threats: [] },
      phase: 'Briefing', report: null, resources: {food:12,medicine:6,riftShards:0,scrap:0},
    };
    const stocked = { dailyFoodDemand: 5, foodConsumed: 0, foodShortfall: 0, provisionDays: 2.4, provisionStatus: 'Stocked' };
    const low = { ...stocked, provisionDays: 1, provisionStatus: 'Low' };
    const emptyState = { ...stocked, provisionDays: 0, provisionStatus: 'Empty' };
    notifications.update([fed], [], expedition, [], stocked);
    notifications.update([fed], [], expedition, [], low);
    notifications.update([fed], [], expedition, [], emptyState);
    const noticeText = notificationHost.textContent ?? '';
    notifications.dispose();
    notificationHost.remove();

    return {
      emptyMealsMatter,
      firstConsumption,
      notifications: noticeText.includes('Food stores are low') && noticeText.includes('Food stores are empty'),
      shortageTracked,
      stockedDays: new ResourceEconomySystem().getSnapshot(5, 12).provisionDays,
    };
  })()`);
  assert(
    economyValidation.emptyMealsMatter && economyValidation.firstConsumption &&
      economyValidation.notifications && economyValidation.shortageTracked && economyValidation.stockedDays === 2.4,
    `Phase 20 resource economy validation failed (${JSON.stringify(economyValidation)}).`,
  );
  const legacyValidation = await evaluate(`(async () => {
    const [{ HeroManager }, { SquadSystem }, { HeroRenderer }, { ProceduralBaseScene }, { NotificationCenter }, { HeroRosterOverlay }, THREE] = await Promise.all([
      import('/src/heroes/HeroManager.ts'),
      import('/src/squads/SquadSystem.ts'),
      import('/src/rendering/heroes/HeroRenderer.ts'),
      import('/src/rendering/ProceduralBaseScene.ts'),
      import('/src/ui/NotificationCenter.ts'),
      import('/src/ui/HeroRosterOverlay.ts'),
      import('/node_modules/three/build/three.module.js'),
    ]);
    const manager = new HeroManager();
    const heroes = manager.generateInitialRoster(3);
    const fallen = heroes[0];
    const friend = heroes[1];
    Object.assign(friend.relationships[fallen.id].metrics, {
      affinity: 62, fear: 0, jealousy: 0, respect: 72, rivalry: 0, trust: 84,
    });
    const moraleBefore = friend.needs.morale;
    const squad = new SquadSystem();
    heroes.forEach((hero) => squad.addHero(hero.id, heroes));
    const squadRecord = squad.getSquad();
    const combatants = heroes.map((hero, index) => ({
      action: index === 0 ? 'Dead' : 'Idle', actionScores: [], decisionReason: '', defeatedBy: index === 0 ? 'Rift Stalker II' : null,
      defending: false, formation: ['Front', 'Middle', 'Back'][index], hp: index === 0 ? 0 : 45, id: hero.id,
      kills: index === 0 ? 2 : index, label: hero.name, position: {x:0,z:0}, role: ['Vanguard','Damage','Support'][index],
      stats: {attack:10,defense:5,maxHp:100,range:2,speed:2}, tacticalRole: 'Skirmisher', team: 'Hero',
    }));
    const consequences = manager.applyExpeditionConsequences(
      squadRecord,
      { combatants, log: [], result: 'Defeat', tick: 20 },
      'Defeat',
      5,
    );
    const record = manager.getFallen()[0];
    const removedFromSquad = squad.removeMissingHeroes(manager.getAll());
    const selectable = [];
    const heroScene = new THREE.Scene();
    const heroRenderer = new HeroRenderer(heroScene, heroes, selectable);
    heroRenderer.update(manager.getAll(), 1, 0.016);
    const activeSelectableCount = selectable.length;
    heroRenderer.dispose();
    const memorialSelectable = [];
    const memorialScene = new THREE.Scene();
    const baseScene = new ProceduralBaseScene(memorialScene, memorialSelectable);
    const beforeMemorial = memorialSelectable.length;
    baseScene.syncMemorials(manager.getFallen());
    const graveCreated = memorialSelectable.length === beforeMemorial + 1 && memorialSelectable.some((root) => root.name === record.name);
    baseScene.dispose();
    const notification = new NotificationCenter(document.querySelector('#app'), () => undefined);
    const expedition = {
      attempt: 0, deployedSquadName: null,
      mission: { description: '', difficulty: 'Moderate', id: 'test', name: 'Test', objective: 'Eliminate Enemies', rewards: {food:0,medicine:0,riftShards:0,scrap:0}, threats: [] },
      phase: 'Briefing', report: null, resources: {food:0,medicine:6,riftShards:0,scrap:0},
    };
    notification.update(manager.getAll(), [], expedition, []);
    notification.update(manager.getAll(), [], expedition, manager.getFallen());
    const deathNotice = [...document.querySelectorAll('.notification-feed li')].some((entry) => entry.textContent.includes(record.name + ' has fallen'));
    notification.dispose();
    const rosterHost = document.createElement('div');
    document.querySelector('#app').appendChild(rosterHost);
    let inspectedMemorial = null;
    const roster = new HeroRosterOverlay(
      rosterHost,
      () => manager.getAll(),
      () => manager.getFallen(),
      () => squad.getSquad(),
      () => 0,
      () => 0,
      () => 3,
      () => ({ capacity: 5, comfort: 'Basic', fatigueRecoveryMultiplier: 1, level: 1, moraleRecoveryBonus: 0, occupied: 2, upgradeCost: 12 }),
      { get: () => null },
      () => undefined,
      (heroId) => { inspectedMemorial = heroId; },
      () => undefined,
      () => undefined,
      () => undefined,
    );
    roster.open();
    const ledgerEntries = rosterHost.querySelectorAll('[data-memorial-hero-id]').length;
    const rosterCards = rosterHost.querySelectorAll('.hero-roster-card').length;
    rosterHost.querySelector('[data-memorial-hero-id]')?.click();
    roster.dispose();
    rosterHost.remove();
    const victoryManager = new HeroManager();
    const victoryHeroes = victoryManager.generateInitialRoster(3);
    const victorySquad = new SquadSystem();
    victoryHeroes.forEach((hero) => victorySquad.addHero(hero.id, victoryHeroes));
    const victoryCasualty = victoryHeroes[0];
    const victoryConsequences = victoryManager.applyExpeditionConsequences(
      victorySquad.getSquad(),
      {
        combatants: victoryHeroes.map((hero, index) => ({
          defeatedBy: index === 0 ? 'Rift Stalker' : null,
          hp: index === 0 ? 0 : 80,
          id: hero.id,
          kills: index === 1 ? 3 : 0,
          stats: { maxHp: 100 },
        })),
      },
      'Victory',
      3,
    );
    const victoryDeathResolved = !victoryManager.getById(victoryCasualty.id) &&
      victoryConsequences.some((entry) => entry.heroId === victoryCasualty.id && entry.permanent) &&
      victoryManager.getAll().every((hero) => hero.injuries.length === 0);
    globalThis.__phase15Record = record;
    return {
      activeHeroes: manager.getAll().length,
      activeSelectableCount,
      careerRecorded: record.expeditions === 1 && record.kills === 2 && record.daysAlive === 5,
      cause: record.causeOfDeath,
      consequencePermanent: consequences.some((entry) => entry.heroId === fallen.id && entry.permanent),
      deathNotice,
      graveCreated,
      lossMemory: friend.lossMemories[0]?.fallenHeroId === fallen.id,
      generalMemory: friend.memories.some((memory) => memory.type === 'ALLY_DIED' && memory.targetHeroId === fallen.id && memory.persistent),
      lossRelationship: friend.lossMemories[0]?.relationship,
      memorialLedger: ledgerEntries === 1 && inspectedMemorial === fallen.id,
      moraleLoss: Math.round(moraleBefore - friend.needs.morale),
      removedFromRoster: !manager.getById(fallen.id),
      removedFromSquad: removedFromSquad.includes(fallen.id) && squad.getSquad().members.length === 2,
      rosterCards,
      victoryDeathResolved,
    };
  })()`);
  assert(
    legacyValidation.activeHeroes === 2 && legacyValidation.activeSelectableCount === 2 &&
      legacyValidation.careerRecorded && legacyValidation.cause === 'Rift Stalker II' &&
      legacyValidation.consequencePermanent && legacyValidation.deathNotice && legacyValidation.graveCreated &&
      legacyValidation.generalMemory && legacyValidation.lossMemory && legacyValidation.lossRelationship === 'Trusted Friend' && legacyValidation.memorialLedger &&
      legacyValidation.moraleLoss >= 18 && legacyValidation.removedFromRoster && legacyValidation.removedFromSquad &&
      legacyValidation.rosterCards === 2 && legacyValidation.victoryDeathResolved,
    `Phase 15 legacy validation failed (${JSON.stringify(legacyValidation)}).`,
  );
  const victoryValidation = await evaluate(`(async () => {
    const { Simulation } = await import('/src/simulation/Simulation.ts');
    let last = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const simulation = new Simulation();
      const heroes = simulation.getHeroes().slice(0, 3);
      heroes.forEach((hero) => {
        hero.attributes.strength = 30;
        hero.attributes.endurance = 30;
        hero.attributes.agility = 30;
        hero.skills.sword = 20;
        hero.personality.aggression = 1;
        hero.personality.bravery = 1;
        simulation.addHeroToSquad(hero.id);
        simulation.setSquadRole(hero.id, 'Damage');
      });
      simulation.startExpedition();
      for (let step = 0; step < 10_000 && simulation.getExpeditionSnapshot().phase === 'Combat'; step += 1) {
        simulation.step(0.25);
      }
      const snapshot = simulation.getExpeditionSnapshot();
      last = { outcome: snapshot.report?.outcome, resources: snapshot.resources };
      if (last.outcome === 'Victory') return last;
    }
    return last;
  })()`);
  assert(
    victoryValidation.outcome === 'Victory' &&
      JSON.stringify(victoryValidation.resources) === JSON.stringify({ food: 20, medicine: 8, riftShards: 3, scrap: 18 }),
    `Expedition victory rewards failed (${JSON.stringify(victoryValidation)}).`,
  );
  const withdrawalResults = await evaluate(`(async () => {
    const [{ Simulation }, { CombatSimulation }] = await Promise.all([
      import('/src/simulation/Simulation.ts'),
      import('/src/combat/CombatSimulation.ts'),
    ]);
    const simulation = new Simulation();
    simulation.getHeroes().slice(0, 3).forEach((hero) => simulation.addHeroToSquad(hero.id));
    const withdrawalHeroes = simulation.getHeroes().map((hero) => ({
      ...hero,
      attributes: { agility: 10, endurance: 8, intelligence: 1, leadership: 1, strength: 1, willpower: 1 },
      personality: { ...hero.personality, aggression: 0, bravery: 0, loyalty: 0 },
      relationships: {},
      skillForge: { ...hero.skillForge, known: {}, loadout: { active: [], passive: [] } },
      skills: { defense: 0, leadership: 0, medicine: 0, spear: 0, sword: 0 },
      traits: [...hero.traits, 'Cowardly'],
    }));
    return [0.8, 1, 1.2, 1.4].map((strength) => {
      const combat = new CombatSimulation();
      combat.start(simulation.getSquad(), withdrawalHeroes, 'Withdrawal validation', strength);
      for (let step = 0; step < 10_000 && combat.getSnapshot().result === 'Running'; step += 1) combat.step(0.25);
      return combat.getSnapshot().result;
    });
  })()`);
  assert(withdrawalResults.includes("Withdrawn"), `Combat withdrawal path did not resolve in the validation matrix (${withdrawalResults.join(', ')}).`);
  assert(await evaluate("document.querySelectorAll('.hud-navigation button').length") === 4, "Primary navigation must contain four destinations.");
  assert(await evaluate("[...document.querySelectorAll('.system-panel')].every((panel) => panel.hidden || panel.querySelector('.expedition-overlay__panel')?.hidden)"), "Player panels must begin collapsed.");
  await screenshot("desktop-1440x900.png");

  await click('[data-build-action="enter"]');
  await waitFor("document.querySelector('.refuge-build')?.dataset.active === 'true'", "Refuge Build Mode");
  assert(await evaluate("document.querySelectorAll('[data-build-tool]').length") === 10, "Build Mode must expose eight starting structures plus trail paint and erase.");
  await click('[data-build-tool="dormitory"]');
  assert(await evaluate(`!document.querySelector('[data-build-action="rotate"]').disabled`), "A selected facility must expose accessible movement controls.");
  const rotationBefore = await evaluate("document.querySelector('.refuge-build__inspector > small').textContent");
  await click('[data-build-action="rotate"]');
  const rotationAfter = await evaluate("document.querySelector('.refuge-build__inspector > small').textContent");
  assert(rotationAfter !== rotationBefore, "Facility rotation control did not update the draft.");
  await screenshot("phase21-build-mode-1440x900.png");
  await click('[data-build-action="cancel"]');
  await click('[data-build-tool="trail"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 450, button: "left", buttons: 1, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 720, y: 450, button: "left", buttons: 0, clickCount: 1 });
  await waitFor("document.querySelector('.refuge-build__inspector > small').textContent.includes('1 trail segments')", "trail placement");
  assert(await evaluate(`!document.querySelector('[data-build-action="undo"]').disabled`), "Committed layout changes must expose Undo.");
  await click('[data-build-action="undo"]');
  await waitFor("document.querySelector('.refuge-build__inspector > small').textContent.includes('0 trail segments')", "trail undo");
  await click('[data-build-action="exit"]');
  await waitFor("document.querySelector('.refuge-build')?.dataset.active === 'false'", "Build Mode exit");

  await click('[data-hud-action="camera-settings"]');
  await waitFor("!document.querySelector('.camera-settings').hidden", "camera settings open");
  assert(await evaluate(`document.querySelector('[data-camera-scheme="ascent"]').getAttribute('aria-checked') === 'true'`), "ASCENT camera preset should be selected initially.");
  await click('[data-camera-scheme="prototype"]');
  assert(await evaluate(`document.querySelector('[data-camera-scheme="prototype"]').getAttribute('aria-checked') === 'true'`), "Prototype camera preset did not become selected.");
  assert(await evaluate(`localStorage.getItem('ascent.camera-control-scheme') === 'prototype'`), "Prototype camera preset was not saved.");
  await screenshot("camera-settings-1440x900.png");
  await click('[data-camera-action="close"]');
  await waitFor("document.querySelector('.camera-settings').hidden", "camera settings close");

  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "prototype camera baseline");
  const prototypeInitial = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  await click('[data-debug-action="close"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 430, button: "left", buttons: 1, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 830, y: 485, button: "left", buttons: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 830, y: 485, button: "left", buttons: 0, clickCount: 1 });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "prototype left orbit");
  const prototypeAfterOrbit = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  assert(prototypeAfterOrbit !== prototypeInitial && prototypeAfterOrbit.split(' · ')[0] === prototypeInitial.split(' · ')[0], `Prototype left-drag did not orbit (${prototypeInitial} -> ${prototypeAfterOrbit}).`);
  await click('[data-debug-action="close"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 430, button: "right", buttons: 2, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 720, y: 490, button: "right", buttons: 2 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 720, y: 490, button: "right", buttons: 0, clickCount: 1 });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "prototype right pan");
  const prototypeAfterPan = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  assert(prototypeAfterPan.split(' · ')[0] !== prototypeAfterOrbit.split(' · ')[0], `Prototype right-drag did not pan (${prototypeAfterOrbit} -> ${prototypeAfterPan}).`);
  await click('[data-debug-action="close"]');
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW', bubbles:true}))");
  await pause(180);
  await evaluate("window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW', bubbles:true}))");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "prototype WASD check");
  const prototypeAfterWasd = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  assert(prototypeAfterWasd === prototypeAfterPan, `WASD moved the Prototype camera (${prototypeAfterPan} -> ${prototypeAfterWasd}).`);
  await click('[data-debug-action="close"]');

  await click('[data-build-action="enter"]');
  await click('[data-build-tool="trail"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 700, y: 440, button: "left", buttons: 1, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 790, y: 500, button: "left", buttons: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 790, y: 500, button: "left", buttons: 0, clickCount: 1 });
  assert(await evaluate(`document.querySelector('.refuge-build__inspector > small').textContent.includes('0 trail segments')`), "Prototype left-drag painted a trail instead of orbiting in Build Mode.");
  await click('[data-build-action="exit"]');

  await click('[data-hud-action="camera-settings"]');
  await click('[data-camera-scheme="ascent"]');
  await click('[data-camera-action="close"]');
  assert(await evaluate(`localStorage.getItem('ascent.camera-control-scheme') === 'ascent'`), "ASCENT camera preset was not restored.");

  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer camera baseline");
  const cameraInitial = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  await click('[data-debug-action="close"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 430, button: "right", buttons: 2, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 840, y: 500, button: "right", buttons: 2 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 840, y: 500, button: "right", buttons: 0, clickCount: 1 });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer after pointer orbit");
  const cameraAfterOrbit = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  assert(cameraAfterOrbit !== cameraInitial && cameraAfterOrbit.split(' · ')[0] === cameraInitial.split(' · ')[0], `Right-drag did not orbit around a stable target (${cameraInitial} -> ${cameraAfterOrbit}).`);
  await click('[data-debug-action="close"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 430, button: "middle", buttons: 4, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 720, y: 490, button: "middle", buttons: 4 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 720, y: 490, button: "middle", buttons: 0, clickCount: 1 });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer after pointer pan");
  const cameraBeforePanel = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  assert(cameraBeforePanel.split(' · ')[0] !== cameraAfterOrbit.split(' · ')[0], `Middle-drag did not pan the camera (${cameraAfterOrbit} -> ${cameraBeforePanel}).`);
  const parseCamera = (value) => {
    const match = value.match(/^(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?) · (-?\d+)°/);
    if (!match) throw new Error(`Could not parse camera diagnostics: ${value}`);
    return { x: Number(match[1]), z: Number(match[2]), yaw: Number(match[3]) * Math.PI / 180 };
  };
  const beforePan = parseCamera(cameraAfterOrbit);
  const afterPan = parseCamera(cameraBeforePanel);
  const forwardDot = (afterPan.x - beforePan.x) * -Math.sin(beforePan.yaw)
    + (afterPan.z - beforePan.z) * -Math.cos(beforePan.yaw);
  assert(forwardDot < 0, `Middle-drag vertical pan was not inverted (${cameraAfterOrbit} -> ${cameraBeforePanel}).`);
  await click('[data-debug-action="close"]');
  await click('[data-hud-section="Heroes"]');
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 720, y: 430, button: "right", buttons: 2, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 600, y: 360, button: "right", buttons: 2 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 600, y: 360, button: "right", buttons: 0, clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseWheel", x: 100, y: 200, deltaX: 0, deltaY: 100 });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer over panel");
  const cameraDuringPanel = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  assert(cameraDuringPanel === cameraBeforePanel, "Camera moved while a player panel was active.");
  await click('[data-debug-action="close"]');
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'Escape', bubbles:true}))");
  await command("Input.dispatchMouseEvent", { type: "mouseWheel", x: 100, y: 200, deltaX: 0, deltaY: 100 });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer after camera movement");
  const cameraAfterRefuge = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  const activeAfterEscape = await evaluate("document.querySelector('[data-hud-section][aria-pressed=\"true\"]')?.dataset.hudSection");
  assert(cameraAfterRefuge !== cameraBeforePanel, `Camera did not resume after returning to the refuge (${cameraBeforePanel} -> ${cameraAfterRefuge}; active ${activeAfterEscape}).`);
  await click('[data-debug-action="close"]');

  await click('[data-hud-section="Heroes"]');
  await waitFor("!document.querySelector('.roster-panel').hidden", "Heroes panel");
  assert(await evaluate("document.querySelector('[data-roster-action=\"recruit\"]')?.disabled") === true, "Recruitment must begin blocked without Rift Shards.");
  assert(await evaluate("document.querySelector('[data-roster-count]')?.textContent") === "5 / 5", "Heroes must show authoritative occupied/capacity status.");
  assert(await evaluate("document.querySelector('[data-dormitory=\"occupancy\"]')?.textContent") === "5 / 5 beds", "Dormitory occupancy must be visible in Heroes.");
  assert(await evaluate("document.querySelector('[data-roster-action=\"upgrade-dormitory\"]')?.disabled") === true, "Dormitory upgrade must be blocked without Scrap.");
  assert(await evaluate("document.querySelector('[data-hud=\"heroes\"]')?.textContent") === "5/5", "Top status must show hero capacity.");
  assert(await evaluate("(() => { const food=Number(document.querySelector('[data-resource=\"food\"]')?.textContent); return food > 0 && food <= 12; })()") === true, "The Refuge must expose and consume the real Phase 20 Food stockpile.");
  assert(await evaluate("document.querySelector('[data-economy=\"demand\"]')?.textContent") === "5", "Provision status must show the five-hero daily Food demand.");
  await waitFor("document.querySelectorAll('.hero-roster-card img').length === 5", "procedural portraits", 20_000);
  const portraits = await evaluate("[...document.querySelectorAll('.hero-roster-card img')].map((image) => image.src)");
  assert(new Set(portraits).size === 5 && portraits.every((src) => src.startsWith("blob:")), "Each hero must receive a distinct cached procedural portrait.");
  assert(await evaluate("document.querySelectorAll('.hero-roster-card').length") === 5, "Roster must show all five heroes.");
  await screenshot("heroes-1440x900.png");
  await click('.hero-roster-card');
  await waitFor("!document.querySelector('.hero-detail-panel').hidden", "hero detail");
  assert(await evaluate("document.querySelectorAll('.hero-detail-tabs button').length") === 4, "Hero detail must expose four implemented tabs.");
  await click('[data-hero-tab="Training"]');
  assert(await evaluate("!document.querySelector('[data-hero-view=\"Training\"]').hidden"), "Training tab did not activate.");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'Escape', bubbles:true}))");
  await waitFor("!document.querySelector('.roster-panel').hidden && document.querySelector('.hero-detail-panel').hidden", "Escape return to roster");

  await click('[data-hud-section="Refuge"]');
  const recoveryUi = await evaluate(`(async () => {
    const [{ Simulation }, { InjurySystem }, { SelectionOverlay }] = await Promise.all([
      import('/src/simulation/Simulation.ts'),
      import('/src/heroes/InjurySystem.ts'),
      import('/src/ui/SelectionOverlay.ts'),
    ]);
    const simulation = new Simulation();
    const hero = simulation.getHeroes()[0];
    const injury = new InjurySystem().inflictExpeditionInjury(hero, 'Withdrawn', 0.82, 1);
    const overlay = new SelectionOverlay(
      document.querySelector('#app'),
      () => false,
      () => false,
      (heroId, injuryId) => simulation.treatHeroInjury(heroId, injuryId),
      () => simulation.getExpeditionSnapshot().resources.medicine,
      () => undefined,
    );
    overlay.showHero(hero, simulation.getHeroes(), 'Training');
    globalThis.__phase14Capture = overlay;
    return { injury: injury.type, medicine: simulation.getExpeditionSnapshot().resources.medicine };
  })()`);
  assert(await evaluate("document.querySelectorAll('.hero-injury').length === 1 && !document.querySelector('.hero-injury button').disabled"), "Recovery UI must show a treatable injury and Medicine cost.");
  await screenshot("phase14-recovery-1440x900.png");
  await evaluate("globalThis.__phase14Capture.dispose(); delete globalThis.__phase14Capture");
  const memorialUi = await evaluate(`(async () => {
    const { SelectionOverlay } = await import('/src/ui/SelectionOverlay.ts');
    const overlay = new SelectionOverlay(document.querySelector('#app'), () => false, () => false, () => false, () => 0, () => undefined);
    overlay.showMemorial(globalThis.__phase15Record);
    globalThis.__phase15Capture = overlay;
    return {
      cause: document.querySelector('.memorial-record section strong')?.textContent,
      rows: document.querySelectorAll('.memorial-record dl div').length,
    };
  })()`);
  assert(memorialUi.cause === 'Rift Stalker II' && memorialUi.rows === 6, "Memorial record must expose the fallen hero's real history.");
  await screenshot("phase15-memorial-1440x900.png");
  await evaluate("globalThis.__phase15Capture.dispose(); delete globalThis.__phase15Capture; delete globalThis.__phase15Record");

  await click('[data-hud-section="Party"]');
  await waitFor("!document.querySelector('.party-panel').hidden", "Party panel");
  for (let index = 0; index < 3; index += 1) {
    await click('.party-reserves__list [data-party-action="add"]');
    await pause(80);
  }
  assert(await evaluate("document.querySelectorAll('.party-hero-card').length") === 3, "Party must accept three heroes.");
  assert(
    await evaluate(`[...document.querySelectorAll('.party-hero-card__portrait')].every((portrait) =>
      portrait.dataset.portraitFraming === 'half-body' && getComputedStyle(portrait.querySelector('img')).transform !== 'none'
    )`),
    "Assigned Party heroes must use the dedicated half-body portrait framing.",
  );
  const before = await evaluate("[...document.querySelectorAll('.formation-slot')].map((slot) => slot.querySelector('.party-hero-card')?.dataset.heroId)");
  await evaluate(`(() => { const select = document.querySelectorAll('.party-card__controls [data-party-field="formation"]')[1]; select.value = 'Front'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  const after = await evaluate("[...document.querySelectorAll('.formation-slot')].map((slot) => slot.querySelector('.party-hero-card')?.dataset.heroId)");
  assert(after[0] === before[1] && new Set(after).size === 3, "Formation movement must swap occupants atomically.");
  await screenshot("party-1440x900.png");

  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer");
  assert(await evaluate("!document.querySelector('[data-debug-action=\"arena\"]').disabled"), "Arena must remain available from the developer drawer.");
  await click('[data-debug-action="arena"]');
  await waitFor("document.querySelector('.combat-overlay__panel') && !document.querySelector('.combat-overlay__panel').hidden", "Arena combat");
  assert(await evaluate("document.querySelectorAll('.combat-overlay__combatant').length") === 6, "Arena must render the existing 3v3 combatants.");
  await click('[data-combat-action="exit"]');
  await waitFor("document.querySelector('#app').dataset.mode === 'refuge' && document.querySelector('.combat-overlay__panel').hidden", "Arena refuge return");

  await click('[data-hud-section="Rift"]');
  await waitFor("!document.querySelector('.expedition-overlay__panel').hidden", "Rift briefing");
  assert(await evaluate("!document.querySelector('[data-expedition-action=\"deploy\"]').disabled"), "Complete party should enable deployment.");
  await click('[data-expedition-action="deploy"]');
  await waitFor("document.querySelector('.expedition-overlay__field-meta')", "active expedition");
  await waitFor("document.querySelector('[data-expedition-action=\"return\"]')", "expedition debrief", 120_000);
  const report = await evaluate("document.querySelector('.expedition-overlay__outcome strong')?.textContent");
  const resources = await evaluate("[...document.querySelectorAll('[data-resource]')].map((node) => Number(node.textContent))");
  assert(report, "Expedition did not produce a mission result.");
  assert(report !== "ROUTE SECURED" || (resources[0] === 18 && resources[1] >= 8 && resources[2] === 8 && resources[3] === 3), "Victory rewards and Medicine must reach the persistent top status bar.");
  await screenshot(report === "ROUTE SECURED" ? "rift-debrief-victory-1440x900.png" : "rift-debrief-setback-1440x900.png");
  await click('[data-expedition-action="return"]');
  await waitFor("document.querySelector('[data-hud-section=\"Refuge\"]').getAttribute('aria-pressed') === 'true'", "refuge return");

  await setViewport(1024, 768);
  await screenshot("tablet-1024x768.png");
  await setViewport(390, 844);
  await click('[data-hud-section="Heroes"]');
  await waitFor("document.querySelectorAll('.hero-roster-card').length === 5", "mobile roster");
  const columns = await evaluate("(() => { const cards=[...document.querySelectorAll('.hero-roster-card')]; return new Set(cards.slice(0,2).map((card)=>Math.round(card.getBoundingClientRect().top))).size === 1; })()");
  assert(columns, "Mobile roster must retain two columns.");
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert(await evaluate("getComputedStyle(document.querySelector('.hero-roster-card')).animationName === 'none'"), "Reduced motion preference must disable animations.");
  await screenshot("mobile-390x844.png");

  await click('[data-hud-section="Refuge"]');
  await click('[data-build-action="enter"]');
  await waitFor("document.querySelector('.refuge-build')?.dataset.active === 'true'", "mobile Refuge Build Mode");
  const mobileBuild = await evaluate(`(() => {
    const panel = document.querySelector('.refuge-build');
    const bounds = panel.getBoundingClientRect();
    const buttons = [...panel.querySelectorAll('button')];
    return {
      fits: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
      navHidden: getComputedStyle(document.querySelector('.hud-navigation')).display === 'none',
      touchTargets: buttons.filter((button) => !button.closest('header')).every((button) => button.getBoundingClientRect().height >= 42),
    };
  })()`);
  assert(mobileBuild.fits && mobileBuild.navHidden && mobileBuild.touchTargets, `Mobile Build Mode failed (${JSON.stringify(mobileBuild)}).`);
  await screenshot("phase21-build-mode-mobile-390x844.png");
  await click('[data-build-action="exit"]');

  await click('[data-hud-action="camera-settings"]');
  await waitFor("!document.querySelector('.camera-settings').hidden", "mobile camera settings");
  const mobileCameraSettings = await evaluate(`(() => {
    const panel = document.querySelector('.camera-settings__panel').getBoundingClientRect();
    const choices = [...document.querySelectorAll('[data-camera-scheme]')];
    return {
      fits: panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight,
      touchTargets: choices.every((choice) => choice.getBoundingClientRect().height >= 44),
    };
  })()`);
  assert(mobileCameraSettings.fits && mobileCameraSettings.touchTargets, `Mobile camera settings failed (${JSON.stringify(mobileCameraSettings)}).`);
  await screenshot("camera-settings-mobile-390x844.png");
  await click('[data-camera-action="close"]');

  assert(runtimeExceptions.length === 0, `Browser runtime exceptions: ${runtimeExceptions.join(" | ")}`);

  console.log(JSON.stringify({ outcome: report, resources, portraits: portraits.length, layout: layoutValidation, recovery: recoveryValidation, memory: memoryValidation, traits: traitValidation, recruitment: recruitmentValidation, economy: economyValidation, recoveryUi, legacy: legacyValidation, memorialUi, victory: victoryValidation, withdrawal: withdrawalResults, status: "passed" }));
} finally {
  socket?.close();
  browser.kill();
  server.kill();
  if (browser.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => browser.once("exit", resolve)),
      pause(2_000),
    ]);
  }
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
