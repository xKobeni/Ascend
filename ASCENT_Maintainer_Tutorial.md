# ASCENT Maintainer Tutorial

This guide explains the ASCENT codebase as it exists after Phase 22. It is written for someone who
wants to learn the project, make changes without an AI assistant, and understand why the code is
organized the way it is.

Last verified against the repository: September 11, 2026.

Current implementation boundary:

```text
Implemented gameplay phases: 0–22
Implemented UI milestone: U1 — Current-System Client Foundation
Next gameplay phase: 23 — Equipment
Procedural Character Forge activation: human recruitment subset implemented
```

This file describes implemented code. Future features are clearly labelled so they are not mistaken
for working systems.

---

## 1. What You Need to Know Before Editing

ASCENT is a browser game built with:

- TypeScript for game logic and interface code
- Three.js for the 3D world
- Regular HTML elements created from TypeScript for the HUD and panels
- CSS for the full interface design
- Vite for the development server and production build

There is no React, Vue, game engine editor, external font package, database, or save system in the
current build. Most game state exists only in memory and resets when the browser page reloads.

You do not need to understand the entire repository before making a small change. You do need to
know which layer owns the value you want to change.

### The most important architectural rule

```text
Simulation state is the truth.
Three.js displays that truth.
The DOM interface lets the player inspect or request changes to that truth.
```

A hero's health must live on the `Hero` data object, not on a health-bar element or Three.js mesh.
A squad member's formation must live in `SquadSystem`, not only in the Party panel. A renderer may
read state, but it must not secretly become the authoritative game system.

---

## 2. Running the Project

Open PowerShell in the project directory:

```powershell
Set-Location 'C:\Users\johna\OneDrive\Desktop\Ascent'
```

If dependencies have not been installed on the machine, run:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Vite prints a local URL, normally similar to `http://localhost:5173`. Open that address in a
browser. Vite automatically refreshes modules after you save a source file.

### Validation commands

Use these after a change:

```powershell
npm run check
npm run build
git diff --check
```

What each command proves:

- `npm run check` runs the strict TypeScript checker without producing a build.
- `npm run build` type-checks and creates the production `dist` bundle.
- `git diff --check` finds whitespace errors in changed files.

For the existing automated browser smoke test:

```powershell
npm run playtest:ui
```

The playtest script is `scripts/ui-playtest.mjs`. It currently expects Microsoft Edge at:

```text
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
```

It launches a temporary headless browser, exercises the major UI and gameplay paths, and writes
screenshots under `artifacts/ui-redesign/`. If Edge is installed elsewhere, update `browserPath` in
the script. This smoke test is the project's current test harness; there is no separate `tests/`
directory yet.

### Current player controls

- **ASCENT Default:** `WASD` pans, right-drag orbits, middle-drag pans.
- **Prototype:** left-drag orbits, right-drag pans, middle-drag zooms, and `WASD` camera movement is off.
- Pan uses the accepted inverted forward/backward pointer direction in both presets.
- `Q`, `E`: rotate the Refuge camera
- Mouse wheel: zoom
- Short-click a selectable world object: inspect it
- `Escape`: close the active player panel or return to Refuge
- `F3`: open or close developer diagnostics

Mouse gestures are captured by the canvas, so a drag continues cleanly if the pointer leaves its
bounds. Under Prototype controls, a left movement beyond six pixels becomes orbit; a shorter action
remains selection or Build Mode placement. Camera and world selection intentionally pause while a
player panel, settings panel, or developer drawer is being operated.

The current camera follows the approved base prototype's 42-degree perspective, approximately
`(38, 40, 46)` opening position, 14–130 zoom range, broad pitch range, and damped OrbitControls-like
response. `CameraController.update()` applies exponential, frame-rate-independent damping; do not
replace it with a fixed per-frame `lerp` factor. `CameraSettingsOverlay` owns the UI-only saved
preference, while `Renderer.setCameraControlScheme()` keeps camera and Build Mode mappings aligned.

---

## 3. The Project Map

```text
Ascent/
├─ index.html                     Browser entry document
├─ package.json                   Commands and dependencies
├─ tsconfig.json                  Strict TypeScript rules
├─ ASCENT_Full_Game_Concept.md    Long-term game design
├─ ASCENT_Development_Phases.md   Phase order and scope boundaries
├─ ASCENT_Maintainer_Tutorial.md  This guide
├─ scripts/
│  └─ ui-playtest.mjs             Automated browser smoke test
└─ src/
   ├─ main.ts                     Creates and starts the Game
   ├─ styles.css                  All current interface styling
   ├─ core/                       App lifecycle, clock, renderer, events, RNG
   ├─ simulation/                 Top-level gameplay facade
   ├─ heroes/                     Hero state and living-Refuge systems
   ├─ skills/                     Skill definitions, discovery, loadouts, progression
   ├─ squads/                     Party membership, roles, formation, evaluation
   ├─ combat/                     Combat data, formation effects, Utility AI, simulation
   ├─ expeditions/                Mission state, rewards, consequences, debrief
   ├─ base/                       World navigation points
   ├─ rendering/                  Three.js world, camera, selection, heroes, portraits
   └─ ui/                         DOM HUD, panels, notifications, diagnostics
```

### Where to start for different changes

| Desired change | Start here |
| --- | --- |
| Change a hero field | `src/heroes/Hero.ts` |
| Change generated heroes | `src/heroes/HeroGenerator.ts` |
| Add or rebalance an occupation | `src/heroes/OccupationDefinitions.ts` |
| Change needs and daily behavior | `src/heroes/NeedsSystem.ts` and `HeroRoutineSystem.ts` |
| Change hero destinations | `src/base/NavigationPoints.ts` |
| Change training | `src/heroes/TrainingSystem.ts` |
| Change injuries or treatment | `src/heroes/InjurySystem.ts` |
| Add or change a skill | `src/skills/SkillDefinitionRegistry.ts` |
| Change party rules | `src/squads/SquadSystem.ts` |
| Change combat decisions | `src/combat/UtilityAI.ts` |
| Change combat math | `src/combat/CombatSimulation.ts` |
| Change the first mission | `src/expeditions/ExpeditionSystem.ts` |
| Change a 3D hero | `src/rendering/heroes/HeroMeshGenerator.ts` |
| Change Refuge scenery | `src/rendering/ProceduralBaseScene.ts` |
| Fix a floating structure, prop, or hero | `src/rendering/RefugeGround.ts`, then its render factory |
| Change camera controls | `src/rendering/CameraController.ts` |
| Change primary navigation | `src/ui/HudShell.ts` and `src/core/Game.ts` |
| Change hero details | `src/ui/SelectionOverlay.ts` |
| Change visual styling | `src/styles.css` |
| Change notifications | `src/ui/NotificationCenter.ts` |

---

## 4. How the Game Starts

The startup chain is deliberately short:

```text
index.html
  ↓ loads
src/main.ts
  ↓ creates
new Game(#app)
  ↓ creates
Simulation + Renderer + UI overlays
  ↓ starts
requestAnimationFrame loop
```

`index.html` contains the single `#app` element. `src/main.ts` finds it, creates `Game`, and calls
`game.start()`.

During Vite hot-module replacement, `main.ts` calls `game.dispose()`. That cleanup is important:
event listeners, animation frames, WebGL resources, portrait URLs, and DOM elements must not survive
when the module reloads.

### `Game` is the application coordinator

`src/core/Game.ts` connects every major layer. It:

- Owns one `Simulation`
- Owns one `Renderer`
- Creates the HUD and panels
- Connects UI actions to simulation methods
- Routes world selections into shared detail panels
- Ensures only one player section is active
- Pauses camera interaction while panels are open
- Advances and renders the game every frame
- Disposes every owned component during teardown

Avoid putting detailed combat, relationship, or training rules inside `Game`. Add those rules to the
relevant system and expose a small method through `Simulation`.

---

## 5. Understanding the Game Loop

The browser calls `Game.frame(timestampMs)` through `requestAnimationFrame`.

The frame performs this order:

```text
1. GameClock receives browser time
2. GameClock runs zero or more fixed simulation steps
3. Game reads combat and expedition state
4. Renderer draws the correct scene
5. HUD and open panels refresh from current snapshots
6. Browser schedules the next frame
```

### Why `GameClock` uses a fixed step

`src/core/GameClock.ts` defaults to a simulation step of `1 / 20` seconds, or 20 simulation updates
per real second. Rendering can still happen at the monitor's refresh rate.

This prevents gameplay speed from directly depending on frame rate. The clock also:

- Clamps one browser frame to at most 0.25 seconds
- Runs at most five simulation steps during one rendered frame
- Drops excess accumulated time after hitting the safety limit
- Resets after the browser tab becomes visible again

When adding gameplay logic, use the supplied `deltaSeconds` or `gameMinutes`. Do not assume one call
equals one second.

### Game time scale

`src/simulation/Simulation.ts` currently uses:

```ts
const STARTING_MINUTE = 7 * 60;
const GAME_MINUTES_PER_REAL_SECOND = 12;
```

The Refuge starts at Day 1, 07:00. One real second advances twelve in-game minutes while normal
Refuge simulation is running.

Time behaves differently by mode:

- Refuge briefing state: world time, needs, routines, relationships, training, and recovery advance.
- Expedition combat: expedition and combat advance; the Refuge simulation is paused.
- Expedition debrief: simulation is frozen until the player returns.
- Developer Arena: combat advances, but normal Refuge time is paused.

---

## 6. The Simulation Facade

`src/simulation/Simulation.ts` is the main API between `Game` and gameplay systems.

It owns:

- `HeroManager`
- `SquadSystem`
- `CombatSimulation`
- `ExpeditionSystem`
- The day, time, elapsed seconds, tick, and displayed hero count

The UI should call methods such as:

```ts
simulation.queueTraining(heroId, type);
simulation.addHeroToSquad(heroId);
simulation.moveHeroToSquadFormation(heroId, formation);
simulation.startExpedition();
```

This is better than allowing a panel to mutate internal arrays directly. The system method can
validate the request and preserve invariants.

### A useful modification pattern

When adding a new player action:

1. Add the rule to the owning gameplay system.
2. Expose a small wrapper method on `Simulation`.
3. Pass a callback from `Game` into the relevant UI class.
4. Let the UI call the callback.
5. Render the result by reading a snapshot.

That pattern already exists for training, injury treatment, skill loadouts, party changes, Arena,
and expeditions.

---

## 7. Hero Data and Generation

### The hero schema

`src/heroes/Hero.ts` is the central contract. A `Hero` currently contains:

- Identity: ID, name, age, level, rank
- Appearance: proportions, colors, hair, gender
- Origin: occupation, category, rarity, aptitudes
- Core attributes and legacy numeric skills
- Personality and traits
- Hidden potential
- Skill Forge state and loadout
- Needs, movement, and current activity
- Relationships and relationship histories
- Training queue and outcome
- Injuries and recovery outcome
- Career totals
- Loss memories created by permanent death
- Current class, social role, and reputation placeholders already required by implemented identity

The only current `HeroClass` value is `Unclassified`, and the only current `SocialRole` is
`Resident`. Do not add player-facing class choices before Phase 25.

### How initial heroes are created

`HeroManager.generateInitialRoster(5)` calls `HeroGenerator.generate(...)` until five heroes exist.
It also assigns one of five initial world positions and prevents duplicate generated names.

`HeroGenerator` creates data in this order:

1. Pick a weighted occupation.
2. Generate base attributes and apply occupation modifiers.
3. Generate legacy skill values and apply occupation modifiers.
4. Generate personality values.
5. Generate hidden potential.
6. Derive the strongest one to three traits.
7. Build the origin record.
8. Generate the personal Skill Forge.
9. Generate age and appearance.
10. Create needs, movement, training, career, reputation, and recovery defaults.

The generator uses `src/core/Random.ts`, not `Math.random()`. `Random.fromEntropy()` creates a fresh
seed using browser crypto, and all choices made by that generator use the same RNG instance.

### Important determinism limitation

The current initial game does not store the generated seed. Reloading creates a new roster. The
implemented Procedural Character Forge stores the recruitment seed and reproducible appearance configuration,
but that is not implemented yet.

---

## 8. Safe Recipe: Add an Occupation

Open `src/heroes/OccupationDefinitions.ts`. Every occupation follows `OccupationDefinition`:

```ts
{
  name: "Example Occupation",
  category: "Skilled",
  rarity: "Specialized",
  selectionWeight: 3,
  aptitudes: ["First aptitude", "Second aptitude"],
  attributeModifiers: { intelligence: 1, willpower: 1 },
  skillModifiers: { medicine: 2 },
  visualModifiers: { shoulderWidth: 0.96 },
}
```

Procedure:

1. Choose an existing `OriginCategory` and `OriginRarity` from `Hero.ts`.
2. Give the occupation a positive `selectionWeight`.
3. Keep attribute and skill keys within their existing interfaces.
4. Remember that modifiers are capped at 10 by `HeroGenerator.applyModifiers`.
5. Use `visualModifiers` only if `HeroMeshGenerator` actually reads that field.
6. Run type-check and build.
7. Reload several times and inspect generated heroes.

Weights are relative, not percentages. An occupation with weight 8 appears roughly eight times as
often as one with weight 1 across a large number of rolls. Adding a high weight also makes every
other occupation proportionally less common.

Do not make an occupation automatically select a class. In ASCENT, occupation means what the hero
did before the Rift; class means what the hero becomes later.

---

## 9. Safe Recipe: Change Hero Appearance

Appearance has three related locations:

1. `HeroAppearance` in `src/heroes/Hero.ts` defines stored fields.
2. `HeroGenerator.generateAppearance` chooses values.
3. `HeroMeshGenerator` turns the values into Three.js geometry.

If you only change the generator, existing fields render differently but new fields do nothing. If
you only change the mesh generator, the renderer may have no authoritative value to read.

For a new appearance field:

1. Add the typed field to `HeroAppearance`.
2. Generate a valid value in `HeroGenerator`.
3. Read it in `HeroMeshGenerator`.
4. Include it in `HeroPortraitCache.getSignature` if it changes the portrait.
5. Check live world models and roster portraits.
6. Verify cleanup still disposes replaced resources.

Existing body width is influenced by strength and agility. Height varies by gender and age. Hair
style determines hair length, and older heroes may receive gray hair.

Do not store level, class, stats, inventory, or combat decisions in a mesh's `userData`. The mesh is
only a view of the hero.

---

## 10. Living Refuge Behavior

The living Refuge loop is distributed across four files:

- `NeedsSystem.ts`: values change and urgent needs override schedules.
- `HeroRoutineSystem.ts`: chooses scheduled activity and moves heroes.
- `NavigationPoints.ts`: defines physical destinations.
- `HeroRenderer.ts`: moves and animates the visible model.

### Daily schedule

```text
06:00–09:59  Morning  → Eating
10:00–16:59  Day      → Training
17:00–21:59  Evening  → Socializing
22:00–05:59  Night    → Resting
```

Urgent needs can override this schedule. For example, a recovering injury sends a hero to the
Infirmary when hunger is not critically low. Training assignments use more forgiving interruption
thresholds so a player-directed task is not cancelled too easily.

### Navigation points must stay synchronized with scenery

The campfire, dormitory, training area, and infirmary have coordinates in both procedural scenery
and navigation data. If you move a building visually, move its related navigation points and routine
focus coordinates too. Otherwise heroes walk to the old location.

Each generated roster index currently expects a matching destination point. If you increase the
initial roster above five before adding points or changing allocation logic, the routine system may
throw an error.

---

## 11. Needs, Relationships, and Training

### Needs

Needs are numbers clamped between 0 and 100:

- `health`: higher is better
- `morale`: higher is better
- `hunger`: higher means more satisfied, not more hungry
- `social`: higher means socially satisfied
- `fatigue`: higher is worse
- `stress`: higher is worse

This naming can be confusing. In particular, decreasing `hunger` means the hero is becoming hungry.

`NeedsSystem.updateHero` contains the hourly rates. When changing them, remember the method receives
game hours, not real seconds.

### Relationships

Every directed hero pair has separate metrics:

```text
affinity: -100 to 100
fear, jealousy, respect, rivalry, trust: 0 to 100
```

`RelationshipSystem.initialize` creates the pair records. Later social interactions update both
directions, record short histories, and add settlement events. The system retains at most twelve
recent global events and eight history entries per relationship profile.

`getRelationshipLabel` converts the metrics into labels shown in Heroes and Party. When adding a new
relationship metric, update its data interface, initialization, interaction rules, labels, squad
chemistry if relevant, UI, and future save schema.

### Training

A hero can occupy at most three training slots total: one active assignment plus queued assignments.

Current training types:

- Strength Training
- Weapon Training
- Defense Training

Training progresses only while the hero has physically reached the Training activity. Recovering
injuries block new training. Fatigue above 72 can create an hourly injury check. Completion either
raises Strength or drives skill discovery and progression.

To add a training type, update at least:

1. `TrainingType` in `Hero.ts`.
2. Training buttons and label list in `SelectionOverlay.ts`.
3. Completion behavior in `TrainingSystem.completeAssignment`.
4. Any injury restriction rules.
5. Automated playtest coverage.

Avoid adding only a button. A button without an authoritative completion rule is not an implemented
training system.

---

## 12. Skill Forge

Do not confuse the implemented **Hero Skill Forge** with the **Procedural Character Forge**.

- Hero Skill Forge: implemented Phase 12 system for skills and progression.
- Procedural Character Forge: Phase 18 human appearance and recruitment pipeline.

### Skill data flow

```text
SkillDefinitionRegistry
  ↓ defines every skill
HeroSkillGenerator
  ↓ gives each new hero known skills and affinities
SkillDiscoverySystem
  ↓ unlocks skills when requirements are met
SkillLoadoutSystem
  ↓ prepares active/passive skills
SkillProgressionSystem
  ↓ awards XP and levels
Combat / Training / Expedition
  ↓ report supported usage events
NotificationCenter
  ↓ detects discoveries and level increases
```

Current loadout capacity is four active/utility skills and four passive skills. Reaction skills are
automatically available when known and cannot be manually toggled.

XP required for the next level is:

```ts
48 + level * 18
```

### Safe recipe: add a skill

Add a `SkillDefinition` in `src/skills/SkillDefinitionRegistry.ts`:

```ts
{
  id: "example_skill",
  name: "Example Skill",
  description: "What the skill represents.",
  affinity: "defense",
  category: "combat",
  rarity: "uncommon",
  type: "passive",
  maxLevel: 10,
  prerequisites: [
    { kind: "attribute", attribute: "endurance", minimum: 4 },
  ],
}
```

Then decide:

- How the hero initially discovers it
- Which action produces usage events
- Whether it must be prepared
- What gameplay calculation reads it
- Whether it evolves from or into another skill
- How the UI explains its effect

Registering a definition alone makes data available but does not automatically give the skill a
gameplay effect.

---

## 13. Injuries, Recovery, and Permanent Death

### Injury state

`InjurySystem.ts` owns:

- Injury definitions and modifiers
- Training injuries
- Expedition injuries
- Permanent-injury chance
- Treatment costs
- Resting recovery
- Training restrictions

Treatment consumes Medicine through `Simulation.treatHeroInjury`. The order matters: the injury
system first validates and marks treatment, then `ExpeditionSystem.consumeMedicine` deducts the
resource. Do not let the UI subtract Medicine itself.

Non-permanent injuries recover only while the hero is resting. Treatment accelerates recovery.
Permanent injuries keep a reduced lasting modifier after treatment.

### Death and legacy

An expedition combatant at zero HP becomes a permanent casualty, even if the overall squad wins.
`HeroManager.applyExpeditionConsequences`:

1. Records expedition and combat career data.
2. Finds zero-HP squad members.
3. Creates immutable memorial records through `LegacySystem`.
4. Applies morale loss and loss memories to close survivors.
5. Removes fallen heroes from the active roster.
6. Returns consequence rows for the debrief.

Afterward, `Simulation.syncActiveRoster` removes missing heroes from the active squad. The renderer
removes their live mesh, and `ProceduralBaseScene.syncMemorials` creates selectable Refuge markers.

There is still no disk save. Memorials survive only for the current browser session.

---

## 14. Party and Formation

`SquadSystem.ts` owns one squad with a maximum size of three.

Current formations:

- Front
- Middle
- Back

Current roles:

- Vanguard
- Damage
- Support

Current doctrine:

- Balanced

The first, second, and third added heroes receive default formation and role pairs. The Party panel
can then change them.

### Atomic formation movement

Use `moveHeroToFormation`, not the simpler `setFormation`, for player-facing movement. If the target
slot is occupied, `moveHeroToFormation` swaps the two occupants. It preserves unique formation slots,
assigned roles, and the three-member limit.

The Party panel supports both drag-and-drop and `select` controls. Keep both paths when changing the
layout; drag-and-drop alone is not keyboard-accessible.

Assigned hero cards mark their portrait container with `data-portrait-framing="half-body"`. The CSS
zooms and anchors the existing cached still around the upper body; it does not generate a second
portrait. Keep the crop on `.party-hero-card__portrait img` so Heroes and recruitment retain their
own framing.

### Squad readiness

The squad is complete when it has three valid heroes. It is ready only when complete and no assigned
hero has a recovering injury.

The evaluation also calculates:

- Combat power
- Defense
- Healing
- Average level
- Recovering member count
- Relationship-based cohesion and trust
- Chemistry label

Changing evaluation math affects the Party summary and expedition availability, so validate both.

---

## 15. Combat and Utility AI

Combat is an observed simulation. The player configures heroes beforehand but does not click an
attack button every turn.

### Combat pipeline

```text
Squad member
  ↓ formation + role
FormationSystem
  ↓ tactical role + adjusted stats
CombatSimulation
  ↓ combatant state and ticks
UtilityAI
  ↓ scores valid hero actions
CombatSimulation
  ↓ moves, attacks, heals, protects, retreats
CombatArenaScene + overlays
  ↓ display only
```

Hero Utility AI scores:

- Attack
- Defend
- Retreat
- Protect
- Heal
- Reposition

The chosen action is the highest-scoring valid action. Personality, current health, threat,
formation, party role, prepared skills, traits, and relationships influence the scores.

Enemies currently use simpler deterministic behavior: approach the nearest living opponent, attack
in range, and sometimes defend at low health.

### Combat timing and safety limits

Combat advances in 0.1-second ticks, with at most ten combat steps per call. It stores at most ten
log entries. Combat withdraws at 600 ticks if neither side finishes, preventing endless encounters.

### Safe recipe: rebalance damage

The final damage calculation is in `CombatSimulation.calculateDamage`. Hero base combat stats are
built in `getHeroStats`. Formation modifiers are in `FormationSystem.applyFormationStats`.

Change only one layer at a time:

1. Hold the test squad constant.
2. Change a single coefficient.
3. Run multiple Arena battles.
4. Check Vanguard, Damage, and Support roles.
5. Check injury modifiers.
6. Check victory, defeat, and withdrawal paths.
7. Confirm skill usage still records only supported actions.

Large simultaneous changes make it difficult to learn which coefficient caused the result.

---

## 16. Expedition System

`ExpeditionSystem.ts` currently contains one mission: **Transit Yard Suppression**.

Expedition state has three phases:

```text
Briefing → Combat → Debrief → Briefing
```

Starting requires:

- The system is in Briefing
- Exactly three squad members
- Every member exists in the active roster
- No assigned hero has a recovering injury
- Combat accepts the start request

Victory grants the mission's defined Food, Rift Shards, and Scrap. Withdrawal or defeat grants no
mission resources and applies persistent health, morale, fatigue, and injury consequences to living
heroes. Zero-HP heroes become memorial records.

The initial stockpile is:

```text
Food: 0
Medicine: 6
Rift Shards: 0
Scrap: 0
```

### Safe recipe: edit the first mission

Change `FIRST_MISSION` in `src/expeditions/ExpeditionSystem.ts`.

You may safely modify its name, description, threats, difficulty, and reward values. If you add a
new objective string, update the `ExpeditionMission` objective type and any UI assumptions.

Do not add several missions only as decorative cards. Multiple expedition types belong to Phase 28,
and procedural mission generation belongs to Phase 29.

---

## 17. Three.js Rendering

`src/core/Renderer.ts` owns the WebGL renderer, camera, Refuge scene, combat scene, camera controller,
selection raycaster, hero renderer, and combat arena renderer.

### Two 3D scenes

- Refuge scene: base, living heroes, memorials, world selection
- Combat scene: Arena combatants and combat presentation

`Renderer.render` chooses the scene based on the combat snapshot. `Renderer.syncInputState` enables
camera and selection only when normal Refuge interaction is allowed.

### Current renderer settings

- Antialiasing enabled
- Pixel ratio capped at 2
- sRGB output color space
- Shadow maps enabled with PCF shadows
- ACES filmic tone mapping
- Resize handled by `ResizeObserver`
- WebGL context loss and restoration reported to developer diagnostics

### Resource cleanup rule

Every Three.js object you create may own resources that JavaScript garbage collection does not
release automatically. When removing procedural content, dispose its:

- Geometry
- Material or material array
- Textures created specifically for it
- Render targets
- Event listeners
- Temporary renderer if one was created

Then remove the object from its parent. Follow existing `dispose()` methods in the base scene, hero
renderer, portrait cache, and combat scene.

---

## 18. Safe Recipe: Add a Selectable Refuge Prop

Add the mesh in `ProceduralBaseScene.ts`. A simplified pattern is:

```ts
private addExampleProp(): void {
  const group = this.createSelectableGroup({
    category: "prop",
    id: "example-prop",
    label: "Example Prop",
    detail: "A short player-facing description.",
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: "#747b5d", roughness: 0.9 }),
  );
  mesh.castShadow = true;
  group.add(mesh);
  group.position.set(5, 1, 5);
}
```

Call the method from the constructor after lighting and ground are ready.

Important checks:

1. Give every selectable object a unique stable ID.
2. Use an existing `SelectionDetails.category` or deliberately update that union.
3. Keep the prop inside the base scene root so normal disposal reaches it.
4. Confirm clicking opens the generic selection panel.
5. Confirm clicking empty ground clears the selection.
6. Confirm panels disable world selection.

The current selection highlight color in `SelectionRaycaster` is older cyan styling. If changing it,
use a non-glow state that matches the bronze/olive/burgundy/slate client palette and verify contrast
against the 3D world.

---

## 19. Procedural Hero Models and Portraits

`HeroMeshGenerator.ts` builds each low-poly hero from primitives and returns a `HeroRig` containing
the root object and animation reference joints.

`HeroRenderer.ts`:

- Creates one rig per active hero
- Adds it to the Refuge scene and selection list
- Synchronizes world position and facing
- Animates visible activity
- Removes and disposes rigs for heroes no longer in the roster

`HeroPortraitCache.ts` creates portrait stills from those same real hero models. It uses one temporary
offscreen renderer, caches URLs by hero and appearance signature, then disposes the renderer. It
revokes generated object URLs during teardown. If portrait creation fails, roster components display
an abstract initial mark.

When changing appearance, test all three representations:

- Live Refuge hero
- Heroes roster portrait
- Party card portrait

The Procedural Character Forge extends this shared path instead of creating a second,
unrelated hero renderer.

---

## 20. DOM UI Architecture

Every UI class creates and owns a normal HTML element. Constructors receive:

- The root container
- Read-only getter functions for current data
- Narrow action callbacks for valid mutations

This dependency style prevents a panel from owning the simulation.

### Stable player navigation

`HudSection` currently allows exactly:

```ts
type HudSection = "Heroes" | "Party" | "Refuge" | "Rift";
```

`Game.activateHudSection` closes the other panels before opening one. Active expedition and combat
states block normal navigation. Do not add Facilities, Inventory, Summon, or Spire buttons before
their gameplay phases exist.

### Current surfaces

- `HudShell`: time, resources, hero count, four-item navigation
- `HeroRosterOverlay`: All, Ready, Training, Recovering filters and memorial ledger
- `SelectionOverlay`: shared hero, memorial, facility, prop, and base details
- `SquadOverlay`: formation, roles, reserves, evaluation, drag-and-drop
- `ExpeditionOverlay`: briefing, field status, report, and return
- `CombatOverlay`: developer Arena details and Utility AI debugging
- `NotificationCenter`: social, training, injury, recovery, skill, expedition, and death notices
- `DebugOverlay`: FPS, tick, time, routine, heroes, camera, renderer, and Arena launch
- `ControlsHint`: temporary camera help

`SocialLogOverlay.ts` exists but is not constructed by `Game`. Treat it as inactive/legacy UI unless
you deliberately reconnect it and verify that it does not duplicate the notification center.

### Preventing unsafe HTML

Several panels render template strings. Dynamic player or generated text must go through the local
`escape` helper before being placed inside `innerHTML`. Prefer creating DOM nodes and assigning
`textContent` when practical.

---

## 21. Safe Recipe: Change or Add a UI Panel

For an existing panel:

1. Find the UI class in `src/ui`.
2. Identify its read getters and action callbacks.
3. Change structure in its render method or constructor template.
4. Change matching selectors in `styles.css`.
5. Preserve labels, button types, focus behavior, and keyboard alternatives.
6. Check desktop, tablet, and mobile.

For a new phase-backed panel:

1. Define its state and rules in a gameplay system.
2. Expose getters and actions through `Simulation`.
3. Create a UI class that only reads getters and invokes actions.
4. Construct it in `Game`.
5. Add it to the exclusivity and Escape flow.
6. Gate camera and world selection while it is active.
7. Dispose its listeners and DOM nodes.

Do not add a permanent navigation destination simply because you made a panel. The four primary
destinations are intentionally stable. Future systems should usually appear contextually inside
Heroes, Party, Refuge, or Rift.

---

## 22. Styling and Responsive Design

All current UI styling is in `src/styles.css`.

The main design tokens are declared in `:root`:

```css
--ink: #e7e1d4;
--ground: #151513;
--panel: #1d1d1a;
--raised: #26251f;
--bronze: #a78652;
--olive: #747b5d;
--burgundy: #7a4545;
--slate: #697282;
```

Use tokens instead of scattering new colors through selectors. State must not be communicated by
glow alone. Keep visible text, borders, labels, or icons as additional cues.

Responsive breakpoints currently exist at:

- `900px`: compact top bar and stacked Party summary
- `620px`: mobile navigation, full-width panels, two-column hero roster, vertical formation slots

Reduced-motion preferences shorten transitions and animations through
`@media (prefers-reduced-motion: reduce)`.

When changing CSS, manually inspect approximately:

```text
1440 × 900  desktop
1024 × 768  compact/tablet
390 × 844   phone
```

Check overflow, readable text, focus outlines, at least comfortable touch targets, and how much of
the 3D playfield remains visible.

---

## 23. Notifications

`NotificationCenter` detects changes by comparing the current state with maps of previously observed
values. It does not own the events that caused those changes.

It watches:

- New relationship events
- Training outcome changes
- Injury and recovery changes
- New skills and skill levels
- Expedition phase changes
- New memorial records

Ordinary notices remain compact and expire. Skill discovery uses a larger ceremonial notice with
View and Dismiss actions. Death notices remain restrained but last longer.

If adding a notification:

1. Find an authoritative state change or event ID.
2. Initialize the previous-state baseline so boot does not announce old data.
3. Detect only transitions, not the same state every frame.
4. Choose a truthful neutral, success, or danger tone.
5. Avoid making the notification the only record of an important result.

---

## 24. Developer Diagnostics

Press `F3` to open `DebugOverlay`.

It shows:

- Frames per second
- Simulation tick
- World day and time
- Routine period
- Active hero count
- Camera target, yaw, and distance
- WebGL renderer status
- Arena launch action

The Arena remains Phase 9 developer tooling and is intentionally absent from player navigation.
Launching it requires a complete squad and no active expedition or combat.

Use diagnostics to answer a specific question. For example, if camera motion seems broken, confirm
whether a panel has intentionally gated input before editing camera math.

---

## 25. Implemented Phase Summary

| Phase | Implemented result | Main code |
| --- | --- | --- |
| 0 | Vite/TypeScript foundation, loop, diagnostics | `main.ts`, `core/` |
| 1 | Procedural Refuge, camera, selection | `rendering/`, `base/` |
| 2 | Generated low-poly heroes | `HeroGenerator`, hero rendering |
| 3 | Identity, stats, personality, traits, origins | `Hero.ts`, generation definitions |
| 4 | Hero movement and schedules | `HeroRoutineSystem`, navigation points |
| 5 | Needs and behavioral overrides | `NeedsSystem` |
| 6 | Directed relationships and social events | `RelationshipSystem` |
| 7 | Training queue and progress | `TrainingSystem` |
| 8 | Three-member squad | `SquadSystem` |
| 9 | Developer combat Arena | combat simulation and Arena rendering |
| 10 | Utility-scored hero AI | `UtilityAI` |
| 11 | Roles and Front/Middle/Back tactics | `FormationSystem` |
| 12 | Skill generation, discovery, loadout, XP | `skills/` |
| 13 | First Rift expedition | `expeditions/` |
| U1 | Unified current-system dark-fantasy client | `ui/`, `styles.css`, `Game.ts` |
| 14 | Injury, treatment, and recovery | `InjurySystem` |
| 15 | Permanent death, memorials, survivor loss | `LegacySystem`, consequence flow |
| 16 | Typed memories, decay, relationship and Utility AI influence | `memories/`, `UtilityAI` |
| 17 | Earned traits, provenance, and bounded personality drift | `TraitEvolutionSystem`, hero Overview |
| 18 | Rift-funded seeded recruitment and human Procedural Character Forge | `recruitment/`, recruitment reveal |
| 19 | Hero capacity, Dormitory upgrades, and comfort recovery | `DormitorySystem`, Heroes surface |
| 20 | Daily Food use, shortages, and expedition-funded stockpile | `ResourceEconomySystem`, `ExpeditionSystem` |
| 21 | Editable Refuge layout, validation, trails, routing, and seeded trees | `RefugeLayoutSystem`, Build Mode |

Anything beyond this table is future scope unless code and validation are added under an approved
phase.

---

## 26. Phase 16 Reference: Memory System

Phase 16 is implemented. Its goal is:

Its goal is:

```text
Past events influence future behavior.
```

The roadmap begins with these memory kinds:

```text
ALLY_DIED
WAS_SAVED
SAVED_ALLY
CRITICAL_INJURY
WON_BOSS
```

### Memory data

The typed model lives in `src/memories/HeroMemory.ts`:

```ts
export type HeroMemoryType =
  | "ALLY_DIED"
  | "WAS_SAVED"
  | "SAVED_ALLY"
  | "CRITICAL_INJURY"
  | "WON_BOSS";

export interface HeroMemory {
  id: string;
  type: HeroMemoryType;
  createdDay: number;
  lastReinforcedDay: number;
  targetHeroId: string | null;
  weight: number;
  persistent: boolean;
  summary: string;
}
```

Every hero owns `memories: HeroMemory[]`, initialized to `[]` by `HeroGenerator`.

Keep `summary` for presentation, but do not make gameplay inspect the English sentence. Gameplay
must switch on the typed `type` field.

Do not confuse `Hero.memories` with `Hero.lossMemories`. The latter is a Phase 15 compatibility
record used for bereavement history. The general Phase 16 system adds broader typed behavior memory
without deleting the older record.

### Memory ownership

`src/memories/MemorySystem.ts` is the only system that creates, reinforces, decays, and queries
general memories.

Useful responsibilities:

```text
record(hero, memory input)
getInfluence(hero, context)
step(heroes, elapsed game time)
normalize/validate weights
```

Avoid scattering `hero.memories.push(...)` across combat, expedition, and UI code. Systems instead
report facts to `MemorySystem`, which decides how those facts become memories.

### Current event connections

Implemented hooks:

- `HeroManager.applyExpeditionConsequences`: ALLY_DIED and CRITICAL_INJURY
- Combat protection or healing resolution: WAS_SAVED and SAVED_ALLY
- `CombatSimulation`: protection and successful healing report typed combat-memory events

`WON_BOSS` exists in the typed vocabulary but remains uncreated until Phase 31 supplies a real boss
victory. The code does not fabricate an event merely to populate the UI.

### Behavior effects

Current effects are deliberately bounded and explainable:

- ALLY_DIED preserves the Phase 15 morale consequence and adds future retreat/fear pressure.
- WAS_SAVED increases trust and affinity toward the saving hero and lowers fear toward them.
- SAVED_ALLY reinforces remembered protection of that specific hero.
- CRITICAL_INJURY increases later caution and retreat pressure.

`getMemoryCombatInfluence` converts memory weights into normalized `0..1` fear, retreat, and protect
values. Utility AI consumes those bounded values. Several memories therefore cannot produce an
unbounded score.

Utility diagnostics use `past trauma` and `remembered bond` when either becomes the dominant reason.

### Reinforcement and decay

The same type and target form one memory key. A repeated event on the same in-game day does not
reapply morale or relationship effects. A later-day event reinforces the existing record instead of
creating an unbounded duplicate.

Minor memories decay by six weight points per in-game day and are removed below weight five. Lasting
ALLY_DIED and CRITICAL_INJURY memories do not decay. Each hero retains at most 24 general memories.

Decay uses `gameMinutes` supplied by normal simulation steps. It does not depend on render frame rate.

### Presentation

Memories appear in the Relations tab of the shared hero detail panel. Each record shows:

Show:

- What happened
- When it happened
- Who was involved, when applicable
- Whether it is lasting or its current fading influence

The memory system did not add a navigation destination. Detailed action scores remain in Arena
diagnostics.

### Phase 16 regression coverage

`scripts/ui-playtest.mjs` verifies:

1. A supported event creates exactly one expected memory.
2. The memory survives ordinary simulation steps.
3. A minor memory decays using game time.
4. A major memory persists.
5. Morale or relationship influence is applied once per day, not every combat tick.
6. Utility AI receives a bounded influence.
7. A relevant AI explanation mentions memory influence.
8. Hero detail UI displays the record.
9. Fallen heroes do not leave broken target references.
10. Existing Phase 15 loss records migrate or coexist without duplicate grief effects.

### Current scope boundary

Do not pull in:

- Trait evolution belongs to Phase 17 and is documented in the next section
- Recruitment belongs to Phase 18 and is documented below
- Disk persistence from Phase 38
- Boss encounters from Phase 31

Phase 16 remained complete without absorbing those systems. Phase 17 is now implemented as a
separate layer. Phase 18 recruitment is now implemented as another separate layer.

---

## 27. Phase 17 Reference: Trait Evolution

Phase 17 makes lasting experience visible on the hero record. It does not replace starting traits.

### Data model

`Hero.traits: string[]` remains the compatibility surface used by Utility AI and skill rules.
`Hero.traitHistory: HeroTraitRecord[]` adds the information needed for presentation and auditing:

```ts
interface HeroTraitRecord {
  id: string;
  name: string;
  source: "Generated" | "Earned";
  acquiredDay: number;
  reason: string;
}
```

When adding a trait-aware system, use `traits` for a simple rule check and `traitHistory` when you
need to explain when or why the hero changed. Never parse the English `reason` string for gameplay.

### Rule ownership

All earned conditions live in `src/heroes/TraitEvolutionSystem.ts`. Each rule contains a stable ID,
display name, condition, reason builder, and small personality-drift map. `evaluate(hero, day)`:

1. Skips a trait whose name already exists.
2. Checks the condition against authoritative hero career and memory data.
3. Adds both the compatible name and provenance record.
4. Applies the rule's personality drift once.
5. Returns the new records for callers or tests.

This idempotency is important. Simulation and UI refreshes may happen many times, but they must not
reapply personality changes.

### Implemented conditions

| Trait | Condition | Drift direction |
| --- | --- | --- |
| Battle-Hardened | 5 expeditions and either 5 kills or a critical-injury memory | bravery and discipline up |
| Veteran | 10 survived expeditions | bravery and discipline up |
| Survivor's Guilt | an `ALLY_DIED` memory | empathy and loyalty up, bravery down |
| Protective | a `SAVED_ALLY` memory reinforced on a later day | empathy and loyalty up, aggression down |
| Ruthless | 10 kills and empathy at or below 0.35 | aggression up, empathy and loyalty down |

Personality values are clamped to `0.04..0.98`. These are small changes, not a replacement for the
hero's generated identity.

### Event connections

`HeroManager.applyExpeditionConsequences` evaluates surviving heroes only after career totals,
deaths, grief memories, and injuries are resolved. A fallen hero is removed first and cannot earn a
posthumous survivor trait.

`HeroManager.recordCombatMemory` evaluates the actor and target after the rescue memory is recorded.
This is what lets a later-day repeated rescue earn Protective without polling every simulation frame.

### UI and notifications

The Overview tab renders each trait as a compact record. Starting traits say `Starting trait`;
earned traits show `Earned · Day N` plus their source reason. `NotificationCenter` snapshots existing
trait names during initialization and only announces later earned traits, preventing startup spam.

### Safe recipe: add an earned trait

1. Add one rule to `TRAIT_RULES` with a unique ID and display name.
2. Base its condition on authoritative typed data, not UI text or rendered objects.
3. Keep drift small and use only existing `Personality` keys.
4. Confirm the trait name does not accidentally collide with a generated trait unless that is intended.
5. Add a focused browser regression proving the threshold, provenance, drift, and duplicate suppression.
6. Run `npm run check`, `npm run build`, `npm run playtest:ui`, and `git diff --check`.

Do not mix recruitment, classes, equipment, facilities, or save migration into a trait change.
Recruitment is implemented separately in Phase 18; the other systems retain later boundaries.

---

## 28. Phase 18 Reference: Recruitment and Procedural Character Forge

Phase 18 adds a real acquisition loop without adding another primary destination:

```text
Win Rift expedition → receive 3 Rift Shards and 18 Scrap → expand Dormitory if full
→ Heroes / Dimensional Gate → spend 3 Shards → generate seeded hero → reveal → active roster
```

### Recruitment ownership

`src/recruitment/RecruitmentSystem.ts` owns the cost and seeded rank roll. The implemented rank
distribution is 72% 1★, 23% 2★, and 5% 3★. Only these ranks exist in the current acquisition flow.

`Simulation.recruitHero(seed?)` is the transaction boundary. It verifies that combat and expedition
are idle, verifies Dormitory capacity and the stockpile, spends Rift Shards through `ExpeditionSystem`, asks `HeroManager`
to generate/admit the recruit, updates hero count, and returns the reveal result. Player code omits
the seed; the optional argument exists for reproducible validation.

`HeroManager.recruit` uses a fresh seeded `HeroGenerator`, sets `career.joinedDay`, applies the rolled
rank after hidden potential is generated, admits the hero, and initializes directional relationships
between the arrival and every resident.

### Stored appearance and prototype adaptation

Every hero appearance now includes:

```text
height + bodyWidth
headScale + shoulderWidth
armLength + legLength
gender + human hair style/length
skin + hair + clothing colors
```

Recruits store `generationSeed`. `HeroAppearanceConfig.ts` validates bounded plain JSON and provides
the canonical appearance signature. `HeroMeshGenerator` is still the shared mesh path for the live
Refuge, cached portrait, party card, roster card, and recruitment reveal.

The imported prototype ideas stop at human proportions, hair, colors, seeded data, and modular mesh
construction. Do not activate its fantasy races, classes, weapons, armor, enemy tiers, magic glow,
standalone editor sidebar, or localStorage preset workflow under Phase 18.

### Resource and UI flow

Recruitment costs 3 actual `riftShards` from `ExpeditionSystem`; there is no separate currency copy.
The Heroes header disables `OPEN GATE` when funds are insufficient. Selecting the Refuge's
Dimensional Gate routes to Heroes. The `RecruitmentOverlay` then shows name, occupation, 1–3★ rank,
visible traits, visible skills, and the cached procedural portrait while keeping potential concealed.

The recruit is committed when the Gate opens, so closing the reveal cannot reroll or refund it.
`NotificationCenter` recognizes a new hero as one arrival event and seeds their training, injury,
trait, and skill baselines to avoid a burst of false discovery messages.

### Portrait lifecycle

`HeroPortraitCache.generateAll` queues a late recruit behind an active batch instead of silently
dropping it. One temporary offscreen renderer handles each batch. Geometry/materials are disposed,
the context is released, superseded URLs are revoked, and all remaining URLs are revoked on teardown.

### Safe recipe: change recruitment

1. Change cost or rank odds in `RecruitmentSystem`, not in the button text.
2. Keep resource validation in `Simulation` and spending in `ExpeditionSystem`.
3. Keep hidden potential generation independent from rank.
4. Add appearance fields to `HeroAppearance`, its generator, validator, shared mesh, and signature.
5. Never add unrestricted player sliders to randomized recruitment.
6. Extend Phase 18 browser validation for spending, reproducibility, ranks, admission, portrait, and reveal.
7. Run `npm run check`, `npm run build`, `npm run playtest:ui`, and `git diff --check`.

Phase 19 now supplies the capacity rule around Phase 18 recruitment. Keep rank, appearance, and
recruitment cost changes within the Phase 18 owners described above.

---

## 29. Phase 19 Reference: Hero Capacity and Dormitories

`src/refuge/DormitorySystem.ts` owns the three immutable tier definitions and the current tier index.
It derives a `DormitorySnapshot` containing level, occupied beds, capacity, comfort, rest effects,
and the next upgrade cost. The implemented tiers are:

| Level | Comfort | Capacity | Upgrade to next | Rest fatigue | Rest morale |
|------:|---------|---------:|----------------:|-------------:|------------:|
| 1 | Basic | 5 | 12 Scrap | ×1.00 | +0.0/hour |
| 2 | Settled | 7 | 24 Scrap | ×1.15 | +0.5/hour |
| 3 | Restorative | 10 | Maximum | ×1.30 | +1.0/hour |

### Capacity and upgrade transactions

`Simulation.canRecruit()` checks Dormitory capacity before recruitment spends 3 Rift Shards. The
starting roster therefore begins at `5 / 5`, and a blocked Gate attempt preserves all Shards.

`Simulation.upgradeDormitory()` is the upgrade transaction boundary. It requires Briefing/Idle
state, checks the tier and real Scrap balance, spends through `ExpeditionSystem.consumeScrap`, and
then commits exactly one tier. JavaScript executes this synchronously, so no other action can alter
the balance between validation and commit.

### Comfort data flow

```text
DormitorySystem.getSnapshot()
  ↓ Simulation.step()
HeroManager.step()
  ↓
NeedsSystem.step()
  ↓ only when movement.activity === "Resting"
fatigue recovery multiplier + morale recovery bonus
```

Comfort is not copied onto heroes and does not modify base needs when they are walking, eating,
training, or socializing. The normal `NeedsSystem` defaults remain ×1.00 and +0 when no modifier is
provided, preserving direct callers and earlier tests.

### UI and world behavior

The Heroes surface shows occupancy, comfort, recovery effects, and the next Scrap cost. The Gate
button reports a capacity-specific reason when full. The top status displays `occupied/capacity`.
Selecting the 3D Dormitory routes to Heroes, but there is no fifth navigation item. Activity,
resting, and infirmary navigation rings contain ten positions to match the Phase 19 maximum.

### Safe recipe: modify Dormitory balance

1. Change tier data only in `DORMITORY_TIERS`.
2. Keep roster admission checks in `Simulation.canRecruit()`.
3. Keep Scrap ownership in `ExpeditionSystem`; never subtract a UI copy.
4. Pass new comfort effects through the snapshot instead of storing derived values on every hero.
5. Update UI text by reading the snapshot rather than hardcoding costs or capacity.
6. Extend browser coverage for no-spend rejection, upgrades, maximum level, recovery, and layout.
7. Run `npm run check`, `npm run build`, `npm run playtest:ui`, and `git diff --check`.

Phase 20 implements the bounded resource loop described in the next section. Phase 21 now owns
layout editing separately. Phase 22 construction placement, timers, builders, recipes, and new
facility meshes remain outside Phase 19.

---

## 30. Phase 20 Reference: Resource Economy

`src/economy/ResourceEconomySystem.ts` owns time-scaled Food demand and provision status. It does not
own the stockpile. `ExpeditionSystem` remains the sole resource owner and exposes narrow consumers
for Food, Medicine, Scrap, and Rift Shards.

### Current resource loop

| Resource | Starting amount | Current source | Current consumer |
|----------|----------------:|----------------|------------------|
| Food | 12 | 8 from mission victory | 1 per active hero per game day |
| Medicine | 6 | 2 from mission victory | Injury treatment |
| Scrap | 0 | 18 from mission victory | Dormitory upgrades |
| Rift Shards | 0 | 3 from mission victory | Recruitment |

Metal remains absent because no Phase 22 recipe consumes it. Never add a resource to the HUD only
because it appears in the future concept vocabulary.

### Food consumption

`ResourceEconomySystem.step()` converts hero count and elapsed game minutes into fractional demand:

```text
hero count × 1 Food × elapsed minutes / 1440
```

Only whole units are consumed. The fractional remainder stays in `foodDemandProgress`; unmet whole
units increase `foodShortfall` but do not become debt that consumes future rewards. Active roster
deaths reduce future demand automatically because each step uses the current hero count.

Provision status is derived from current Food divided by daily demand:

- Stocked: more than one day remains
- Low: one day or less remains
- Empty: zero Food

### Needs consequences

`Simulation.step()` consumes due Food first, reads the new economy snapshot, and passes
`foodSupply` with Dormitory comfort to `NeedsSystem`. When Empty, Eating uses normal hunger decay
instead of meal recovery, stress gains 2.5 per game hour, and morale loses an additional 3 per game
hour. There is no instant starvation death.

Combat and Debrief return before refuge time/economy stepping, so frozen gameplay states do not
drain Food.

### UI and notifications

`HudShell` keeps exact resource amounts in the top bar. While Refuge is active, the compact
provisioning record shows Stocked/Low/Empty, days remaining, and current Food/day. State uses text,
border, and color rather than glow. `NotificationCenter` announces transitions to Low, Empty, or
Stocked without producing a startup message.

### Safe recipe: modify the economy

1. Change `FOOD_PER_HERO_PER_DAY` in `ResourceEconomySystem`, not in UI text.
2. Keep stockpile mutations inside `ExpeditionSystem`.
3. Validate availability before every spend; never partially mutate on rejection.
4. Update mission reward data and its direct victory regression together.
5. Keep shortage effects gradual and driven by game minutes.
6. Do not add Metal until a real Phase 22 construction recipe consumes it.
7. Test consumption, shortfall, needs effects, notifications, top-bar values, victory, and withdrawal.

Phase 21 Build Mode, movable facilities, trails, and seeded environment placement are implemented
by a separate layout layer, not by the economy. Phase 22 construction sites, builders, progress
timers, material recipes, and completed new facility models remain absent.

---

## 31. Phase 21 Reference: Refuge Layout System

Phase 21 turns the fixed Refuge floor into a broad, continuous, authoritative layout while keeping
the living scene running. It reorganizes eight starting structures and deterministic environment
props; it does not purchase or construct new facilities.

### Ownership map

```text
Simulation
  └─ RefugeLayoutSystem
       ├─ structures: id, kind, label, transform, footprint, placed, removable
       ├─ trails: snapped cell records
       ├─ seed + generated tree and rock records
       ├─ plane size + prepared expansion metadata
       ├─ version + revision
       └─ one committed-state undo snapshot

Game
  ├─ selected tool + unconfirmed draft
  ├─ RefugeBuildOverlay actions
  └─ Renderer Build Mode/input gating

Renderer
  ├─ RefugeBuildInput ground raycast
  └─ ProceduralBaseScene snapshot rendering
```

The authoritative instance lives in `Simulation`; renderer and UI code receive read-only snapshots.
A facility mesh position is never treated as saved gameplay state.

### Placement transaction

1. `RefugeBuildInput` converts a left-pointer position into Refuge ground coordinates.
2. `Game` asks the matching structure, environment, or trail validator for a snapped draft.
3. The renderer displays the draft with geometry plus olive/bronze or burgundy state.
4. Confirm calls one narrow `Simulation` mutation method.
5. `RefugeLayoutSystem` validates again, captures the previous committed state, mutates once,
   increments `revision`, and publishes a new frozen snapshot.
6. `ProceduralBaseScene.syncLayout()` updates the affected render data on the new revision.

Cancel clears only the draft. Undo restores the immediately previous committed layout state.
Rejected placements never increment the revision. Layout mutations are blocked during active combat
or debrief states.

### Validation rules

Structure and environment moves subtly snap to a hidden two-world-unit grid and must stay inside the
72×72 starting plane. They cannot overlap structures, environment footprints, or blocked entrance
space. A bounded grid flood fill checks that structure entrances remain reachable from the movable
campfire commons. The snapshot also carries a prepared 120×120 expansion size, but Phase 21 exposes
no unlock action for it.

Trail cells use the same hidden grid. They must remain inside the floor and avoid structure and
environment footprints. Every cell must remain cardinally connected to a cell rooted in the current
campfire position; erasing a cell is rejected if it would split the network. Rendering joins these
cells into smooth continuous strips so the floor does not look tiled. Movement-cost and path
preference remain future behavior.

### Dynamic hero destinations

`createRefugeNavigationPoints(layout)` derives Command Hall, campfire, Resting, Training, Infirmary,
and Storage points from current structure transforms. `HeroRoutineSystem` caches the last layout
revision and reassigns the destination of heroes whose activity already matches their schedule when
the layout changes. A stored ordinary facility routes its related activity to Command Hall, while
its gameplay service stays paused until the facility is placed again.

### Environment props and future model replacement

Environment records are regenerated from the owned seed with a capped 520-attempt loop targeting 28
trees and 16 rocks, biased toward the perimeter. They avoid structure footprints, trail cells, and
one another. Each low-poly prop is individually selectable, movable, and removable in Build Mode.
When supplied models arrive, replace only the visual factories or adapters; preserve the seeded
placement records and do not put GLTF objects in simulation.

### Controls and responsive behavior

- Enter through **Build Refuge** while Refuge is the active HUD section.
- Use the horizontal bottom rail to choose any starting structure or the trail tools; use the right
  inspector to edit the current selection.
- Left click/tap selects a structure, tree, or rock or positions its draft; trail tools paint/erase.
- Right-drag orbits and middle-drag pans without placing.
- `R` rotates a structure; `Enter` confirms a valid draft; `Escape` cancels, then exits.
- Arrow buttons nudge a selection or pan the camera for keyboard/touch-accessible operation.
- On mobile, the tool rail scrolls horizontally, the inspector becomes a full-width drawer, and
  normal navigation hides until Build Mode exits.

### Safe recipe: add another movable existing structure

1. Add its stable ID, kind, removal policy, and initial plain-data footprint to `RefugeLayoutSystem`.
2. Register all related render objects against one structure anchor in `ProceduralBaseScene`.
3. Add the tool to `RefugeBuildOverlay`.
4. Map any hero activity destination in `createRefugeNavigationPoints(layout)`.
5. Test valid/invalid placement, selection alignment, hero rerouting, undo, and mobile controls.
6. Keep cost, site, timer, builder, and material logic out; those require Phase 22 approval.

Disk persistence remains Phase 38. The current session layout resets on a reload by design.

---

## 32. Debugging Method

When something breaks, follow the value rather than changing random files.

### Example: “The Party panel says a hero is ready while deployment is blocked”

Trace:

```text
ExpeditionOverlay.canDeploy
  ↓
Simulation.getSquadEvaluation().isReady
  ↓
SquadSystem.evaluate
  ↓
member count + hasRecoveringInjury
```

Now compare that with `ExpeditionSystem.start`, which independently validates the same conditions.
The fix belongs where the two rules diverge, not in the button color.

### Example: “A hero walks to empty ground”

Trace:

```text
HeroRoutineSystem decision
  ↓
NavigationPoints destination
  ↓
ProceduralBaseScene visual position
```

Check whether the destination coordinates and building coordinates still agree.

### Example: “A skill appears but never affects combat”

Trace:

```text
Skill definition
  ↓
Discovery
  ↓
Loadout/prepared state
  ↓
Utility AI validity or CombatSimulation calculation
  ↓
Skill usage event and XP
```

The definition and UI may be correct while no combat rule consumes the skill.

### Useful search commands

Find every reference to a symbol:

```powershell
rg -n "HeroAppearance" src
rg -n "startExpedition" src scripts
rg -n "data-expedition-action" src
```

List source files:

```powershell
rg --files src
```

Inspect uncommitted changes:

```powershell
git status --short
git diff
git diff --check
```

---

## 33. Safe Git Workflow

Before editing:

```powershell
git status --short
```

If files are already modified, assume those changes matter. Read their diff and avoid overwriting
unrelated work.

After one focused change:

```powershell
git diff -- path\to\changed-file.ts
npm run check
npm run build
git diff --check
```

Good commits are phase-scoped and explain the outcome. Avoid mixing a combat rebalance, UI redesign,
and new memory system into one commit.

Never use destructive commands such as `git reset --hard` to clean the repository unless you fully
understand and intend to erase every uncommitted change.

---

## 34. Definition of Done for a Change

A feature is not done only because TypeScript compiles.

Use this checklist:

- The authoritative data model is clear.
- Rules live in a gameplay system, not only in UI or rendering.
- Invalid actions return safely without partially mutating state.
- UI reads state and invokes narrow actions.
- World input is gated while panels are active.
- Keyboard and pointer paths both work where applicable.
- Dynamic HTML content is escaped or assigned with `textContent`.
- Desktop, tablet, and mobile layouts remain usable.
- Reduced-motion behavior remains respected.
- Three.js resources and event listeners are disposed.
- `npm run check` passes.
- `npm run build` passes.
- `git diff --check` passes.
- The relevant browser path was actually exercised.
- The development phase document is updated only when implementation and validation are real.

---

## 35. Final Rule of Thumb

When you are unsure where a change belongs, ask three questions:

1. **What is the authoritative fact?** Put that in a typed data model or gameplay system.
2. **Who is allowed to change it?** Expose one validated operation through `Simulation`.
3. **Who only displays it?** Keep Three.js and DOM components as disposable views.

Following those three questions will keep most ASCENT changes compatible with the existing
architecture and make later phases much easier to implement.
