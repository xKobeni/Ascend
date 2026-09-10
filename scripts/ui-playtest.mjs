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
  const withdrawalResults = await evaluate(`(async () => {
    const [{ Simulation }, { CombatSimulation }] = await Promise.all([
      import('/src/simulation/Simulation.ts'),
      import('/src/combat/CombatSimulation.ts'),
    ]);
    const simulation = new Simulation();
    simulation.getHeroes().slice(0, 3).forEach((hero) => simulation.addHeroToSquad(hero.id));
    const withdrawalHeroes = simulation.getHeroes().map((hero) => ({
      ...hero,
      personality: { ...hero.personality, aggression: 0, bravery: 0, loyalty: 0 },
      traits: [...hero.traits, 'Cowardly'],
    }));
    return [0.9, 1, 1.1, 1.2, 1.35].map((strength) => {
      const combat = new CombatSimulation();
      combat.start(simulation.getSquad(), withdrawalHeroes, 'Withdrawal validation', strength);
      for (let step = 0; step < 2_000 && combat.getSnapshot().result === 'Running'; step += 1) combat.step(0.25);
      return combat.getSnapshot().result;
    });
  })()`);
  assert(withdrawalResults.includes("Withdrawn"), `Combat withdrawal path did not resolve in the validation matrix (${withdrawalResults.join(', ')}).`);
  assert(await evaluate("document.querySelectorAll('.hud-navigation button').length") === 4, "Primary navigation must contain four destinations.");
  assert(await evaluate("[...document.querySelectorAll('.system-panel')].every((panel) => panel.hidden || panel.querySelector('.expedition-overlay__panel')?.hidden)"), "Player panels must begin collapsed.");
  await screenshot("desktop-1440x900.png");

  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer camera baseline");
  const cameraBeforePanel = await evaluate("document.querySelector('[data-debug=\"camera\"]').textContent");
  await click('[data-debug-action="close"]');
  await click('[data-hud-section="Heroes"]');
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

  await click('[data-hud-section="Party"]');
  await waitFor("!document.querySelector('.party-panel').hidden", "Party panel");
  for (let index = 0; index < 3; index += 1) {
    await click('.party-reserves__list [data-party-action="add"]');
    await pause(80);
  }
  assert(await evaluate("document.querySelectorAll('.party-hero-card').length") === 3, "Party must accept three heroes.");
  const before = await evaluate("[...document.querySelectorAll('.formation-slot')].map((slot) => slot.querySelector('.party-hero-card')?.dataset.heroId)");
  await evaluate(`(() => { const select = document.querySelectorAll('.party-card__controls [data-party-field="formation"]')[1]; select.value = 'Front'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  const after = await evaluate("[...document.querySelectorAll('.formation-slot')].map((slot) => slot.querySelector('.party-hero-card')?.dataset.heroId)");
  assert(after[0] === before[1] && new Set(after).size === 3, "Formation movement must swap occupants atomically.");
  await screenshot("party-1440x900.png");

  await click('[data-hud-section="Rift"]');
  await waitFor("!document.querySelector('.expedition-overlay__panel').hidden", "Rift briefing");
  assert(await evaluate("!document.querySelector('[data-expedition-action=\"deploy\"]').disabled"), "Complete party should enable deployment.");
  await click('[data-expedition-action="deploy"]');
  await waitFor("document.querySelector('.expedition-overlay__field-meta')", "active expedition");
  await waitFor("document.querySelector('[data-expedition-action=\"return\"]')", "expedition debrief", 120_000);
  const report = await evaluate("document.querySelector('.expedition-overlay__outcome strong')?.textContent");
  const resources = await evaluate("[...document.querySelectorAll('[data-resource]')].map((node) => Number(node.textContent))");
  assert(report, "Expedition did not produce a mission result.");
  assert(report !== "ROUTE SECURED" || resources.join(',') === "18,10,3", "Victory rewards must reach the persistent top status bar.");
  await screenshot(report === "ROUTE SECURED" ? "rift-debrief-victory-1440x900.png" : "rift-debrief-setback-1440x900.png");
  await click('[data-expedition-action="return"]');
  await waitFor("document.querySelector('[data-hud-section=\"Refuge\"]').getAttribute('aria-pressed') === 'true'", "refuge return");

  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code:'F3', bubbles:true}))");
  await waitFor("!document.querySelector('.debug-overlay').hidden", "developer drawer");
  assert(await evaluate("!document.querySelector('[data-debug-action=\"arena\"]').disabled"), "Arena must remain available from the developer drawer.");
  await click('[data-debug-action="arena"]');
  await waitFor("document.querySelector('.combat-overlay__panel') && !document.querySelector('.combat-overlay__panel').hidden", "Arena combat");
  assert(await evaluate("document.querySelectorAll('.combat-overlay__combatant').length") === 6, "Arena must render the existing 3v3 combatants.");

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

  assert(runtimeExceptions.length === 0, `Browser runtime exceptions: ${runtimeExceptions.join(" | ")}`);

  console.log(JSON.stringify({ outcome: report, resources, portraits: portraits.length, withdrawal: withdrawalResults, status: "passed" }));
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
