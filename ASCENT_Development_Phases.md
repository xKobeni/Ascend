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

# Phase 12 — First Expedition

## Goal

Create the first complete gameplay loop.

## Tasks

### 12.1 Expedition Screen

Display:

```text
Mission
Difficulty
Rewards
Threats
```

### 12.2 Deploy Squad

Choose squad.

### 12.3 Transition

Base → Expedition

### 12.4 One Mission Type

Start with:

```text
Eliminate Enemies
```

### 12.5 Victory

Rewards:

- Scrap
- Food
- Rift Shards

### 12.6 Defeat

Consequences:

- Injury
- Death
- Lost resources

### 12.7 Return

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

# Phase 13 — Injury and Recovery

## Goal

Make expedition consequences persistent.

## Tasks

### 13.1 Injury Types

Start with:

```text
Minor Wound
Broken Arm
Burn
Concussion
```

### 13.2 Injury Effects

Example:

```text
Broken Arm:
Attack -20%
Training Speed -30%
```

### 13.3 Infirmary

Hero must rest.

### 13.4 Medicine

Healing consumes medicine.

### 13.5 Permanent Injuries

Rare severe injuries create long-term effects.

## Exit Criteria

Expeditions affect heroes after combat ends.

---

# Phase 14 — Permanent Death

## Goal

Make hero loss meaningful.

## Tasks

### 14.1 Death State

Dead heroes cannot return.

### 14.2 Relationship Reactions

Friends:

```text
Morale loss
Memory created
```

### 14.3 Memorial

Create basic grave marker.

### 14.4 Hero History

Record:

- Days alive
- Missions
- Kills
- Rank
- Cause of death

### 14.5 Death Notifications

Do not make them overly flashy.

## Exit Criteria

Losing a veteran visibly changes the base and the surviving heroes.

---

# Phase 15 — Memory System

## Goal

Allow experiences to shape heroes.

## Tasks

### 15.1 Memory Data

Example:

```ts
interface HeroMemory {
  type: string;
  targetId?: string;
  day: number;
  weight: number;
}
```

### 15.2 Initial Memories

Add:

```text
ALLY_DIED
WAS_SAVED
SAVED_ALLY
CRITICAL_INJURY
WON_BOSS
```

### 15.3 Behavior Effects

Memories affect:

- Morale
- Relationships
- Fear
- Utility AI

### 15.4 Memory Decay

Minor memories fade.

Major memories persist.

## Exit Criteria

Past events influence future behavior.

---

# Phase 16 — Trait Evolution

## Goal

Turn experiences into visible character development.

## Tasks

### 16.1 Earned Traits

Examples:

```text
Battle-Hardened
Veteran
Survivor's Guilt
Protective
Ruthless
```

### 16.2 Trait Conditions

Example:

```text
Survive 10 battles
→ Veteran
```

### 16.3 Personality Drift

Major events can slightly change personality.

### 16.4 Trait UI

Show source:

```text
Battle-Hardened
Earned after surviving 12 expeditions.
```

## Exit Criteria

Heroes visibly change because of what they experience.

---

# Phase 17 — Recruitment System

## Goal

Add procedural hero acquisition.

## Tasks

### 17.1 Dimensional Gate

Create summon facility.

### 17.2 Rift Shards

Add recruitment currency.

### 17.3 Recruitment

Generate new hero.

### 17.4 Rank Distribution

Example:

```text
★ Common
★★ Less Common
★★★ Rare
```

Do not add extreme ranks yet.

### 17.5 Hidden Potential

Generate independently from visible rank.

### 17.6 Recruitment Reveal

Show:

- Name
- Occupation
- Rank
- Visible traits
- Visible skills

## Exit Criteria

The player can recruit heroes without external assets.

---

# Phase 18 — Hero Capacity and Dormitories

## Goal

Make roster size part of base management.

## Tasks

### 18.1 Population Limit

Example:

```text
8 / 10 Heroes
```

### 18.2 Dormitory Capacity

Upgrade to increase hero capacity.

### 18.3 Comfort

Dorm quality affects morale and fatigue recovery.

## Exit Criteria

Recruitment and base growth become connected.

---

# Phase 19 — Resource Economy

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

### 19.1 Consumption

Heroes consume food.

### 19.2 Construction Cost

Facilities consume materials.

### 19.3 Healing Cost

Medicine is consumed.

### 19.4 Expedition Rewards

Balance expected rewards.

## Exit Criteria

Player must decide where resources are spent.

---

# Phase 20 — Facility Construction

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

### 20.1 Placement Mode

Ghost building follows cursor.

### 20.2 Validation

Check overlap.

### 20.3 Construction Progress

Builders complete facility.

### 20.4 Facility Renderer

Procedurally generate visuals.

## Exit Criteria

The player can visibly expand the settlement.

---

# Phase 21 — Equipment

## Goal

Add another meaningful hero-progression layer.

## Tasks

### 21.1 Weapon Types

Start with:

```text
Sword
Spear
Bow
Shield
```

### 21.2 Equipment Stats

Add:

- Damage
- Defense
- Range

### 21.3 Inventory

Base inventory.

### 21.4 Hero Equipment

Equip items through hero panel.

### 21.5 Visual Equipment

Attach primitive weapon meshes to heroes.

## Exit Criteria

Equipment changes both stats and appearance.

---

# Phase 22 — Smithy and Crafting

## Goal

Connect resources to equipment progression.

## Tasks

### 22.1 Recipes

Example:

```text
Iron Sword
10 Metal
5 Scrap
```

### 22.2 Crafting Time

Items take time.

### 22.3 Smith Skill

Later allow hero crafting skill to affect quality.

### 22.4 Quality Levels

Keep simple:

```text
Normal
Good
Excellent
```

## Exit Criteria

Player can turn expedition resources into better equipment.

---

# Phase 23 — Class System

## Goal

Allow heroes to specialize organically.

## Tasks

### 23.1 Unclassified State

All new heroes begin unclassified.

### 23.2 Basic Classes

Add:

```text
Fighter
Guardian
Archer
Medic
Scout
```

### 23.3 Requirements

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

### 23.4 Class Selection

Only unlocked classes can be chosen.

### 23.5 Class Bonuses

Add modest bonuses.

## Exit Criteria

Hero development produces meaningful specialization.

---

# Phase 24 — Branching Classes

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

### 24.1 Personality Requirements

Some paths depend on personality.

### 24.2 Achievement Requirements

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

# Phase 25 — Mentorship

## Goal

Make veteran heroes valuable outside combat.

## Tasks

### 25.1 Assign Mentor

Pair veteran and student.

### 25.2 Training Bonus

Student improves faster.

### 25.3 Relationship Growth

Mentorship increases relationship.

Store mentor/protégé as a meaningful relationship bond. Shared training raises trust and respect;
mentor death can later create grief, motivation, or a possible inherited technique through the
memory system.

### 25.4 Skill Transfer

Small chance to teach trait or technique.

## Exit Criteria

Veterans shape future recruits.

---

# Phase 26 — Multiple Expedition Types

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

# Phase 27 — Procedural Expedition Generator

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

# Phase 28 — Rift Progression

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

### 28.1 Unlock Conditions

Defeat guardian to advance.

### 28.2 Increasing Risk

Higher depths introduce:

- Stronger enemies
- New hazards
- Better rewards

## Exit Criteria

The player has a meaningful long-term goal.

---

# Phase 29 — Bosses

## Goal

Create milestone battles.

## Tasks

### 29.1 First Guardian

Build one boss.

### 29.2 Boss AI

Add:

- Basic attack
- Area attack
- Target priority
- Enrage

### 29.3 Preparation

Player should need:

- Correct squad
- Equipment
- Healing
- Formation

## Exit Criteria

Boss victory feels like a progression milestone.

---

# Phase 30 — Social Events

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

### 30.1 Event Conditions

Events should use:

- Personality
- Relationships
- Morale
- Memories

### 30.2 Social Roles and Reputation

Let repeated refuge behavior establish roles such as Quartermaster, Instructor, Caregiver, Scout,
or Captain. Generate settlement reputation from witnessed history rather than assigning arbitrary
titles. Reputation is public belief and may differ from personality or hidden traits.

## Exit Criteria

Social events are generated from hero context, not pure randomness.

---

# Phase 31 — Loyalty and Order Refusal

## Goal

Make heroes independent.

## Tasks

### 31.1 Loyalty Stat

Track hero trust in Overseer.

### 31.2 Order Compliance

Deployment can be refused.

Calculate attitude toward authority from loyalty, trust, respect, fear, morale, and relevant
relationship history. Surface an understandable state such as Obedient, Respectful, Neutral,
Questioning, Defiant, or Rebellious.

### 31.3 Refusal Reasons

Examples:

```text
Fear
Low Morale
Injury
Trauma
Low Loyalty
```

### 31.4 Consequences

Forcing deployment may reduce loyalty.

## Exit Criteria

Heroes no longer feel like perfectly obedient units.

---

# Phase 32 — Advanced Combat Relationships

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

# Phase 33 — Tactical Doctrine Expansion

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

# Phase 34 — Hero History

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

# Phase 35 — Memorial and Graveyard

## Goal

Preserve dead heroes.

## Tasks

### 35.1 Grave Generation

Create grave mesh.

### 35.2 Memorial Panel

Display hero history.

### 35.3 Relationship Visitors

Optional:

Friends occasionally visit graves.

## Exit Criteria

Dead heroes remain part of settlement history.

---

# Phase 36 — Save System

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

### 36.1 Version Save Format

Add:

```text
saveVersion
```

### 36.2 Auto Save

Save periodically and after expedition.

## Exit Criteria

Reloading restores the same simulation state.

---

# Phase 37 — UI Pass

## Goal

Turn debug interfaces into usable game UI.

## Screens

- Main HUD
- Hero Panel
- Squad Builder
- Recruitment
- Expedition Selection
- Inventory
- Facilities
- Event Log
- Memorial

## Exit Criteria

Core game can be played without developer controls.

---

# Phase 38 — Audio

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

# Phase 39 — Visual Polish

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

# Phase 40 — Performance Optimization

## Goal

Keep the browser version smooth.

## Tasks

### 40.1 Instancing

Use:

```text
THREE.InstancedMesh
```

for:

- Grass
- Rocks
- Debris
- Repeated props

### 40.2 Object Pooling

Use for:

- Projectiles
- Effects
- Enemies

### 40.3 Simulation Frequency

Do not update every system every render frame.

### 40.4 LOD

Optional later.

### 40.5 Profiling

Measure before optimizing.

## Exit Criteria

Stable performance at target roster and combat sizes.

---

# Phase 41 — Balance Pass

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

# Phase 42 — Content Expansion

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

# Phase 43 — Lore Layer

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

# Phase 44 — Advanced Systems

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
