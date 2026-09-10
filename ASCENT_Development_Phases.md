# ASCENT — Detailed Development Phases

This roadmap is designed for a solo developer building the game with:

```text
Vite
TypeScript
Three.js
HTML/CSS
IndexedDB
```

The most important development rule is:

> **Do not build the entire game at once. Build one complete playable loop first.**

The target loop is:

```text
Hero
→ Train
→ Build Squad
→ Expedition
→ Combat
→ Return
→ Consequences
→ Repeat
```

## Current Implementation Status — September 10, 2026

```text
Gameplay phases implemented: 0–18
Current playable milestone: Rift-funded procedural recruitment through the Dimensional Gate
Current UI milestone: Current-System Client Foundation complete
Next gameplay phase: Phase 19 — Hero Capacity and Dormitories
```

The Phase 13 client now exposes only implemented player destinations:

- **Heroes** — roster filters, cached procedural portraits, and shared hero details
- **Party** — three-member Front/Middle/Back formation and real squad evaluation
- **Refuge** — the living 3D simulation and world selection
- **Rift** — expedition briefing, combat, results, and return

Developer diagnostics and the Phase 9 Arena remain available through the `F3` drawer. They are not
part of player navigation. Future systems must not receive a destination, resource counter, or
placeholder panel before their gameplay phase exists.

Phase 18 is complete. Phase 19 and later remain design context and require a new implementation
approval boundary.

Approved future technical direction: the existing standalone character-generator prototype will be
adapted into ASCENT as the **Procedural Character Forge**. Its human hero-generation core is now
active through Phase 18 recruitment inside Heroes. It does not add a fifth destination or expose
prototype races, classes, equipment, enemies, sliders, or localStorage authoring controls.

---

# Phase 0 — Project Foundation

## Goal

Create the technical foundation and enforce architectural separation.

## Tasks

### 0.1 Initialize Project

Create:

```bash
npm create vite@latest ascent -- --template vanilla-ts
cd ascent
npm install
npm install three
```

Optional type package if needed by the current Three.js setup.

### 0.2 Project Structure

Create:

```text
src/

core/
simulation/
heroes/
training/
classes/
combat/
squads/
expeditions/
base/
world/
rendering/
ui/
storage/
```

### 0.3 Core Rules

Establish:

```text
Simulation != Rendering
```

Hero data must not live directly inside Three.js objects.

Example:

```ts
HeroState
```

is authoritative.

```ts
HeroMesh
```

only displays it.

### 0.4 Game Bootstrap

Create:

```text
Game.ts
Renderer.ts
GameClock.ts
EventBus.ts
```

### 0.5 Game Loop

Use separate timing for:

- Rendering
- Simulation ticks

Example:

```text
Rendering:
requestAnimationFrame

Simulation:
fixed timestep
```

### 0.6 Basic Debug Overlay

Display:

- FPS
- Simulation tick
- Game time
- Hero count

## Exit Criteria

Phase 0 is complete when:

- Three.js scene loads
- Camera works
- Game clock runs
- Simulation tick runs
- No gameplay logic lives in rendering

---

# Phase 1 — Procedural Base Scene

## Goal

Create the first playable 3D refuge.

## Tasks

### 1.1 Ground

Create:

- Flat terrain
- Base platform
- Grid helper for development

### 1.2 Lighting

Add:

- Ambient light
- Directional light
- Shadows
- Fog

### 1.3 Camera Controller

Implement:

```text
WASD = Pan
Mouse Wheel = Zoom
Q/E = Rotate
```

### 1.4 Base Props

Procedurally generate:

- Campfire
- Crates
- Training dummy
- Basic tent
- Storage pile

### 1.5 Facility Zones

Add placeholder areas for:

- Dormitory
- Training
- Storage
- Gate

### 1.6 Selection Raycasting

Implement clicking world objects.

## Exit Criteria

Player can navigate a small 3D base and click objects.

---

# Phase 2 — Procedural Hero Generator

## Goal

Generate unique low-poly heroes without external character assets.

## Tasks

### 2.1 Hero Data Model

Create:

```ts
interface Hero {
  id: string;
  name: string;
  age: number;
  level: number;
  rank: number;
  health: number;
  morale: number;
  skills: HeroSkills;
  personality: Personality;
  traits: string[];
  relationships: Record<string, number>;
}
```

### 2.2 Name Generator

Create lists for:

- First names
- Last names

### 2.3 Appearance Generator

Generate:

- Height
- Body width
- Skin tone
- Hair
- Hair color
- Clothing color

### 2.4 Primitive Hero Mesh

Use:

- Sphere or low-poly head
- Box torso
- Cylinder limbs

### 2.5 Spawn System

Spawn 5 heroes.

### 2.6 Hero Selection

Clicking a hero should:

- Highlight them
- Open hero panel

## Exit Criteria

Five visually different procedural heroes exist and can be selected.

## Future Extension Contract — Procedural Character Forge

Phase 2 remains the authoritative baseline for generated hero identity and appearance. The
standalone Forge prototype is an approved source of procedural techniques, not a replacement game
client. Its reusable body proportions, modular low-poly geometry, hair variants, color controls,
animation reference joints, seeded presets, and JSON configuration will be migrated incrementally.

The integration must preserve these boundaries:

- `HeroGenerator` owns gameplay identity, occupation, attributes, personality, traits, skills,
  potential, and the initial appearance selection.
- A plain `CharacterAppearanceConfig` carries visual parameters without gameplay state.
- One explicit seeded `Random` stream produces reproducible appearance choices; generation code
  must not use global `Math.random()`.
- A reusable character-mesh factory consumes appearance data and returns disposable Three.js
  objects; it never becomes the authoritative hero record.
- Existing portrait generation and live Refuge rendering consume the same appearance configuration.
- Prototype JSON may be imported through a validated compatibility adapter for development presets,
  but browser `localStorage` is not an authoritative game-save format.
- The project uses its installed Three.js package and local typography; the prototype's CDN script,
  external fonts, editor shell, and glow-heavy presentation are not carried into the game client.

Activation is phase-gated: Phase 18 uses the human hero-generation core, Phase 22 may activate
visual equipment modules, and Phase 24 may activate class-linked presentation. Additional fantasy
races, magical effects, and enemy tiers remain unapproved future content until their own gameplay
and lore phases define them.

---

# Phase 3 — Hero Identity and Stats

## Goal

Make heroes mechanically different.

## Tasks

### 3.1 Core Attributes

Implement:

```text
Strength
Agility
Endurance
Intelligence
Willpower
Leadership
```

### 3.2 Skills

Implement initial:

```text
Sword
Spear
Medicine
Defense
Leadership
```

### 3.3 Personality

Implement:

```text
Bravery
Discipline
Aggression
Empathy
Loyalty
Ambition
```

### 3.4 Traits

Generate 1–3 initial traits.

Example:

```text
Hard Worker
Cowardly
Protective
Reckless
Patient
```

### 3.5 Hidden Potential

Add internal potential values.

Do not display exact values to player.

### 3.6 Previous Occupation

Examples:

```text
Farmer
Nurse
Soldier
Student
Mechanic
Hunter
Teacher
```

Occupations influence initial skills.

Treat this as origin occupation, separate from future class and refuge social role. Expand the pool
across civilian, skilled, underworld, military, leadership, wilderness, and rare backgrounds. Store
origin category, rarity, and practical aptitudes. Civilian origins remain most common; rare origins
use lower generation weights. All heroes still begin with class `Unclassified` and social role
`Resident` until those later systems are implemented.

## Exit Criteria

Two randomly generated heroes should feel mechanically different.

---

# Phase 4 — Base Hero Movement

## Goal

Make heroes visibly live inside the refuge.

## Tasks

### 4.1 Navigation Points

Create nodes:

- Dormitory
- Training area
- Campfire
- Storage
- Idle areas

### 4.2 Basic Movement

Heroes move between points.

### 4.3 Hero States

Implement:

```text
Idle
Walking
Training
Eating
Resting
Socializing
```

### 4.4 Simple Animation

Procedural movement:

- Arm swing
- Leg swing
- Body bob

### 4.5 Schedule

Basic daily schedule:

```text
Morning → Eat
Day → Train/Work
Evening → Socialize
Night → Sleep
```

## Exit Criteria

Heroes walk around and perform basic visible routines.

---

# Phase 5 — Needs System

## Goal

Give heroes internal needs that affect behavior.

## Tasks

Implement:

```text
Hunger
Fatigue
Morale
Health
Stress
Social
```

### 5.1 Hunger

Decrease over time.

Eating restores it.

### 5.2 Fatigue

Activities increase fatigue.

Sleeping restores it.

### 5.3 Morale

Affected by:

- Rest
- Social interactions
- Hunger
- Injuries

### 5.4 Stress

Increases from:

- Combat
- Death
- Injury

## Exit Criteria

Heroes make different choices because of their needs.

---

# Phase 6 — Relationship System

## Goal

Create basic social simulation.

## Tasks

### 6.1 Relationship Matrix

Each hero tracks other heroes.

Each directional entry stores affinity, trust, respect, fear, jealousy, rivalry, and a bounded event
history. Labels are derived from this profile; they do not replace it.

### 6.2 Social Interaction

Heroes occasionally interact.

### 6.3 Relationship Modifiers

Examples:

```text
Friendly conversation +2
Argument -4
Training together +1
Helping injured hero +5
```

### 6.4 Relationship Labels

Display:

```text
Enemy
Dislike
Neutral
Friend
Close Friend
```

Also support contextual summaries such as Companion, Trusted Friend, Rival, and Distrust when the
underlying dimensions justify them. A rival can have high respect without high affinity.

### 6.5 Event Logging

Display social events.

## Exit Criteria

Heroes naturally form likes and dislikes.

---

# Phase 7 — Training System

## Goal

Allow heroes to improve while living in the base.

## Tasks

### 7.1 Training Types

Start with:

```text
Strength Training
Weapon Training
Defense Training
```

### 7.2 Training Queue

Player assigns training.

### 7.3 Training Progress

Improves relevant skill.

### 7.4 Fatigue Cost

Training increases fatigue.

### 7.5 Injury Chance

Excessive training may cause minor injury.

### 7.6 Training Animation

Hero physically moves to training area.

## Exit Criteria

Player can deliberately develop heroes.

---

# Phase 8 — Squad System

## Goal

Allow the player to form expedition teams.

## Tasks

### 8.1 Squad Data Model

Example:

```ts
interface Squad {
  id: string;
  name: string;
  heroIds: string[];
  formation: Formation;
  doctrine: Doctrine;
}
```

### 8.2 Initial Squad Size

Start with:

```text
3 heroes
```

### 8.3 Formation UI

Allow:

```text
Front
Middle
Back
```

### 8.4 Roles

Add:

```text
Vanguard
Damage
Support
```

### 8.5 Basic Team Evaluation

Display:

- Average level
- Combat power
- Healing
- Defense

Also display initial squad cohesion and trust derived from member relationships. These are
descriptive during Phase 8; combat bonuses remain deferred until combat and Utility AI exist.

## Exit Criteria

Player can create and edit a 3-person squad.

---

# Phase 9 — Combat Sandbox

## Goal

Build combat independently before expeditions.

## Tasks

### 9.1 Separate Arena Scene

Create small combat arena.

### 9.2 Enemy Model

Create primitive enemy.

### 9.3 Combat Stats

Implement:

```text
HP
Attack
Defense
Range
Speed
```

### 9.4 Basic Actions

Implement:

```text
Move
Attack
Defend
Retreat
```

### 9.5 Combat Tick

Combat should run through simulation ticks.

### 9.6 Damage Calculation

Create predictable initial formula.

### 9.7 Death

Hero reaches 0 HP.

## Exit Criteria

Three heroes can autonomously fight enemies.

---

# Phase 10 — Utility AI

## Goal

Make combat behavior intelligent enough to watch.

## Tasks

### 10.1 Action Scoring

Possible actions:

```text
Attack
Defend
Retreat
Protect
Heal
Reposition
```

### 10.2 Scoring Inputs

Use:

- Distance
- HP
- Enemy threat
- Personality
- Role
- Relationships

### 10.3 Personality Modifiers

Examples:

```text
Bravery increases attack score.
Cowardice increases retreat score.
Protective trait increases protect score.
```

### 10.4 Debug View

Show selected hero's action scores.

Example:

```text
Attack: 72
Protect: 44
Retreat: 12
```

## Exit Criteria

Heroes choose noticeably different actions because of personality and context.

---

# Phase 11 — Combat Roles and Formation

## Goal

Make squad composition matter.

## Tasks

### 11.1 Formation Positions

Implement:

```text
Front
Mid
Back
```

### 11.2 Tank Behavior

Defenders:

- Stay near frontline
- Protect backline

### 11.3 Ranged Behavior

Ranged heroes:

- Maintain distance

### 11.4 Medic Behavior

Medics:

- Prioritize wounded allies

### 11.5 Target Priority

Add tactical preferences.

## Exit Criteria

Changing formation changes battle outcomes.

---

# Phase 12 — Hero Skill Forge

## Goal

Replace the temporary flat skill values with individual, learnable skill records so heroes can
begin developing distinct builds before the first expedition loop is added.

`Hero Skill Forge` is the umbrella feature. Do not implement it as one catch-all class. Use these
bounded systems:

```text
SkillDefinitionRegistry  Static definitions, prerequisites, rarity, and evolution links
HeroSkillGenerator       Starting affinities, innate skills, and initial proficiency
SkillProgressionSystem   Usage XP, levels, proficiency, and mastery
SkillLoadoutSystem       Known skills versus prepared active and passive skills
SkillDiscoverySystem     Condition evaluation for emergent unlocks
SkillEvolutionSystem     Linear upgrades and behavior-shaped branches
SkillLegacySystem        Mentor and death-linked inheritance added in later phases
```

## Tasks

### 12.1 Skill Data Model

Add per-hero skill instances:

```ts
interface HeroSkill {
  definitionId: string;
  level: number;
  xp: number;
  proficiency: number;
  source: "innate" | "training" | "combat" | "mentor" | "awakening";
  mastery: boolean;
}
```

Keep definitions separate from hero-owned progress:

```ts
interface SkillDefinition {
  id: string;
  name: string;
  type: "active" | "passive" | "reaction" | "utility";
  category: "weapon" | "combat" | "survival" | "support" | "mental" | "unique";
  rarity: "common" | "uncommon" | "rare" | "elite" | "unique" | "legendary";
  maxLevel: number;
  prerequisites?: SkillRequirement[];
  evolutions?: string[];
}
```

### 12.2 Definition Registry

Seed a deliberately small vertical slice:

- Sword and Spear Mastery
- Basic Thrust, Lunge, Brace, Parry, and Interpose
- Medicine, Field Treatment, Tracking, and Scouting
- Fear Resistance, Battle Focus, and Protective Instinct

Rarity describes availability and conditions, not guaranteed power.

### 12.3 Hero Skill Generator

Generate hidden affinities for weapon, defense, support, survival, and future magical disciplines.
Use origin occupation, attributes, personality, and rare potential to select a few innate skills.
Occupation influences the result but never determines a fixed build.

### 12.4 Individual Progression

Award skill XP from actual use instead of increasing every skill on hero level-up:

```text
Use technique → XP
Successful result → bonus XP
Stronger opponent or difficult task → bonus XP
```

Level controls raw strength. Proficiency controls execution speed, accuracy, cost, failure chance,
and AI confidence. Mastery at maximum level enables a later evolution opportunity.

### 12.5 Training and Combat Events

Update Phase 7 training and the combat sandbox to emit typed skill-usage events. The progression
system consumes those events; renderers and UI must never become authoritative skill state.

### 12.6 Known Skills and Loadout

Separate all known skills from the prepared combat loadout:

```text
Active slots: 4
Passive slots: 4
Reaction and instinct skills: automatic when valid
```

Utility AI may only score prepared active skills plus valid automatic reactions.

### 12.7 Discovery and Evolution Hooks

Create deterministic condition and event contracts for discovery, branching, and awakening, but
only activate conditions supported by existing systems. Keep unknown possibilities displayed as
`???`; do not expose hidden thresholds.

### 12.8 Skill UI

Show known skills, level, XP progress, proficiency, source, loadout state, and mastery. Preserve a
compact summary for the existing Sword, Spear, Defense, Medicine, and Leadership values during the
migration.

### 12.9 Compatibility Migration

Map the current flat `HeroSkills` values into equivalent skill instances without changing existing
training, squad evaluation, Utility AI, or combat results until their consumers are deliberately
moved to the new APIs.

## Later Activation Map

- Phase 13 expeditions: award Survival and Support usage and discovery events.
- Phase 14 injuries: add injury-driven progression and recovery restrictions.
- Phase 15 permanent death: emit legacy events, but do not copy skills directly.
- Phase 16 memories: let memories satisfy discovery and awakening context.
- Phase 17 trait evolution: unlock Mental and instinct skills from repeated behavior.
- Phase 24 classes: provide easier access to specialized skills without erasing old skills.
- Phase 25 branching classes: connect class paths to skill branches and mastery options.
- Phase 26 mentorship: enable XP bonuses, technique transfer, and personalized variants.
- Phase 35 hero history: record usage, breakthroughs, awakenings, and mastered skills.
- Phase 42 balance: tune proficiency decay; skill level never decays.

## Exit Criteria

Two heroes using the same weapon can own different skills, improve those skills independently
through training or combat, prepare different loadouts, and expose the reasons for every unlock.
Existing Phase 0–11 behavior remains stable through the compatibility layer.

---

# Phase 13 — First Expedition

## Goal

Create the first complete gameplay loop.

## Tasks

### 13.1 Expedition Screen

Display:

```text
Mission
Difficulty
Rewards
Threats
```

### 13.2 Deploy Squad

Choose squad.

### 13.3 Transition

Base → Expedition

### 13.4 One Mission Type

Start with:

```text
Eliminate Enemies
```

### 13.5 Victory

Rewards:

- Scrap
- Food
- Rift Shards

### 13.6 Defeat

Consequences:

- Injury
- Death
- Lost resources

### 13.7 Return

Transition back to base.

## Exit Criteria

Player can:

```text
Train
→ Deploy
→ Fight
→ Return
```

This is the first real vertical slice.

---

# UI Milestone U1 — Current-System Client Foundation — Complete

## Goal

Turn the Phase 0–13 interfaces into one coherent game client without pulling later systems forward.
This is a cross-phase presentation milestone; it does not replace or renumber Phase 14.

## Implemented

- Matte dark-fantasy visual system using charcoal, bone, bronze, olive, burgundy, and slate
- Restrained top status bar for time, hero count, and actual expedition resources
- Exclusive bottom navigation for Heroes, Party, Refuge, and Rift
- Tall geometric hero cards generated from cached stills of real procedural hero models
- One hero detail surface with Overview, Skills, Training, and Relations sections
- Visual Front/Middle/Back party formation with pointer and accessible movement controls
- Atomic formation swaps that preserve roles and the three-member limit
- Rift presentation for briefing, live encounter, victory, withdrawal, consequences, and debrief
- UI-only notices for social events, training, skill progression, deployment, and mission results
- Explicit camera and world-selection gating while an interface panel is active
- Responsive mobile layouts and reduced-motion behavior
- Collapsed `F3` developer drawer containing renderer diagnostics and the Arena

## Compatibility Rules

- Simulation state remains authoritative; portrait rendering owns no hero gameplay state.
- The living refuge continues behind panels while camera and selection input are gated.
- Existing training, loadout, squad, combat, expedition, reward, and consequence behavior is retained.
- New destinations appear only when their corresponding gameplay systems are implemented.
- The four primary destinations are the stable information architecture; later systems expand them
  contextually before any new permanent navigation item is considered.

## Future Design Sequence

- **Phase 14:** deepen Heroes with injury, treatment, and recovery feedback.
- **Phases 15–17:** add loss, memory, and trait evolution to hero history without crowding the
  default roster card.
- **Phases 18–23:** make recruitment, capacity, facilities, equipment, and crafting physical Refuge
  activities with focused work panels.
- **Phases 24–26:** grow hero progression and mentorship inside the shared hero details.
- **Phases 27–35:** turn Rift and Party into the campaign-planning layer for mission variety,
  regions, bosses, doctrine, loyalty, and long-term squad stories.
- **Phases 36–40:** add memorial, persistence, audio, and visual polish while retaining the same
  navigation hierarchy and playfield-first layout.

## Exit Criteria — Met

The Phase 0–13 loop can be operated without visible diagnostic UI. Desktop and mobile layouts,
cached portraits, panel exclusivity, camera handoff, party swaps, victory, withdrawal, debrief,
resource updates, and developer Arena access have browser validation coverage.

---

# Phase 14 — Injury and Recovery — Complete

## Goal

Make expedition consequences persistent.

## Tasks

### 14.1 Injury Types

Start with:

```text
Minor Wound
Broken Arm
Burn
Concussion
```

Expedition setbacks create persistent injury records based on outcome and combat damage. Exhausted
training can create a Minor Wound through the same injury system.

### 14.2 Injury Effects

Example:

```text
Broken Arm:
Attack -20%
Training Speed -30%
```

### 14.3 Infirmary

Recovering heroes route to the Refuge infirmary cots and must rest before recovery time advances.
Untreated injuries recover slowly; treatment accelerates recovery.

### 14.4 Medicine

Treatment atomically consumes Medicine from the real Refuge stockpile. The Phase 14 build starts
with six Medicine so the loop is operable; replenishment remains part of the later economy phase.

### 14.5 Permanent Injuries

Rare severe injuries create long-term effects.

Permanent injuries retain derived combat and training modifiers after stabilization. They do not
cause death or remove a hero; those behaviors belong to Phase 15.

### 14.6 Client Integration

Extend the established client rather than adding a new top-level destination:

- Show injury severity and recovery state on existing hero cards and Overview details.
- Use the existing **Recovering** roster filter for injured and resting heroes.
- Put treatment and recovery actions in the hero Training/Recovery context.
- Add Medicine to the top status bar only when it becomes a real persisted resource.
- Expose an Infirmary through the 3D Refuge only when the facility and its interactions exist.
- Use burgundy shape, label, and icon changes for danger; never rely on glow or color alone.

## Exit Criteria — Met

Expeditions and exhausted training can leave persistent injuries. Injury modifiers affect real
combat and squad evaluation, recovering heroes cannot deploy or train, Medicine treatment is
available from hero details, and resting in the infirmary completes recovery.

---

# Phase 15 — Permanent Death — Complete

## Goal

Make hero loss meaningful.

## Tasks

### 15.1 Death State

Dead heroes cannot return.

Expedition combatants reduced to zero HP become permanent casualties even when the remaining party
wins the mission.
They are removed atomically from the active hero registry, squad formation, 3D hero renderer,
training, treatment, and future deployment. The Phase 9 Arena remains a consequence-free sandbox.

### 15.2 Relationship Reactions

Friends:

```text
Morale loss
Memory created
```

Companions, friends, and trusted friends receive increasing morale loss and a bounded loss record
containing the fallen hero, relationship tier, day, and event summary. This is the narrow Phase 15
legacy record; memory-driven behavior, fear, decay, and Utility AI effects remain Phase 16.

### 15.3 Memorial

Create basic grave marker.

The Refuge creates one restrained, selectable grave marker per fallen hero. The same authoritative
record appears in the Heroes memorial ledger and opens through either the ledger or the 3D grave.

### 15.4 Hero History

Record:

- Days alive
- Missions
- Kills
- Rank
- Cause of death

Combat now attributes kills and the final attacker. A serializable memorial record captures joined
day, death day, days alive, missions, victories, kills, level, rank, occupation, final party, and
cause of death before the active hero is removed. Disk persistence remains Phase 37.

### 15.5 Death Notifications

Do not make them overly flashy.

Mission consequences label permanent losses, while a compact burgundy side notice confirms that a
memorial record was created. No glow, takeover animation, or new navigation destination is added.

## Exit Criteria — Met

Losing a veteran visibly changes the base and the surviving heroes.

Deterministic validation confirms career and kill attribution, permanent roster and squad removal,
friend morale and loss records, hero-mesh removal, selectable grave creation, memorial details, and
death notification behavior.

---

# Phase 16 — Memory System — Complete

## Goal

Allow experiences to shape heroes.

## Tasks

### 16.1 Memory Data

Implemented:

```ts
interface HeroMemory {
  createdDay: number;
  id: string;
  lastReinforcedDay: number;
  persistent: boolean;
  summary: string;
  targetHeroId: string | null;
  type: HeroMemoryType;
  weight: number;
}
```

`MemorySystem` owns creation, same-day duplicate suppression, later-day reinforcement, bounded
weight, capacity, decay, and combat-influence queries. New heroes initialize with an empty general
memory list. Phase 15 `lossMemories` remain as a compatibility record rather than being silently
deleted or reinterpreted.

### 16.2 Initial Memories

Add:

```text
ALLY_DIED
WAS_SAVED
SAVED_ALLY
CRITICAL_INJURY
WON_BOSS
```

Current combat and expedition events create `ALLY_DIED`, `WAS_SAVED`, `SAVED_ALLY`, and
`CRITICAL_INJURY`. `WON_BOSS` is typed for compatibility but remains dormant until Phase 30 provides
a real boss victory event.

### 16.3 Behavior Effects

Memories affect:

- Morale
- Relationships
- Fear
- Utility AI

Healing and protection create reciprocal memories, modest morale changes, greater trust and respect,
and reduced fear toward the rescuer. Ally death and critical injury create lasting trauma. Utility
AI consumes normalized `0..1` memory influence: trauma can raise retreat pressure, while prior
rescues can strengthen protection of a specific vulnerable ally. Decision diagnostics name
`past trauma` or `remembered bond` when memory is the dominant consideration.

### 16.4 Memory Decay

Minor memories fade.

Major memories persist.

Non-persistent rescue memories decay by in-game time and are removed below the minimum useful
weight. Major ally-loss and critical-injury records persist. Memory count is capped per hero, and
repeated same-day combat events do not repeatedly apply relationship or morale changes.

### 16.5 Client Integration

The shared hero detail panel displays memories inside Relations with formation day, reinforcement
day, readable summary, and lasting or fading state. Memory data remains authoritative outside the
DOM and Three.js render graph.

## Exit Criteria — Met

Past events influence future behavior.

Automated browser validation confirms rescue pairing, duplicate suppression, relationship and fear
changes, normalized influence, trauma-driven Utility AI changes, minor-memory decay, persistent
major memories, Phase 15 ally-loss compatibility, and hero-detail presentation.

---

# Phase 17 — Trait Evolution — Complete

## Goal

Turn experiences into visible character development.

## Tasks

### 17.1 Earned Traits

Implemented earned traits:

```text
Battle-Hardened
Veteran
Survivor's Guilt
Protective
Ruthless
```

### 17.2 Trait Conditions

Current conditions:

```text
5 expeditions plus 5 kills or a critical-injury memory → Battle-Hardened
10 survived expeditions → Veteran
Survive an ally's expedition death → Survivor's Guilt
Protect or treat the same ally on different days → Protective
10 expedition kills with empathy at or below 0.35 → Ruthless
```

Rules are centralized in `TraitEvolutionSystem`. Trait names remain in the compatible `traits`
array, while `traitHistory` stores source, acquisition day, and the human-readable reason. Repeated
evaluation is idempotent and cannot award the same trait twice.

### 17.3 Personality Drift

Each earned trait applies a small, rule-specific personality change once. Values are clamped to
`0.04..0.98`, so repeated events cannot push personality outside its valid domain. Starting traits
do not apply drift retroactively.

### 17.4 Trait UI

Show source:

```text
Battle-Hardened
Earned after surviving 12 expeditions.
```

The shared hero Overview renders starting and earned traits differently and shows the acquisition
day and source reason. Newly earned traits also generate a compact notification. No new player
destination was added.

## Exit Criteria

Heroes visibly change because of what they experience.

Automated browser validation confirms all five earned conditions, bounded and one-time personality
drift, duplicate suppression, trait provenance rendering, notifications, and the complete earlier
recovery, memory, legacy, expedition, party, roster, and camera regression paths.

---

# Phase 18 — Recruitment System — Complete

## Goal

Add procedural hero acquisition.

## Tasks

### 18.1 Dimensional Gate

Create summon facility.

The Refuge's existing Gate Foundation is now an active, selectable Dimensional Gate. Selecting it
opens Heroes, where the real recruitment action lives; it does not create a fifth HUD destination.

### 18.2 Rift Shards

Add recruitment currency.

Recruitment spends 3 actual Rift Shards from the expedition resource stockpile. Insufficient funds,
active combat, and active expedition states block the operation without changing the roster.

### 18.3 Recruitment

Generate a new hero through the Procedural Character Forge pipeline.

The recruitment roll creates authoritative hero gameplay data first, then derives a validated
visual configuration for both the live model and cached portrait. Store the generation seed or
equivalent reproducible appearance signature with the hero.

`RecruitmentSystem` creates a stored seed and rank roll. `HeroManager` generates authoritative hero
data from that seed, records the current join day, admits the hero to the roster, and initializes
directional relationships with every resident.

### 18.4 Rank Distribution

Example:

```text
★ Common
★★ Less Common
★★★ Rare
```

Do not add extreme ranks yet.

The implemented distribution is 72% 1★, 23% 2★, and 5% 3★. Rank generation uses a separate
deterministic stream derived from the stored seed.

### 18.5 Hidden Potential

Generate independently from visible rank.

Hidden potential continues to use the existing generated attribute-potential model. Rank is applied
after hero generation and does not rewrite or reveal those values.

### 18.6 Recruitment Reveal

Show:

- Name
- Occupation
- Rank
- Visible traits
- Visible skills

The reveal uses the recruited hero's real procedural model and portrait. It may frame the result
ceremonially, but it must not expose unrestricted sliders that let the player bypass randomized
recruitment, rank uncertainty, or hidden potential.

The full-height reveal shows the same cached procedural portrait used by the roster and party, plus
name, occupation, rank, starting traits, visible skills, and a resonance seed. It explicitly keeps
hidden potential concealed and does not assign a class or equipment.

### 18.7 Procedural Character Forge Integration

Extract and adapt the approved parts of the standalone prototype:

- Body height, bulk, head, shoulder, arm, and leg proportions
- Human hair variants and appearance colors
- Modular low-poly body construction and animation reference joints
- Seeded appearance presets and validated JSON compatibility import
- Shared model construction for Refuge heroes, portraits, and recruitment reveals
- Explicit geometry, material, texture, renderer, and object-URL cleanup

Keep prototype-only concepts dormant:

- Fantasy races beyond the currently established recruit population
- Player-selected classes before Phase 24
- Weapons and armor progression before Phase 22
- Enemy tiers, magical glow effects, and enemy-authoring controls
- The prototype's standalone sidebar, persistent editor layout, and localStorage save behavior

An optional Forge workbench may exist inside the `F3` developer drawer for appearance testing. It
is developer tooling, not a fifth player destination and not proof that deferred gameplay systems
are implemented.

The implemented Forge subset adds independently generated head, shoulder, arm, and leg proportions
alongside the existing height, bulk, human hair, skin, clothing, and color vocabulary. The shared
`HeroMeshGenerator` consumes this configuration for the Refuge, cached portraits, and reveal.
`validateHeroAppearanceConfig` accepts only bounded human appearance JSON, and the portrait cache
queues late recruits safely while continuing to revoke URLs and release its temporary WebGL context.

## Exit Criteria

The player can recruit visually distinct heroes without external character assets. A fixed seed or
saved appearance signature reproduces the same model and portrait, repeated generation does not
leak WebGL resources, and recruitment does not expose deferred class, equipment, race, or enemy
systems.

Automated browser validation confirms shard spending and insufficient-funds blocking, seeded
appearance reproduction, all three supported ranks, hidden-potential independence, new relationship
profiles, bounded JSON import, cached portrait creation, recruitment notification and reveal content,
plus the complete earlier UI, expedition, recovery, legacy, memory, and trait regression paths.

---

# Phase 19 — Hero Capacity and Dormitories

## Goal

Make roster size part of base management.

## Tasks

### 19.1 Population Limit

Example:

```text
8 / 10 Heroes
```

### 19.2 Dormitory Capacity

Upgrade to increase hero capacity.

### 19.3 Comfort

Dorm quality affects morale and fatigue recovery.

## Exit Criteria

Recruitment and base growth become connected.

---

# Phase 20 — Resource Economy

## Goal

Turn expeditions and facilities into an economy.

## Tasks

Core resources:

```text
Food
Medicine
Scrap
Metal
Rift Shards
```

### 20.1 Consumption

Heroes consume food.

### 20.2 Construction Cost

Facilities consume materials.

### 20.3 Healing Cost

Medicine is consumed.

### 20.4 Expedition Rewards

Balance expected rewards.

## Exit Criteria

Player must decide where resources are spent.

---

# Phase 21 — Facility Construction

## Goal

Allow the base to physically grow.

## Tasks

Add:

```text
Dormitory
Training Hall
Infirmary
Storage
Smithy
```

### 21.1 Placement Mode

Ghost building follows cursor.

### 21.2 Validation

Check overlap.

### 21.3 Construction Progress

Builders complete facility.

### 21.4 Facility Renderer

Procedurally generate visuals.

## Exit Criteria

The player can visibly expand the settlement.

---

# Phase 22 — Equipment

## Goal

Add another meaningful hero-progression layer.

## Tasks

### 22.1 Weapon Types

Start with:

```text
Sword
Spear
Bow
Shield
```

### 22.2 Equipment Stats

Add:

- Damage
- Defense
- Range

### 22.3 Inventory

Base inventory.

### 22.4 Hero Equipment

Equip items through hero panel.

### 22.5 Visual Equipment

Attach primitive weapon meshes to heroes.

Reuse validated weapon, shield, armor, and attachment techniques from the Procedural Character
Forge prototype. Equipment data remains authoritative; the Forge only renders the equipped state.

## Exit Criteria

Equipment changes both stats and appearance.

---

# Phase 23 — Smithy and Crafting

## Goal

Connect resources to equipment progression.

## Tasks

### 23.1 Recipes

Example:

```text
Iron Sword
10 Metal
5 Scrap
```

### 23.2 Crafting Time

Items take time.

### 23.3 Smith Skill

Later allow hero crafting skill to affect quality.

### 23.4 Quality Levels

Keep simple:

```text
Normal
Good
Excellent
```

## Exit Criteria

Player can turn expedition resources into better equipment.

---

# Phase 24 — Class System

## Goal

Allow heroes to specialize organically.

## Tasks

### 24.1 Unclassified State

All new heroes begin unclassified.

### 24.2 Basic Classes

Add:

```text
Fighter
Guardian
Archer
Medic
Scout
```

### 24.3 Requirements

Example:

```text
Guardian:
Defense 5
Endurance 5
Shield Skill 4
```

Class possibilities are calculated from origin experience, training, stats, personality, combat
experience, achievements, and discovered compatibility. Origin occupation may help satisfy a
requirement but never selects a class automatically. Magical potential remains mostly hidden and
rare.

### 24.4 Class Selection

Only unlocked classes can be chosen.

### 24.5 Class Bonuses

Add modest bonuses.

Class-specific silhouettes or presentation may activate compatible Procedural Character Forge
modules only after the class is unlocked. Visual presets must never grant a class or its bonuses.

## Exit Criteria

Hero development produces meaningful specialization.

---

# Phase 25 — Branching Classes

## Goal

Make progression less linear.

## Tasks

Examples:

```text
Fighter
├── Berserker
└── Duelist
```

```text
Guardian
├── Fortress
└── Commander
```

### 25.1 Personality Requirements

Some paths depend on personality.

### 25.2 Achievement Requirements

Some depend on experiences.

Example:

```text
Protect 20 allies
→ Commander option
```

## Exit Criteria

Two heroes with similar stats can develop differently.

Reserve hybrid branches for heroes with evidence in multiple disciplines, such as Spellblade,
Arcane Guardian, Arcane Archer, Mystic Healer, Vanguard Commander, Scout Captain, and Paladin.

---

# Phase 26 — Mentorship

## Goal

Make veteran heroes valuable outside combat.

## Tasks

### 26.1 Assign Mentor

Pair veteran and student.

### 26.2 Training Bonus

Student improves faster.

### 26.3 Relationship Growth

Mentorship increases relationship.

Store mentor/protégé as a meaningful relationship bond. Shared training raises trust and respect;
mentor death can later create grief, motivation, or a possible inherited technique through the
memory system.

### 26.4 Skill Transfer

Small chance to teach trait or technique.

## Exit Criteria

Veterans shape future recruits.

---

# Phase 27 — Multiple Expedition Types

## Goal

Increase strategic variety.

## Add

```text
Eliminate
Survive
Rescue
Escort
Defend
Explore
Recover Artifact
```

Each type requires different squad strengths.

## Exit Criteria

The same squad is not ideal for every mission.

---

# Phase 28 — Procedural Expedition Generator

## Goal

Reduce dependence on handcrafted missions.

## Tasks

Generate from:

```text
Biome
Objective
Enemy Group
Hazard
Reward
Event
```

Example:

```text
Biome:
Frozen Ruins

Objective:
Rescue

Hazard:
Cold

Enemy:
Wolves

Reward:
Medicine
```

## Exit Criteria

Different expeditions can be produced from data.

---

# Phase 29 — Rift Progression

## Goal

Create long-term game progression.

## Tasks

Create:

```text
Depth 1
Depth 2
Depth 3
...
```

Group depths into regions.

Example:

```text
1–5 Ashlands
6–10 Black Forest
11–15 Frozen Kingdom
```

### 29.1 Unlock Conditions

Defeat guardian to advance.

### 29.2 Increasing Risk

Higher depths introduce:

- Stronger enemies
- New hazards
- Better rewards

## Exit Criteria

The player has a meaningful long-term goal.

---

# Phase 30 — Bosses

## Goal

Create milestone battles.

## Tasks

### 30.1 First Guardian

Build one boss.

### 30.2 Boss AI

Add:

- Basic attack
- Area attack
- Target priority
- Enrage

### 30.3 Preparation

Player should need:

- Correct squad
- Equipment
- Healing
- Formation

## Exit Criteria

Boss victory feels like a progression milestone.

---

# Phase 31 — Social Events

## Goal

Deepen base life.

## Add Events

```text
Argument
Friendship
Rivalry
Training Challenge
Romance
Fight
Celebration
Grief
```

### 31.1 Event Conditions

Events should use:

- Personality
- Relationships
- Morale
- Memories

### 31.2 Social Roles and Reputation

Let repeated refuge behavior establish roles such as Quartermaster, Instructor, Caregiver, Scout,
or Captain. Generate settlement reputation from witnessed history rather than assigning arbitrary
titles. Reputation is public belief and may differ from personality or hidden traits.

## Exit Criteria

Social events are generated from hero context, not pure randomness.

---

# Phase 32 — Loyalty and Order Refusal

## Goal

Make heroes independent.

## Tasks

### 32.1 Loyalty Stat

Track hero trust in Overseer.

### 32.2 Order Compliance

Deployment can be refused.

Calculate attitude toward authority from loyalty, trust, respect, fear, morale, and relevant
relationship history. Surface an understandable state such as Obedient, Respectful, Neutral,
Questioning, Defiant, or Rebellious.

### 32.3 Refusal Reasons

Examples:

```text
Fear
Low Morale
Injury
Trauma
Low Loyalty
```

### 32.4 Consequences

Forcing deployment may reduce loyalty.

## Exit Criteria

Heroes no longer feel like perfectly obedient units.

---

# Phase 33 — Advanced Combat Relationships

## Goal

Let social bonds affect battle behavior.

## Tasks

Examples:

```text
Protect Friend
Prioritize Healing Friend
Rage After Ally Death
Refuse Retreat Without Friend
```

Use Utility AI modifiers.

Recognize combat bonds such as trusted teammate, shieldmate, life debt, survivor bond, mentor,
protégé, found family, and nemesis. These labels must be earned from concrete history and remain
directional where appropriate.

## Exit Criteria

Relationships matter during actual combat.

---

# Phase 34 — Tactical Doctrine Expansion

## Goal

Give the player more strategic control.

## Add

```text
Aggressive
Balanced
Defensive
Survival
Protect Target
Focus Boss
```

Allow:

```text
Retreat Threshold
Target Priority
Protected Hero
Formation
```

## Exit Criteria

Players can meaningfully influence AI without direct control.

---

# Phase 35 — Hero History

## Goal

Make long-term characters memorable.

## Track

- Recruitment day
- Expeditions
- Kills
- Injuries
- Promotions
- Friends
- Rivals
- Boss kills
- Near-death events

## Exit Criteria

Veterans have visible personal histories.

---

# Phase 36 — Memorial and Graveyard

## Goal

Preserve dead heroes.

## Tasks

### 36.1 Grave Generation

Create grave mesh.

### 36.2 Memorial Panel

Display hero history.

### 36.3 Relationship Visitors

Optional:

Friends occasionally visit graves.

## Exit Criteria

Dead heroes remain part of settlement history.

---

# Phase 37 — Save System

## Goal

Persist long campaigns safely.

## Tasks

Use:

```text
IndexedDB
```

Save:

- Heroes
- Dead heroes
- Base
- Resources
- Relationships
- Memories
- Rift
- Inventory
- Facilities
- Time

### 37.1 Version Save Format

Add:

```text
saveVersion
```

### 37.2 Auto Save

Save periodically and after expedition.

## Exit Criteria

Reloading restores the same simulation state.

---

# Phase 38 — Production UI Expansion

## Goal

Extend the established Phase 13 client to every system that has actually shipped. This phase is a
production-depth pass, not a replacement redesign.

## Information Architecture

- **Heroes** expands with injuries, equipment, classes, memories, and history.
- **Party** expands with saved squads, deeper doctrine, and expedition comparison.
- **Refuge** exposes recruitment, facilities, crafting, and memorials through world locations and
  contextual panels.
- **Rift** expands with mission selection, regions, progression, bosses, and expedition history.
- The notification center may become a Chronicle only when event volume justifies a persistent log.
- Developer diagnostics and validation sandboxes remain in the `F3` drawer.

## Activation Rule

Never add a disabled future tab, invented resource, empty destination, or placeholder screen. A UI
entry is introduced in the same phase as the real state and player action it represents.

## Visual Continuity

- Preserve the matte charcoal, bone, and bronze material language.
- Reserve olive for healthy/ready states, burgundy for harm or irreversible risk, and slate for
  neutral information.
- Keep the 3D refuge dominant whenever the player is not performing a focused task.
- Prefer contextual drawers and layered details over dashboard grids.
- Preserve restrained motion and reduced-motion parity as content density grows.

## Exit Criteria

Every implemented system is usable without developer controls, and adding late-game depth has not
compromised playfield visibility, input handoff, mobile operation, or the established hierarchy.

---

# Phase 39 — Audio

## Goal

Improve atmosphere and feedback.

## Add

- Base ambience
- Combat sounds
- UI feedback
- Gate sound
- Death sound
- Training sound
- Weather ambience

Use generated/free audio later if needed.

## Exit Criteria

Important actions have clear audio feedback.

---

# Phase 40 — Visual Polish

## Goal

Give the procedural art style a strong identity.

## Improve

- Lighting
- Fog
- Shadows
- Particles
- Hero silhouettes
- Facility variation
- Weapon shapes
- Rift effects

## Exit Criteria

The game no longer looks like a raw Three.js prototype.

---

# Phase 41 — Performance Optimization

## Goal

Keep the browser version smooth.

## Tasks

### 41.1 Instancing

Use:

```text
THREE.InstancedMesh
```

for:

- Grass
- Rocks
- Debris
- Repeated props

### 41.2 Object Pooling

Use for:

- Projectiles
- Effects
- Enemies

### 41.3 Simulation Frequency

Do not update every system every render frame.

### 41.4 LOD

Optional later.

### 41.5 Profiling

Measure before optimizing.

## Exit Criteria

Stable performance at target roster and combat sizes.

---

# Phase 42 — Balance Pass

## Goal

Make progression satisfying.

Balance:

- Training speed
- Recruitment cost
- Hero death rate
- Expedition rewards
- Enemy strength
- Healing
- Facility costs
- Rank progression

Avoid making death either:

```text
Meaningless
```

or:

```text
Constantly frustrating
```

## Exit Criteria

A normal campaign has tension without feeling unfair.

---

# Phase 43 — Content Expansion

Only begin major content production after the systems work.

## Add

- More traits
- More classes
- More weapons
- More enemies
- More facilities
- More regions
- More expedition events

Use data-driven definitions.

## Exit Criteria

Adding content should not require rewriting systems.

---

# Phase 44 — Lore Layer

## Goal

Add narrative without replacing emergent storytelling.

## Add

- Rift fragments
- Archive entries
- Region histories
- Overseer mystery
- The Collapse
- Hidden factions

Lore should support the simulation rather than dominate it.

---

# Phase 45 — Advanced Systems

Possible later systems:

- Trading
- Factions
- Diplomacy
- Hero retirement
- Legendary titles
- Magic
- Advanced research
- Rare mutations
- Rival hero groups
- Settlement attacks
- Large-scale defense
- Endless mode
- Scenario challenges

Do not implement these until the core game is proven fun.

---

# Recommended Development Milestones

## Milestone A — Living Base Prototype

Includes:

```text
Phase 0–6
```

Result:

Heroes exist, move, have needs, and form relationships.

---

## Milestone B — Playable Combat Prototype

Includes:

```text
Phase 7–11
```

Result:

Player can train heroes, create a squad, and watch autonomous combat.

---

## Milestone C — First Complete Vertical Slice

Includes:

```text
Phase 12–16
```

Result:

```text
Train
→ Deploy
→ Fight
→ Return
→ Injury/Death
→ Memories
```

This is the most important milestone.

Do not continue until this loop is enjoyable.

---

## Milestone D — Hero Collection Game

Includes:

```text
Phase 17–24
```

Result:

Recruitment, base progression, equipment, classes, and specialization exist.

---

## Milestone E — Real Campaign

Includes:

```text
Phase 25–35
```

Result:

Mentorship, procedural expeditions, Rift progression, bosses, loyalty, social consequences, and memorials create long-term stories.

---

## Milestone F — Production Quality

Includes:

```text
Phase 36–44
```

Result:

Saving, UI, audio, visuals, optimization, balancing, content, and lore turn the prototype into a real game.

---

# Recommended MVP Cut

If development starts feeling too large, reduce the entire game to:

```text
1 Base
5 Heroes
1 Training Area
1 Recruit Gate
1 Squad
3 Squad Members
2 Enemy Types
1 Mission
1 Boss
1 Region
3 Resources
5 Traits
3 Classes
Permanent Death
Relationships
Memories
```

That is enough to prove the concept.

---

# Final Development Principle

Do not measure progress by:

```text
How many systems exist?
```

Measure it by:

```text
Can the player tell a memorable story about what happened?
```

A successful session should produce stories like:

> “I recruited Elias as a useless one-star farmer. He survived three squad wipes, became my best spear user, trained two younger recruits, lost his closest friend during a boss fight, and eventually became the leader of my strongest squad.”

When stories like that start appearing naturally from the simulation, the core of ASCENT is working.
