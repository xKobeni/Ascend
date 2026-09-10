# ASCENT Developer Tutorial

> A complete guide to understanding, maintaining, and modifying the ASCENT codebase.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture](#2-architecture)
3. [Core Engine](#3-core-engine)
4. [Hero System](#4-hero-system)
5. [Skill Forge](#5-skill-forge)
6. [Combat System](#6-combat-system)
7. [Squad & Expedition](#7-squad--expedition)
8. [3D Rendering](#8-3d-rendering)
9. [UI System](#9-ui-system)
10. [How to Modify (Recipes)](#10-how-to-modify-recipes)
11. [Key Constants Reference](#11-key-constants-reference)
12. [File Index](#12-file-index)

---

## 1. Quick Start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). The game loads with 5 procedurally generated heroes in a 3D refuge.

**Controls:** WASD to pan camera, Q/E to rotate, mouse wheel to zoom, click heroes to select, F3 for debug overlay.

**Core gameplay loop:**
1. Heroes walk around the refuge eating, training, socializing, resting
2. You assign heroes to squads (Party tab)
3. You train heroes (Training tab in hero detail)
4. You deploy squads on expeditions (Rift tab)
5. Combat runs automatically with Utility AI
6. Heroes can get injured or permanently die
7. Fallen heroes get memorial graves in the refuge

---

## 2. Architecture

### The Golden Rule

**Simulation is authoritative. Rendering is display-only.**

Every piece of game state lives in plain TypeScript data structures (`Hero`, `Squad`, `CombatSnapshot`). Three.js meshes, DOM elements, and CSS are purely visual — they never own or mutate game state. If a Three.js mesh and a `Hero` object disagree, the `Hero` is always correct.

### Data Flow

```
GameClock (fixed 50ms ticks)
    |
    v
Simulation.step()   <-- advances all game logic
    |
    v
Game.frame()        <-- takes snapshots, renders 3D, updates UI panels
    |
    +--> Renderer.render()     <-- Three.js scene
    +--> UI overlays.update()  <-- DOM panels
    +--> EventBus events       <-- communication between layers
```

### Why These Choices

| Choice | Reason |
|--------|--------|
| No React/Vue/Svelte | UI is panels over a 3D canvas. Vanilla DOM is simpler and has zero bundle overhead. |
| No external 3D assets | Everything is procedural geometry. No loading screens, no asset pipeline, no licensing. |
| Seeded PRNG (`Random.ts`) | All hero generation is deterministic. Same seed = same heroes. Useful for debugging and future save system. |
| Fixed timestep (`GameClock`) | Simulation runs at exactly 20Hz regardless of display refresh rate. A 144Hz monitor and a 30Hz laptop run the same simulation. |
| TypeScript strict mode | Catches bugs at compile time. The `readonly` modifier on interfaces prevents accidental mutation. |

### Technology Stack

- **Vite** — dev server, hot reload, build tool
- **TypeScript 7** — type-safe source code (strict mode)
- **Three.js 0.186** — 3D rendering (WebGL)
- **Vanilla DOM + CSS** — UI panels (no framework)
- **No other runtime dependencies**

---

## 3. Core Engine

### 3.1 Game Orchestrator (`src/core/Game.ts`)

The `Game` class is the central coordinator. It owns:
- `Simulation` — all game logic
- `Renderer` — Three.js rendering
- `GameClock` — fixed timestep
- All UI overlays (hero roster, squad panel, expedition panel, etc.)

**The game loop** (`frame()` method):
1. Call `GameClock.advance()` — this runs 0-5 simulation steps at 20Hz
2. Take snapshots from `Simulation` (combat state, expedition state)
3. Call `Renderer.render()` — draw the 3D scene
4. Update all UI panels with current data
5. Update debug overlay, notification center
6. Request the next frame

**Panel management:** Only one panel can be open at a time (Heroes, Party, Refuge, Rift, or hero detail). When a panel is open, camera controls and click selection are disabled via `Renderer.setUiInteractionActive()`.

**Key entry points for modification:**
- To add a new panel: create a new class in `src/ui/`, add it to `Game` constructor, add navigation button in `HudShell`
- To add a new game mode: add state to `Simulation`, add rendering logic to `Renderer`, add UI panel

### 3.2 Game Clock (`src/core/GameClock.ts`)

A fixed-timestep accumulator. Key constants:
- **Step size:** 1/20 second (50ms)
- **Max steps per frame:** 5
- **Max frame time:** 0.25 seconds

Each frame, `advance()` accumulates real time and calls `onStep()` for each 50ms tick. Returns an interpolation alpha for smooth rendering between ticks.

```
Frame A: 16ms elapsed -> 0 steps (accumulating)
Frame B: 40ms elapsed -> 1 step (50ms tick)
Frame C: 70ms elapsed -> 1 step (50ms tick, 20ms leftover)
```

### 3.3 Event Bus (`src/core/EventBus.ts`)

A generic typed pub/sub system. Usage:

```typescript
// Define event types
interface MyEvents {
  heroDied: { heroId: string; day: number };
  resourceChanged: { type: string; amount: number };
}

// Create an event bus
const bus = new EventBus<MyEvents>();

// Subscribe (returns an unsubscribe function)
const unsub = bus.on("heroDied", (payload) => {
  console.log(`${payload.heroId} died on day ${payload.day}`);
});

// Emit
bus.emit("heroDied", { heroId: "abc", day: 42 });

// Cleanup
unsub();
```

Used by `Renderer` to emit `selectionChanged` events when you click a hero in the 3D scene. `Game` subscribes to open the hero detail panel.

### 3.4 Seeded Random (`src/core/Random.ts`)

All procedural generation uses this class instead of `Math.random()`. This makes hero generation reproducible.

```typescript
const rng = new Random(12345); // seed

rng.float(0, 1);      // random float in [0, 1)
rng.integer(1, 10);    // random integer in [1, 10]
rng.pick(["a", "b"]);  // random element from array

Random.fromEntropy();   // non-seeded version for truly random results
```

**Important:** Always use `Random` for game logic. Never use `Math.random()` — it would break determinism.

### 3.5 Renderer (`src/core/Renderer.ts`)

Wraps Three.js. Manages two scenes:
1. **Refuge scene** (`ProceduralBaseScene`) — the home base where heroes live
2. **Combat arena** (`CombatArenaScene`) — shown during combat

The renderer swaps between them based on whether combat is active.

Input gating: when a UI panel is open or combat is running, the renderer disables camera controls and click selection.

---

## 4. Hero Systems

### 4.1 Hero Data Model (`src/heroes/Hero.ts`)

The `Hero` interface is the single source of truth for a hero. Every field is typed. Here's the complete structure:

```typescript
interface Hero {
  // Identity
  id: string;                    // unique UUID
  name: string;                  // "Aldric Vane"
  age: number;                   // 18-58
  gender: HeroGender;            // "male" | "female"

  // Origin
  origin: HeroOrigin;            // occupation, category, rarity, aptitudes
  career: HeroCareer;            // expeditions, kills, victories, joinedDay

  // Stats
  attributes: HeroAttributes;    // strength, agility, endurance, intelligence, willpower, leadership (2-7)
  skills: HeroSkills;            // legacy: defense, leadership, medicine, spear, sword (0-3)
  level: number;                 // starts at 1
  rank: number;                  // prestige rank
  personality: Personality;      // aggression, ambition, bravery, discipline, empathy, loyalty (0.12-0.9)
  hiddenPotential: HiddenPotential; // per-attribute growth ceiling (0.25-0.98)
  traits: string[];              // 1-3 traits: "Hard Worker", "Cowardly", "Protective", etc.

  // Needs (0-100, decay over time)
  needs: HeroNeeds;              // fatigue, health, hunger, morale, social, stress

  // Skills
  skillForge: HeroSkillForge;    // affinities, known skills, loadout, discovery log

  // Injuries
  injuries: HeroInjury[];        // active injuries with recovery timers

  // Relationships
  relationships: Record<string, RelationshipProfile>; // per-other-hero metrics

  // Training
  training: HeroTraining;        // queue, active assignment, progress

  // Movement
  movement: HeroMovement;        // position, activity, destination

  // Visual
  appearance: HeroAppearance;    // skin, hair, body proportions, clothing

  // State
  heroClass: HeroClass;          // always "Unclassified" (future)
  socialRole: SocialRole;        // always "Resident" (future)
  reputation: HeroReputation;    // renown, title
  recovery: HeroRecovery;        // last treatment outcome
  lossMemories: HeroLossMemory[]; // memories of fallen comrades
}
```

### 4.2 Hero Generation (`src/heroes/HeroGenerator.ts`)

When `HeroManager.generateInitialRoster(5)` is called, the generator creates 5 heroes:

1. **Pick occupation** — weighted random from 35 definitions (Farmer has weight 8, Elite Knight has weight 1)
2. **Generate attributes** — random 2-6 per stat, then apply occupation modifiers (capped at 10)
3. **Generate skills** — random 0-3 per legacy skill, then apply occupation modifiers
4. **Generate personality** — 6 floats between 0.12 and 0.9
5. **Generate hidden potential** — 6 floats between 0.25 and 0.98
6. **Score and pick traits** — 8 candidates scored by personality/attributes, top 1-3 selected
7. **Generate appearance** — gender, hair style/color/length, skin tone, body proportions (influenced by STR/AGI)
8. **Create skill forge** — `HeroSkillGenerator` creates affinities, discovers initial skills, prepares loadout

### 4.3 Occupation Definitions (`src/heroes/OccupationDefinitions.ts`)

35 occupations organized by category. Each definition:

```typescript
{
  name: "Soldier",
  category: "Military",           // Civilian|Skilled|Military|Wilderness|Underworld|Leadership|Rare
  rarity: "Specialized",          // Common|Specialized|Rare
  selectionWeight: 4,             // higher = more likely to be chosen
  aptitudes: ["Formation discipline", "Weapon familiarity", "Field endurance"],
  attributeModifiers: { endurance: 1, leadership: 1, strength: 1 },
  skillModifiers: { defense: 3, leadership: 1, sword: 3 },
  visualModifiers: { shoulderWidth: 1.12, armThickness: 1.08 }, // optional
}
```

### 4.4 Needs System (`src/heroes/NeedsSystem.ts`)

Six needs that decay over time (per game hour):

| Need | Normal Decay | Activity Bonus |
|------|-------------|----------------|
| Hunger | -4.5/hr | +24/hr while eating |
| Fatigue | +1.5/hr idle | -22/hr resting, +9/hr training, +4/hr walking |
| Social | -3.25/hr | +20/hr socializing |
| Stress | -0.5/hr | -5/hr resting, -3/hr socializing |
| Morale | combined | +1.5 resting, +2.5 socializing, -4 low hunger, -3 low health, -2 high stress |
| Health | +0.75/hr resting | (only recovers while resting) |

**Activity selection:** `chooseActivity()` evaluates which need is most urgent and overrides the scheduled activity. If hunger < 35, the hero eats regardless of schedule. If fatigue > 78, the hero rests.

### 4.5 Daily Routine (`src/heroes/HeroRoutineSystem.ts`)

Heroes follow a daily schedule:

| Period | Time | Default Activity |
|--------|------|-----------------|
| Morning | 06:00-10:00 | Eating |
| Day | 10:00-17:00 | Training |
| Evening | 17:00-22:00 | Socializing |
| Night | 22:00-06:00 | Resting |

Heroes walk to navigation points for their activity. Movement speed = `1.35 + agility * 0.075`.

### 4.6 Training System (`src/heroes/TrainingSystem.ts`)

Player-assignable training queue (max 3 slots). Three training types:

| Training Type | Effect |
|---------------|--------|
| Strength Training | +1 strength on completion |
| Weapon Training | Progresses sword_mastery or spear_mastery (whichever is higher) |
| Defense Training | Progresses brace skill |

**Training rate:** `0.42 + discipline * 0.16 + endurance * 0.01` (modified by injury penalties)

**Training injuries:** Checked every 60 game minutes. If fatigue > 72, there's a chance of a Minor Wound: `min(0.28, (fatigue - 68) / 100 - endurance * 0.025)`.

### 4.7 Injury System (`src/heroes/InjurySystem.ts`)

Four injury types:

| Injury | Attack | Defense | Training | Recovery | Medicine Cost |
|--------|--------|---------|----------|----------|--------------|
| Minor Wound | -5% | -4% | -12% | 18 hours | 1 |
| Burn | -8% | -18% | -25% | 48 hours | 2 |
| Concussion | -12% | -12% | -35% | 60 hours | 2 |
| Broken Arm | -20% | -10% | -30% | 72 hours | 3 |

- **Training injuries** are always Minor Wounds
- **Expedition injuries** depend on damage ratio (Defeat = higher severity)
- **Permanent injuries:** 8% chance when damageRatio >= 0.92 on defeat
- **Recovery rate:** `0.7 + endurance * 0.035` per game minute, doubled if treated
- **Treatment:** Costs medicine, halves remaining recovery time

### 4.8 Relationship System (`src/heroes/RelationshipSystem.ts`)

Every pair of heroes has directional relationship profiles with 6 metrics:

| Metric | Range | Description |
|--------|-------|-------------|
| Affinity | -100 to +100 | Like/dislike |
| Trust | 0-100 | Reliability |
| Respect | 0-100 | Competence admiration |
| Fear | 0-100 | Intimidation |
| Jealousy | 0-100 | Envy |
| Rivalry | 0-100 | Competitive tension |

**Relationship labels** (derived from metrics):
- Enemy: affinity <= -60, or (affinity < -30 and trust <= 15)
- Rival: rivalry >= 65 and respect >= 45
- Distrust: trust <= 20 and affinity < 10
- Trusted Friend: trust >= 70 and affinity >= 45
- Friend: affinity >= 25
- Companion: trust >= 45 and respect >= 45
- Neutral: default

**Interactions** happen every 55-90 game minutes between nearby heroes:
- Conversation: +2 affinity, +1 trust
- Training together: +1 affinity, +2 respect, +2 rivalry, +1 trust
- Argument: -4 affinity, +1 jealousy, +3 rivalry, -3 trust
- Help (medicine): helper +3/+2/+3, helped +5/+3/+6

### 4.9 Legacy / Memorial System (`src/heroes/LegacySystem.ts`)

When a hero dies:
1. `memorialize()` creates a `FallenHeroRecord` with career stats
2. `applyRelationshipReactions()` causes morale loss in survivors:
   - Trusted Friend: -18 morale
   - Friend: -12 morale
   - Companion: -8 morale
3. A `HeroLossMemory` is added to each affected hero
4. A 3D grave marker is rendered in the refuge

---

## 5. Skill Forge

### 5.1 Skill Data Model (`src/skills/Skill.ts`)

**Skill types:**
- `active` — player-equippable, costs a loadout slot
- `passive` — always effects, costs a loadout slot
- `reaction` — triggers automatically in combat, no loadout slot needed
- `utility` — exploration/survival skills

**Skill categories:** weapon, combat, survival, support, mental, unique

**Skill rarities:** common, uncommon, rare, elite, unique, legendary

**The HeroSkillForge:**
```typescript
interface HeroSkillForge {
  affinities: Record<SkillAffinity, number>;   // 6 affinity scores
  known: Record<string, HeroSkill>;             // all discovered skills
  loadout: { active: string[]; passive: string[] }; // 4 active + 4 passive slots
  discoveryLog: SkillDiscoveryRecord[];         // when skills were unlocked
  usageCounts: Record<string, number>;          // total uses per skill
  hiddenPotentialSlots: number;                 // future use
}
```

### 5.2 All 18 Skill Definitions (`src/skills/SkillDefinitionRegistry.ts`)

| ID | Name | Type | Category | Rarity | Affinity | Prerequisites |
|----|------|------|----------|--------|----------|---------------|
| sword_mastery | Sword Mastery | passive | weapon | common | sword | — |
| spear_mastery | Spear Mastery | passive | weapon | common | spear | — |
| basic_thrust | Basic Thrust | active | combat | common | spear | spear_mastery Lv1 |
| lunge | Lunge | active | combat | uncommon | spear | spear_mastery Lv3 |
| brace | Brace | reaction | combat | common | defense | endurance >= 3 |
| parry | Parry | reaction | combat | uncommon | sword | sword_mastery Lv2 |
| interpose | Interpose | active | combat | rare | defense | Protective trait |
| medicine | Medicine | passive | support | common | support | — |
| field_treatment | Field Treatment | active | support | uncommon | support | medicine Lv1 |
| tracking | Tracking | utility | survival | common | survival | — |
| scouting | Scouting | utility | survival | common | survival | — |
| fear_resistance | Fear Resistance | passive | mental | uncommon | defense | — |
| battle_focus | Battle Focus | passive | mental | uncommon | defense | — |
| protective_instinct | Protective Instinct | reaction | mental | rare | defense | Protective trait |
| leadership | Leadership | passive | support | common | support | — |

### 5.3 Skill Progression (`src/skills/SkillProgressionSystem.ts`)

**XP to next level:** `48 + level * 18`

**XP gained per use:** `max(1, round(baseXp * (0.72 + affinity * 0.56) * successModifier * difficultyModifier))`
- `baseXp`: base XP for the action (e.g., 10 for combat hit)
- `affinity`: hero's affinity score for that skill's affinity type (0-1)
- `successModifier`: 1.15 if successful, 0.7 if failed
- `difficultyModifier`: based on encounter difficulty

**Proficiency gain per use:** `0.006 + affinity * 0.004` (0-1 scale)

### 5.4 Skill Discovery (`src/skills/SkillDiscoverySystem.ts`)

Skills unlock when prerequisites are met. The discovery chain:

```
spear_mastery Lv1 -> basic_thrust
spear_mastery Lv3 -> lunge
sword_mastery Lv2 -> parry
medicine Lv1 -> field_treatment
```

Some skills also require traits (Interpose and Protective Instinct require "Protective").

### 5.5 Skill Loadout (`src/skills/SkillLoadoutSystem.ts`)

- **4 active slots** — equippable combat skills
- **4 passive slots** — always-on skills
- **Reaction skills** — always active, no slot needed
- `autoPrepare()` fills empty slots when new skills are discovered

---

## 6. Combat System

### 6.1 Combat Simulation (`src/combat/CombatSimulation.ts`)

Tick-based auto-battle. Runs at 10 ticks/second (0.1s per tick), max 600 ticks (60 seconds of combat).

**Setup:**
- 3 hero combatants from the squad (with formation positions and tactical roles)
- 3 "Rift Stalker" enemies (base stats scaled by `enemyStrength` parameter)

**Hero stat derivation:**
```
attack  = (10 + strength*2 + weaponSkill*2.5 + roleAttack) * injuryAttack
defense = (4 + endurance + defenseSkill*1.5 + roleDefense) * injuryDefense
maxHp   = 58 + endurance*7 + level*5 + roleHp
speed   = 1.45 + agility * 0.08
```

**Role bonuses:**
- Vanguard: +16 HP, +3 defense, 2 range
- Damage: +4 attack
- Support: +2.2 range, 4.4 range

**Per-tick flow:**
1. Decrement attack cooldowns
2. Plan actions (heroes use Utility AI, enemies use simple AI)
3. Execute actions in priority order (defend/protect first, then attacks)
4. Check for victory/defeat/stalemate

**Damage formula:**
```
defenseMultiplier = (defending ? 1.65 : 1) + (hasProtector ? 0.45 : 0) + (hasFrontlineCover ? 0.3 : 0)
effectiveDefense = target.defense * 0.72 * defenseMultiplier
damage = max(1, round(attacker.attack - effectiveDefense))
```

**Healing formula:**
```
healing = max(5, round(5 + medicine * 2.5))
```

### 6.2 Utility AI (`src/combat/UtilityAI.ts`)

The AI brain. Scores 6 actions for each hero combatant:

**Attack** (offensive):
```
score = 24 + aggression*24 + bravery*18 + (role=="Damage" ? 22 : 0) + proximity*18 + (reckless ? 9 : 0)
valid = enemy exists AND within range
```

**Defend** (survival):
```
score = 10 + missingHealth*42 + threat*24 + discipline*18 + (vanguard ? 12 : 0) + (defender ? 18 : 0)
valid = enemy exists AND within 1.35x range
```

**Retreat** (escape):
```
score = 2 + missingHealth*72 + (1-bravery)*34 + threat*16 + (cowardly ? 16 : 0) - loyalty*8
valid = health <= threshold (68% normal, 82% cowardly) OR (threat >= 92% AND health < 90%)
```

**Protect** (ally defense):
```
score = 4 + allyRisk*44 + bond*24 + empathy*18 + loyalty*16 + (protective ? 22 : 0) + (defender ? 28 : 0)
valid = ally in danger AND has interpose/protective_instinct skill AND ally is not front-line (unless defender)
```

**Heal** (ally support):
```
score = woundedRatio*62 + medicine*5 + (support ? 30 : 0) + (medic ? 28 : 0) + empathy*14
valid = wounded ally exists AND has medicine > 0 AND is medic AND has field_treatment skill
```

**Reposition** (positioning):
```
score = 30 + rangeError*6 + discipline*14 + speed*5
valid = rangeError > 0.65
```

**Decision:** Highest valid score wins. Default fallback is Defend.

### 6.3 Formation System (`src/combat/FormationSystem.ts`)

Maps squad formation positions to combat:

| Position | X | Tactical Role | Effect |
|----------|---|---------------|--------|
| Front | -4.2 | Striker (or Defender for Vanguard) | +2 attack, 1.8 range |
| Middle | -7.4 | Ranged (or Medic for Support) | -1 attack, 5.8 range |
| Back | -10.6 | Ranged | ranged position |

**Tactical roles:**
- Striker: close-range damage dealer
- Ranged: long-range attacker
- Defender: front-line tank (+2 defense, 2 range, +16 HP)
- Medic: healer (4.4 range, +0.08 speed)

---

## 7. Squad & Expedition

### 7.1 Squad System (`src/squads/SquadSystem.ts`)

Fixed 3-member squad ("Squad Alpha"). Members are assigned to Front/Middle/Back positions with roles (Vanguard/Damage/Support).

**Squad evaluation:**
```
combatPower = strength*4 + agility*2 + max(weaponSkills)*5 + level*10  (injury-modified)
```

**Chemistry** (derived from inter-member relationships):
- Unformed: < 2 members
- Fragile: < 45% cohesion
- Developing: 45-64%
- Cohesive: 65-79%
- Bound: >= 80%

**Readiness:** Requires exactly 3 members with no recovering injuries.

### 7.2 Expedition System (`src/expeditions/ExpeditionSystem.ts`)

**Three phases:**
1. **Briefing** — view mission info, threats, rewards, deploy squad
2. **Combat** — runs `CombatSimulation` automatically
3. **Debrief** — view results, rewards, consequences (injuries/deaths)

**Current mission:** "Transit Yard Suppression"
- Difficulty: Moderate
- Threats: 3 Rift Stalkers, close-range pressure
- Rewards: 10 food, 3 rift shards, 18 scrap
- Enemy strength: 0.82

**Post-expedition consequences:**
- Deaths: memorialize, apply relationship reactions
- Injuries: based on damage ratio, chance of permanent injury on defeat
- Morale loss from combat stress
- Skill usage recorded for progression

---

## 8. 3D Rendering

### 8.1 Camera Controller (`src/rendering/CameraController.ts`)

Elevated isometric orbital camera:
- **WASD:** Pan (7.5 units/sec, clamped to -24..24)
- **Q/E:** Rotate yaw (1.15 rad/sec)
- **Mouse wheel:** Zoom (distance 30-84)
- **Elevation:** Fixed at 43 degrees
- **Initial:** distance 57, yaw 42 degrees

### 8.2 Selection Raycaster (`src/rendering/SelectionRaycaster.ts`)

Click-to-select heroes and objects in the 3D scene. Uses Three.js raycasting from mouse position to selectable meshes.

Selection categories: `hero`, `facility`, `prop`, `base`, `memorial`

Selected objects get a `Box3Helper` highlight box. Click threshold: 6px movement (to avoid accidental clicks while panning).

### 8.3 Procedural Base Scene (`src/rendering/ProceduralBaseScene.ts`)

The entire refuge is built from Three.js primitives:

| Object | Geometry | Notes |
|--------|----------|-------|
| Ground | PlaneGeometry (162x162) | Color #1b211f |
| Platform | CylinderGeometry (35 radius) | Elevated, with grid |
| Campfire | ConeGeometry flames + PointLight | Animated flickering |
| Tent | ConeGeometry | DoubleSide fabric |
| Infirmary | 3 BoxGeometry cots | |
| Training Dummy | CylinderGeometry post + SphereGeometry head | |
| Supply Crates | 3 stacked BoxGeometry | Metal bands |
| Storage Piles | 5 IcosahedronGeometry sacks | |
| Gate | 2 BoxGeometry pillars + lintel | Stone |
| Memorial Graves | plinth + marker + cap + bronze plate | Per fallen hero |

**Facility zones:** Color-coded CylinderGeometry pads with TorusGeometry rings:
- Dormitory (blue-ish)
- Training (orange-ish)
- Storage (green-ish)
- Gate (red-ish)

### 8.4 Hero Renderer (`src/rendering/heroes/HeroRenderer.ts`)

Renders hero figures with procedural animations driven by `HeroMovement.activity`:

| Activity | Animation |
|----------|-----------|
| Walking | Arm/leg swing, body bob, head tilt |
| Training | Twist/chop arm motions, posture lean |
| Eating | Arm reaching, head dip |
| Socializing | Gesture/nod motions |
| Resting | Horizontal position, subtle breathing |
| Idle | Weight shift, random look-around |
| Breathing | Continuous sine-wave body scale |

Positions are smoothly interpolated with `lerp(1 - exp(-12 * dt))`.

### 8.5 Hero Mesh Generator (`src/rendering/heroes/HeroMeshGenerator.ts`)

Builds low-poly hero rigs from appearance data:
- **Body:** CapsuleGeometry (gender-specific radius/height)
- **Head:** SphereGeometry (0.26-0.28 radius)
- **Arms/Legs:** CylinderGeometry + SphereGeometry hands/feet
- **Hair:** 12 styles with geometry variations (ponytail, bun, mohawk, wild spikes, curly spheres, long strands)

All meshes use `MeshStandardMaterial` with hero-specific colors. Body width influenced by strength/agility. Height influenced by age.

### 8.6 Hero Portrait Cache (`src/rendering/heroes/HeroPortraitCache.ts`)

Renders 320x400 portrait images using a separate offscreen Three.js renderer:
- Dedicated scene with hemisphere + key + rim lighting
- Caches by appearance signature (JSON.stringify of appearance)
- Used by hero roster cards in the UI

### 8.7 Combat Arena (`src/rendering/combat/CombatArenaScene.ts`)

Separate 3D scene for combat:
- Circular ground disc with torus ring and center line
- 8 perimeter pylons with emissive glow
- Hero combatants: CapsuleGeometry body + SphereGeometry head
- Enemy combatants: ConeGeometry body + IcosahedronGeometry head
- Health bars: PlaneGeometry scaled by HP ratio, billboard toward camera
- Defend ring: rotating TorusGeometry indicator
- Dead combatants rotate 90 degrees and lower

---

## 9. UI System

### 9.1 Design Pattern

All UI panels are built with **vanilla DOM manipulation** (no framework). Each panel is a TypeScript class that:
1. Creates DOM elements in its constructor
2. Has an `update()` method called each frame with current data
3. Has a `dispose()` method for cleanup
4. Uses CSS classes from `styles.css` for styling

### 9.2 CSS Design System (`src/styles.css`)

**Color tokens:**
```css
--ink: #e7e1d4;      /* primary text (bone) */
--muted: #9b978d;    /* secondary text */
--faint: #6d6a62;    /* tertiary text */
--ground: #151513;   /* main background (charcoal) */
--panel: #1d1d1a;    /* panel background */
--raised: #26251f;   /* elevated surface */
--line: #3a3932;     /* borders */
--bronze: #a78652;   /* accent/active */
--olive: #747b5d;    /* positive/success */
--burgundy: #7a4545; /* danger/harm */
--slate: #697282;    /* neutral info */
```

**Fonts:**
- Display: "Iowan Old Style", Palatino, Georgia, serif
- Numbers: "Cascadia Mono", Consolas, monospace

**Layout:**
- Top status bar: hero count, game time, resources
- Bottom navigation: Heroes, Party, Refuge, Rift
- System panels: 820px max, right-aligned
- Roster grid: auto-fill 138px minimum cards
- Responsive breakpoints: 900px, 620px
- Reduced motion support via `prefers-reduced-motion`

### 9.3 Panel Overview

| Panel | File | Purpose |
|-------|------|---------|
| HudShell | `HudShell.ts` | Top bar + bottom nav |
| SelectionOverlay | `SelectionOverlay.ts` | Hero detail (4 tabs) |
| HeroRosterOverlay | `HeroRosterOverlay.ts` | Hero card grid |
| SquadOverlay | `SquadOverlay.ts` | Formation editor |
| ExpeditionOverlay | `ExpeditionOverlay.ts` | Mission briefing/combat/debrief |
| CombatOverlay | `CombatOverlay.ts` | Sandbox combat viewer |
| DebugOverlay | `DebugOverlay.ts` | F3 diagnostics |
| NotificationCenter | `NotificationCenter.ts` | Event feed |
| ControlsHint | `ControlsHint.ts` | Camera controls hint |
| SocialLogOverlay | `SocialLogOverlay.ts` | Social event log |

### 9.4 SelectionOverlay (Hero Detail)

The most complex panel. 4 tabs:
- **Overview:** Identity, status, needs meters, traits, attributes, personality
- **Skills:** Skill forge list with loadout toggles
- **Training:** Injury cards with treat buttons, training queue
- **Relations:** All relationships sorted by affinity

Also shows memorial records for fallen heroes.

---

## 10. How to Modify (Recipes)

### 10.1 Add a New Occupation

**File:** `src/heroes/OccupationDefinitions.ts`

Add an entry to the `OCCUPATIONS` array:

```typescript
{
  name: "Blacksmith",
  category: "Skilled",
  rarity: "Specialized",
  selectionWeight: 4,                // probability weight (higher = more common)
  aptitudes: ["Metalwork", "Forge craft", "Endurance"],
  attributeModifiers: { strength: 2, endurance: 1 },
  skillModifiers: { defense: 2, sword: 1 },
  visualModifiers: { armThickness: 1.1, shoulderWidth: 1.05 }, // optional
},
```

**Fields:**
- `selectionWeight`: Controls how often this occupation appears. Farmer=8 (common), Elite Knight=1 (rare).
- `attributeModifiers`: Added to random base attributes (2-6). Capped at 10.
- `skillModifiers`: Added to random base skills (0-3). Capped at 10.
- `aptitudes`: Flavor text, but also used by `HeroSkillGenerator` to discover skills (e.g., "Tracking" aptitude can unlock the Tracking skill).
- `visualModifiers`: Optional body proportion tweaks.

**Also update:** If the occupation has a unique name, you may need to add it to the `NameGenerator` pools if you want matching names.

### 10.2 Add a New Skill

**Step 1:** Add the definition in `src/skills/SkillDefinitionRegistry.ts`:

```typescript
{ affinity: "defense", category: "combat", description: "A powerful counter-attack after blocking.", id: "riposte", maxLevel: 10, name: "Riposte", prerequisites: [{ definitionId: "parry", kind: "skill", level: 2 }], rarity: "rare", type: "active" },
```

**Fields:**
- `id`: Unique snake_case identifier (used everywhere)
- `affinity`: Which affinity type this skill relates to (sword, spear, defense, support, survival, magic)
- `type`: `active` (loadout slot), `passive` (loadout slot), `reaction` (always active), `utility` (exploration)
- `prerequisites`: Array of requirements (skill level, attribute minimum, or trait)
- `evolutions`: Other skill IDs this can evolve into

**Step 2:** If the skill should be discoverable at hero creation, add logic in `src/skills/HeroSkillGenerator.ts` in the `discoverInnateSkills()` method.

**Step 3:** If the skill has combat effects, add handling in `src/combat/CombatSimulation.ts` where other skills are checked (search for `preparedSkillIds.has`).

**Step 4:** If the skill should be discoverable via the discovery system, add prerequisite chains in `src/skills/SkillDiscoverySystem.ts`.

### 10.3 Add a New Injury Type

**Step 1:** Add the type to the union in `src/heroes/Hero.ts`:

```typescript
export type InjuryType = "Broken Arm" | "Burn" | "Concussion" | "Minor Wound" | "Poison";
```

**Step 2:** Add the definition in `src/heroes/InjurySystem.ts`:

```typescript
Poison: Object.freeze({
  attackMultiplier: 0.85,
  defenseMultiplier: 0.85,
  description: "Toxin spreads through the body. Attack -15% · Defense -15%.",
  recoveryMinutes: 36 * HOUR,       // 36 hours
  trainingMultiplier: 0.70,
  treatmentCost: 2,
}),
```

**Fields:**
- `attackMultiplier`: Multiplied with hero's attack (1.0 = no penalty, 0.8 = -20%)
- `defenseMultiplier`: Multiplied with hero's defense
- `trainingMultiplier`: Multiplied with training rate
- `recoveryMinutes`: Game minutes to recover naturally
- `treatmentCost`: Medicine required to treat

**Step 3:** If this injury can be inflicted in combat, add logic in `src/combat/CombatSimulation.ts` where expedition injuries are rolled.

### 10.4 Add a New Combat Action to Utility AI

**File:** `src/combat/UtilityAI.ts`

**Step 1:** Add the action to the `CombatAction` type union in `src/combat/Combat.ts`:

```typescript
export type CombatAction = "Attack" | "Dead" | "Defend" | "Heal" | "Idle" | "Move" | "Protect" | "Reposition" | "Retreat" | "Taunt";
```

**Step 2:** Add it to `ACTION_ORDER` in UtilityAI.ts:

```typescript
const ACTION_ORDER: readonly UtilityAction[] = [
  "Attack", "Defend", "Retreat", "Protect", "Heal", "Reposition", "Taunt",
];
```

**Step 3:** Add scoring logic in the `raw` record inside `scoreCombatActions()`:

```typescript
Taunt: {
  reason: dominantReason([
    [aggression * 20, "aggression"],
    [actor.role === "Vanguard" ? 18 : 0, "vanguard role"],
  ]),
  score: 20 + aggression * 20 + (actor.role === "Vanguard" ? 18 : 0),
  targetId: preferredEnemy?.id ?? null,
  valid: Boolean(preferredEnemy && enemyDistance <= 4),
},
```

**Step 4:** Add execution logic in `CombatSimulation.ts` where actions are processed in the tick loop.

### 10.5 Add a New UI Panel

**Step 1:** Create the panel class in `src/ui/`:

```typescript
export class MyNewPanel {
  private root: HTMLElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "system-panel";
    this.root.style.display = "none";
    // Build your DOM here
    const title = document.createElement("h2");
    title.textContent = "My New Panel";
    this.root.appendChild(title);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  update(data: any): void {
    // Update panel content with fresh data
  }

  show(): void { this.root.style.display = ""; }
  hide(): void { this.root.style.display = "none"; }

  dispose(): void {
    this.root.remove();
  }
}
```

**Step 2:** Add it to `Game.ts` constructor:

```typescript
this.myPanel = new MyNewPanel();
this.myPanel.mount(container);
```

**Step 3:** Wire it into the navigation or panel management in `Game.ts`. Add a button to `HudShell.ts` if it needs a nav entry.

**Step 4:** Call `this.myPanel.update(data)` in `Game.frame()` with the relevant data.

### 10.6 Add a New Hero Trait

**File:** `src/heroes/HeroGenerator.ts`

**Step 1:** Add the trait name to the `traitCandidates` array in `generateTraits()`:

```typescript
{ name: "Stoic", score: willpower * 0.6 + (1 - empathy) * 0.4 },
```

The trait is scored against the hero's personality/attributes. Top 1-3 traits are selected.

**Step 2:** If the trait has gameplay effects, add checks where other traits are checked:

- Combat effects: `src/combat/UtilityAI.ts` (search for `actor.traits.includes`)
- Movement/behavior: `src/heroes/NeedsSystem.ts` or `src/heroes/HeroRoutineSystem.ts`
- Training effects: `src/heroes/TrainingSystem.ts`

**Current traits and their effects:**
- Hard Worker: bonus to training rate (via discipline score)
- Cowardly: higher retreat threshold in combat
- Protective: enables Interpose and Protective Instinct skills, bonus to Protect action
- Reckless: bonus to Attack action score
- Patient: reduces training injury chance
- Loyal: reduces retreat score, increases Protect score
- Ambitious: (currently flavor only)
- Natural Leader: (currently flavor only)

### 10.7 Change Balance Numbers

Here's where the key tunable numbers live:

| What | File | Constant/Formula |
|------|------|-----------------|
| Damage dealt | `CombatSimulation.ts` | `max(1, round(attacker.attack - effectiveDefense * 0.72))` |
| Healing amount | `CombatSimulation.ts` | `max(5, round(5 + medicine * 2.5))` |
| Skill XP gain | `SkillProgressionSystem.ts` | `max(1, round(baseXp * (0.72 + affinity * 0.56) * successMod * diffMod))` |
| XP to level up | `SkillProgressionSystem.ts` | `48 + level * 18` |
| Training rate | `TrainingSystem.ts` | `0.42 + discipline * 0.16 + endurance * 0.01` |
| Training injury chance | `TrainingSystem.ts` | `min(0.28, (fatigue - 68) / 100 - endurance * 0.025)` |
| Movement speed | `HeroRoutineSystem.ts` | `1.35 + agility * 0.075` |
| Hunger decay | `NeedsSystem.ts` | `-4.5 per game hour` |
| Fatigue gain (training) | `NeedsSystem.ts` | `+9 per game hour` |
| Recovery rate | `InjurySystem.ts` | `0.7 + endurance * 0.035` per game minute |
| Combat tick rate | `CombatSimulation.ts` | `0.1 seconds` (10 ticks/sec) |
| Game time speed | `Simulation.ts` | `12 game minutes per real second` |
| Enemy base stats | `CombatSimulation.ts` | attack: 28, defense: 8, hp: 74, range: 1.75, speed: 1.8 |
| Enemy strength scaling | `ExpeditionSystem.ts` | `0.82` (82% of base stats) |

### 10.8 Add a New Need/Stat

**Step 1:** Add the field to `HeroNeeds` in `src/heroes/Hero.ts`:

```typescript
export interface HeroNeeds {
  fatigue: number;
  health: number;
  hunger: number;
  morale: number;
  social: number;
  stress: number;
  thirst: number;  // new
}
```

**Step 2:** Add decay logic in `src/heroes/NeedsSystem.ts`:

```typescript
// In the step() method, add:
hero.needs.thirst -= 3.5 * gameHours; // decays at 3.5 per game hour
if (hero.movement.activity === "Eating") {
  hero.needs.thirst += 20 * gameHours; // recovers while eating
}
hero.needs.thirst = clamp(hero.needs.thirst, 0, 100);
```

**Step 3:** Add activity selection logic if the need should override scheduled activities:

```typescript
if (hero.needs.thirst < 30) {
  return { activity: "Eating", reason: "Thirst override" };
}
```

**Step 4:** Update the UI to display the new need (add a meter in `SelectionOverlay.ts`).

**Step 5:** Initialize the new need in `HeroGenerator.ts` with a starting value.

### 10.9 Modify the 3D Scene

**File:** `src/rendering/ProceduralBaseScene.ts`

The scene is built procedurally in the `build()` method. To add a new object:

```typescript
// Example: add a well
const wellGeometry = new THREE.CylinderGeometry(1.5, 1.5, 1.2, 16);
const wellMaterial = new THREE.MeshStandardMaterial({ color: 0x666655 });
const well = new THREE.Mesh(wellGeometry, wellMaterial);
well.position.set(5, 0.6, 8); // x, y (half height), z
well.castShadow = true;
well.receiveShadow = true;
this.scene.add(well);
```

**Key patterns:**
- Use `MeshStandardMaterial` for most objects (PBR shading)
- Set `castShadow = true` and `receiveShadow = true` for shadows
- Position objects relative to the platform center (0, 0, 0)
- The ground is at y=0, platform surface is at y~0.63
- Add to `this.scene` directly for static objects
- Add to `this.propGroup` for props that might need cleanup
- Add to `this.memorialGroup` for memorial-specific objects

**To modify existing objects:**
- Campfire flames: search for `flame` in the build method
- Facility zones: search for `facilityZone` 
- Hero spawn points: edit `NavigationPoints.ts`

---

## 11. Key Constants Reference

| Constant | Value | File |
|----------|-------|------|
| Squad size | 3 | `src/squads/SquadSystem.ts` |
| Max training slots | 3 | `src/heroes/TrainingSystem.ts` |
| Active skill loadout slots | 4 | `src/skills/SkillLoadoutSystem.ts` |
| Passive skill loadout slots | 4 | `src/skills/SkillLoadoutSystem.ts` |
| Combat tick rate | 0.1 sec | `src/combat/CombatSimulation.ts` |
| Max combat ticks | 600 | `src/combat/CombatSimulation.ts` |
| Injury check interval | 60 game min | `src/heroes/TrainingSystem.ts` |
| Interaction distance | 12 units | `src/heroes/RelationshipSystem.ts` |
| Max relationship events | 12 | `src/heroes/RelationshipSystem.ts` |
| Max relationship history | 8 entries | `src/heroes/RelationshipSystem.ts` |
| Max loss memories | 12 | `src/heroes/LegacySystem.ts` |
| Game minutes/real second | 12 | `src/simulation/Simulation.ts` |
| Starting time | 07:00 (420 min) | `src/simulation/Simulation.ts` |
| Initial hero count | 5 | `src/simulation/Simulation.ts` |
| Fixed timestep | 0.05 sec (20Hz) | `src/core/GameClock.ts` |
| Max frame time | 0.25 sec | `src/core/GameClock.ts` |
| Max steps/frame | 5 | `src/core/GameClock.ts` |
| Camera pan speed | 7.5 units/sec | `src/rendering/CameraController.ts` |
| Camera rotation speed | 1.15 rad/sec | `src/rendering/CameraController.ts` |
| Camera min distance | 30 | `src/rendering/CameraController.ts` |
| Camera max distance | 84 | `src/rendering/CameraController.ts` |
| Movement speed formula | 1.35 + agility * 0.075 | `src/heroes/HeroRoutineSystem.ts` |
| Attribute generation range | 2-6 | `src/heroes/HeroGenerator.ts` |
| Skill generation range | 0-3 | `src/heroes/HeroGenerator.ts` |
| Personality range | 0.12-0.90 | `src/heroes/HeroGenerator.ts` |
| Hidden potential range | 0.25-0.98 | `src/heroes/HeroGenerator.ts` |
| Max attribute cap | 10 | `src/heroes/HeroGenerator.ts` |
| Hero count (initial) | 5 | `src/simulation/Simulation.ts` |

---

## 12. File Index

### Core Engine
| File | Purpose |
|------|---------|
| `src/main.ts` | Entry point. Creates Game, calls start(). |
| `src/core/Game.ts` | Central orchestrator. Game loop, panel management, navigation. |
| `src/core/GameClock.ts` | Fixed-timestep accumulator (20Hz). |
| `src/core/EventBus.ts` | Generic typed pub/sub event system. |
| `src/core/Random.ts` | Seeded PRNG (xorshift32). |
| `src/core/Renderer.ts` | Three.js renderer wrapper. Scene swapping, input gating. |

### Simulation
| File | Purpose |
|------|---------|
| `src/simulation/Simulation.ts` | Top-level simulation coordinator. Time system. |

### Heroes
| File | Purpose |
|------|---------|
| `src/heroes/Hero.ts` | Complete hero data model (15+ interfaces). |
| `src/heroes/HeroGenerator.ts` | Procedural hero creation. |
| `src/heroes/HeroManager.ts` | Hero lifecycle management. |
| `src/heroes/NameGenerator.ts` | Fantasy name generation. |
| `src/heroes/OccupationDefinitions.ts` | 35 occupation definitions. |
| `src/heroes/NeedsSystem.ts` | Hunger, fatigue, health, morale, social, stress. |
| `src/heroes/HeroRoutineSystem.ts` | Daily schedule, movement, navigation. |
| `src/heroes/TrainingSystem.ts` | Training queue and completion. |
| `src/heroes/InjurySystem.ts` | 4 injury types, treatment, recovery. |
| `src/heroes/RelationshipSystem.ts` | 6-metric relationship simulation. |
| `src/heroes/LegacySystem.ts` | Death memorialization, survivor reactions. |

### Skills
| File | Purpose |
|------|---------|
| `src/skills/Skill.ts` | Skill data model and types. |
| `src/skills/SkillDefinitionRegistry.ts` | 18 static skill definitions. |
| `src/skills/HeroSkillGenerator.ts` | Initial skill generation per hero. |
| `src/skills/SkillProgressionSystem.ts` | XP, leveling, proficiency. |
| `src/skills/SkillDiscoverySystem.ts` | Prerequisite-based skill unlocking. |
| `src/skills/SkillLoadoutSystem.ts` | Active/passive loadout management. |
| `src/skills/SkillEvolutionSystem.ts` | Evolution chains (stub). |

### Combat
| File | Purpose |
|------|---------|
| `src/combat/Combat.ts` | Combat data model and types. |
| `src/combat/CombatSimulation.ts` | Tick-based combat simulation. |
| `src/combat/UtilityAI.ts` | Action scoring AI brain. |
| `src/combat/FormationSystem.ts` | Formation position to combat role mapping. |

### Squads
| File | Purpose |
|------|---------|
| `src/squads/Squad.ts` | Squad data model. |
| `src/squads/SquadSystem.ts` | Squad CRUD, evaluation, chemistry. |

### Expeditions
| File | Purpose |
|------|---------|
| `src/expeditions/Expedition.ts` | Expedition data model. |
| `src/expeditions/ExpeditionSystem.ts` | Expedition lifecycle (brief/combat/debrief). |

### Base
| File | Purpose |
|------|---------|
| `src/base/NavigationPoints.ts` | Movement waypoints and facility zones. |

### Rendering
| File | Purpose |
|------|---------|
| `src/rendering/CameraController.ts` | WASD/QE/scroll camera. |
| `src/rendering/SelectionRaycaster.ts` | Click-to-select 3D objects. |
| `src/rendering/ProceduralBaseScene.ts` | Entire 3D refuge scene. |
| `src/rendering/heroes/HeroRenderer.ts` | Hero mesh placement and animation. |
| `src/rendering/heroes/HeroMeshGenerator.ts` | Procedural hero mesh construction. |
| `src/rendering/heroes/HeroPortraitCache.ts` | Offscreen portrait rendering. |
| `src/rendering/combat/CombatArenaScene.ts` | 3D combat arena. |

### UI
| File | Purpose |
|------|---------|
| `src/ui/HudShell.ts` | Top status bar + bottom navigation. |
| `src/ui/SelectionOverlay.ts` | Hero detail panel (4 tabs). |
| `src/ui/HeroRosterOverlay.ts` | Hero card grid with filters. |
| `src/ui/SquadOverlay.ts` | Formation editor, role assignment. |
| `src/ui/ExpeditionOverlay.ts` | Mission briefing/combat/debrief. |
| `src/ui/CombatOverlay.ts` | Sandbox combat viewer with AI debug. |
| `src/ui/DebugOverlay.ts` | F3 developer diagnostics. |
| `src/ui/NotificationCenter.ts` | Event-driven notification feed. |
| `src/ui/ControlsHint.ts` | Camera controls hint overlay. |
| `src/ui/SocialLogOverlay.ts` | Social event log. |

### Config
| File | Purpose |
|------|---------|
| `src/styles.css` | Global CSS (dark-fantasy UI design system). |
| `src/vite-env.d.ts` | Vite environment type declarations. |
| `index.html` | HTML entry point. |
| `package.json` | Project manifest. |
| `tsconfig.json` | TypeScript configuration. |

### Docs
| File | Purpose |
|------|---------|
| `ASCENT_Full_Game_Concept.md` | Complete game design document. |
| `ASCENT_Development_Phases.md` | 45-phase implementation roadmap. |
| `DEVELOPER_TUTORIAL.md` | This file. |
| `refference.txt` | Standalone character generator prototype. |

---

## Appendix: Architecture Decisions FAQ

**Q: Why no state management library (Redux, Zustand, etc.)?**
A: The game has a single source of truth: `Simulation`. UI panels just read from it. There's no complex state synchronization needed.

**Q: Why procedural geometry instead of 3D models?**
A: Zero asset pipeline overhead. No loading screens. No licensing. Every hero looks unique through parameterized generation. The tradeoff is visual fidelity is low-poly/stylized.

**Q: Why vanilla DOM instead of a UI framework?**
A: The UI is panels over a 3D canvas. Framework overhead (React reconciliation, virtual DOM) would add complexity for no benefit. Vanilla DOM is fast enough for this use case and has zero bundle cost.

**Q: Why fixed timestep?**
A: Determinism. If the simulation ran at variable speed, hero generation, combat outcomes, and relationship calculations would vary between machines. Fixed timestep ensures the same seed produces the same game on any hardware.

**Q: How do I add sound/audio?**
A: Not yet implemented (planned for Phase 39). When you do, the `EventBus` is the right place to emit audio triggers. Create an `AudioManager` class that subscribes to game events and plays sounds.

**Q: How do I add a save system?**
A: Not yet implemented (planned). The `storage/` directory is a placeholder. The design doc specifies IndexedDB. Serialize `Simulation` state (heroes, squads, time, resources) to JSON, store in IndexedDB, restore on load.

**Q: How do I add multiplayer/networking?**
A: Not designed for this. The simulation is single-process. For networking, you'd need to: (1) serialize simulation steps, (2) run simulation server-side, (3) send snapshots to clients, (4) clients only render and send input commands.
