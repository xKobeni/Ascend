# ASCENT — Full Game Concept

## 1. Working Title

**Working Title:** ASCENT

Alternative names:
- Riftbound
- Last Summon
- Ashen Gate
- The Hollow Ascent
- Echoes of the Rift
- Vanguard Nexus
- Last Lobby
- Shardfall
- Beyond the Gate

The final title should be chosen after the art direction and lore are finalized.

---

# 2. High-Level Concept

**ASCENT** is a browser-based 3D hero-management, settlement-simulation, expedition, and auto-combat game built with **Three.js and TypeScript**.

The player controls an isolated refuge located between ruined worlds.

New heroes are periodically pulled into the refuge through a mysterious dimensional gate.

The player does not directly control every action of every hero.

Instead, the player:

- Recruits heroes
- Observes their personalities and potential
- Assigns training
- Equips them
- Organizes squads
- Builds and upgrades facilities
- Sends squads into dangerous expeditions
- Sets tactical behavior
- Watches battles unfold
- Handles injuries and deaths
- Manages relationships and morale
- Develops weak recruits into powerful veterans
- Pushes deeper into an unstable dimensional world called **The Rift**

The game's main identity is:

> **You do not collect finished heroes. You create legends through survival, training, relationships, and experience.**

Heroes are not disposable cards.

They physically live inside the player's base, develop relationships, remember important events, gain fears, form rivalries, become loyal, become unstable, and can permanently die.

---

# 3. Core Inspiration Direction

The game takes inspiration from the appeal of hero-progression stories where:

- Weak characters can become powerful
- Rank does not fully determine worth
- Death has consequences
- Training matters
- Squads develop chemistry
- Battles are dangerous
- Progression feels earned
- The player manages a growing roster

However, ASCENT should remain original.

It should not reuse:

- Existing characters
- Existing terminology
- Existing worlds
- Existing floor layouts
- Existing story events
- Existing skill names
- Existing factions

The game should instead combine:

**Hero Management**
+
**Base Building**
+
**Social Simulation**
+
**Auto Battler**
+
**Roguelite Expeditions**
+
**Procedural Character Growth**

---

# 4. Player Fantasy

The player is an unseen **Overseer** responsible for a refuge that exists between collapsing dimensions.

The player cannot personally enter expeditions.

Instead, survival depends on preparing other people.

The player fantasy is:

> “I discover ordinary people, turn them into survivors, build squads around their strengths and personalities, and watch them become legends—or die trying.”

The player should become emotionally attached to individual heroes.

A weak recruit from Day 2 may become the strongest veteran in the settlement by Day 80.

---

# 5. Design Pillars

## 5.1 Heroes Are People

Every hero has:

- Name
- Age
- Appearance
- Origin
- Previous occupation
- Skills
- Personality
- Traits
- Relationships
- Memories
- Fears
- Injuries
- Equipment
- Combat style
- Potential
- Loyalty
- Morale
- Experience
- Class path

Heroes should feel persistent.

They live inside the base.

They eat.

They train.

They rest.

They argue.

They make friends.

They become rivals.

They may refuse assignments.

They remember teammates who died.

---

## 5.2 Weak Does Not Mean Worthless

A hero's visible rank does not reveal everything.

A low-ranked hero may have:

- Exceptional leadership
- Strong hidden potential
- Rare skill compatibility
- Excellent teamwork
- High survivability
- Unique personality traits

Example:

```text
ELIAS

Rank: ★
Occupation: Farmer

Strength: Average
Combat: Poor
Leadership: Unknown
Potential: Unknown
```

After months of survival:

```text
ELIAS

Rank: ★★★★

Class:
Vanguard Commander

Traits:
Battle-Hardened
Protective
Last Survivor
Natural Leader
```

The player should occasionally discover that an apparently mediocre recruit has become indispensable.

---

## 5.3 Progression Must Feel Earned

Heroes should improve because of:

- Training
- Combat
- Survival
- Mentorship
- Relationships
- Equipment
- Repeated actions
- Major events
- Injuries
- Loss
- Personal achievements

Not every improvement should come from clicking a stat upgrade button.

---

## 5.4 Permanent Consequences

Death is permanent.

If a hero dies:

- They disappear from active play
- Their relationships react
- Friends may lose morale
- Rivals may feel guilt or relief
- Squad performance may change
- Their equipment may be lost
- Their grave may appear in the memorial area
- Their name enters settlement history

The player should remember deaths.

---

## 5.5 The Base Is Alive

The base is not a menu.

Heroes physically exist inside it.

The player can watch:

- Training
- Eating
- Sleeping
- Healing
- Arguing
- Socializing
- Crafting
- Guarding
- Mourning
- Celebrating

The player should be able to click any hero in the 3D scene.

---

## 5.6 Combat Is Observed, Not Micromanaged

The player prepares squads but does not manually attack with each hero.

The player controls:

- Squad composition
- Formation
- Equipment
- Tactical doctrine
- Target priority
- Retreat conditions
- Role assignments

The hero AI handles moment-to-moment combat.

This creates tension.

The player can influence the battle but cannot completely control it.

---

# 6. Core Gameplay Loop

The main gameplay loop is:

```text
RECRUIT
   ↓
INSPECT HERO
   ↓
TRAIN
   ↓
EQUIP
   ↓
BUILD SQUAD
   ↓
PREPARE EXPEDITION
   ↓
ENTER THE RIFT
   ↓
AUTO-COMBAT
   ↓
SURVIVE / FAIL
   ↓
RETURN TO BASE
   ↓
HEAL / MOURN / UPGRADE
   ↓
DEVELOP HEROES
   ↓
EXPAND BASE
   ↓
PUSH DEEPER
```

Secondary loop:

```text
BASE LIFE
   ↓
RELATIONSHIPS
   ↓
MEMORIES
   ↓
CONFLICTS
   ↓
PERSONAL DEVELOPMENT
   ↓
NEW TRAITS / BEHAVIOR
```

---

# 7. The Base

The player begins with a tiny ruined refuge.

Initial facilities:

- Dimensional Gate
- Campfire
- Crude Dormitory
- Training Yard
- Storage
- Basic Infirmary

The base expands over time.

Later facilities:

- Training Hall
- Smithy
- Advanced Infirmary
- Kitchen
- Workshop
- Tactical Center
- Research Chamber
- Alchemy Lab
- Archive
- Barracks
- Arena
- Memorial
- Graveyard
- Recruitment Chamber
- Promotion Hall
- Energy Core
- Watch Tower
- Trading Post

---

# 8. Base Building System

The player enters build mode.

Buildings require:

- Scrap
- Wood
- Stone
- Metal
- Rift Shards
- Specialized materials

Construction process:

1. Select facility
2. Preview placement
3. Confirm
4. Create construction site
5. Assign builders
6. Materials are delivered
7. Progress increases
8. Facility becomes usable

Facilities should visibly upgrade.

Example:

## Training Hall Level 1

- Wooden targets
- Open-air yard
- Basic training bonus

## Training Hall Level 2

- Weapon racks
- Covered arena
- Better training speed

## Training Hall Level 3

- Advanced equipment
- Multiple training zones
- Specialized combat instruction

---

# 9. Hero Generation

Heroes are procedurally generated.

Every recruit receives:

- Random name
- Body proportions
- Skin tone
- Hair
- Clothing
- Origin
- Occupation
- Personality
- Traits
- Skills
- Compatibility
- Hidden potential
- Starting rank
- Preferred weapons

Hero identity is intentionally split into three independent layers:

```text
Origin Occupation → what the hero did before the Rift
Class             → what the hero becomes through training and experience
Social Role       → what the hero becomes inside the refuge
```

An occupation can influence starting attributes, skills, and practical aptitudes, but it never
locks a class. Civilian origins should remain common, specialized origins less common, and rare
backgrounds such as Elite Knight, Arcane Scholar, or Veteran Commander should feel exceptional.
Practical aptitudes such as tracking, repair, plant knowledge, logistics, and instruction give
apparently weak recruits long-term value outside raw combat power.

Example:

```text
LENA ARDEN

Rank: ★

Previous Occupation:
Nurse

Strength: 2
Agility: 4
Medicine: 8
Combat: 1

Traits:
Patient
Cowardly
Compassionate

Potential:
???
```

The hero may initially appear poor for combat but become essential as a medic.

---

# 10. Rank System

Suggested rank system:

```text
★
★★
★★★
★★★★
★★★★★
```

Rank represents current development.

Rank should influence:

- Base stats
- Training ceiling
- Equipment access
- Skill capacity
- Promotion requirements

However:

> **Rank must not completely determine long-term usefulness.**

---

# 11. Hidden Potential

Potential is partially hidden.

Possible internal values:

```ts
potential: {
  strength: 0.74,
  agility: 0.41,
  intelligence: 0.52,
  leadership: 0.91,
  magic: 0.13,
  resilience: 0.84
}
```

The player learns potential through:

- Training
- Combat
- Mentorship
- Research
- Observation
- Promotion tests

---

# 12. Hero Core Stats

Possible stats:

- Strength
- Agility
- Endurance
- Intelligence
- Perception
- Willpower
- Leadership
- Resilience

Combat-derived stats:

- Health
- Stamina
- Attack
- Defense
- Accuracy
- Dodge
- Critical Chance
- Movement Speed

---

# 13. Skills

Skill categories:

## Combat

- Sword
- Spear
- Axe
- Bow
- Shield
- Unarmed
- Dual Weapons

## Support

- Medicine
- Alchemy
- Cooking
- Engineering
- Scouting

## Survival

- Navigation
- Gathering
- Tracking
- Trap Detection

## Social

- Leadership
- Negotiation
- Teaching
- Intimidation

Skills improve through use.

---

# 14. Personality System

Every hero has internal personality values.

Examples:

```text
Bravery
Discipline
Aggression
Empathy
Greed
Loyalty
Ambition
Sociability
Independence
Optimism
```

Values range from:

```text
0.0 – 1.0
```

Personality affects:

- Combat decisions
- Fear
- Loyalty
- Relationships
- Training behavior
- Order compliance
- Reactions to death
- Social events

---

# 15. Trait System

Visible traits summarize important characteristics.

Examples:

Positive:

- Hard Worker
- Brave
- Loyal
- Fast Learner
- Natural Leader
- Calm Under Pressure
- Protective

Negative:

- Cowardly
- Greedy
- Reckless
- Arrogant
- Lazy
- Paranoid
- Violent

Contextual:

- Former Soldier
- Field Medic
- Hunter
- Academic
- Street Survivor
- Blacksmith
- Merchant

Earned traits:

- Battle-Hardened
- Survivor's Guilt
- Veteran
- Monster Slayer
- Last Survivor
- Fear of Fire
- Unbreakable
- Ruthless
- Squad Leader

---

# 16. Memory System

Heroes remember meaningful events.

Example:

```ts
{
  type: "ALLY_DIED",
  targetId: "hero_12",
  day: 18,
  emotionalWeight: -72
}
```

Possible memories:

- Was saved by someone
- Saved someone
- Lost a teammate
- Was abandoned
- Won difficult battle
- Was critically injured
- Was promoted
- Was humiliated
- Was betrayed
- Was healed
- Survived alone

Memories influence future behavior.

---

# 17. Relationship System

Every hero has directional relationships with others. A relationship is not one opinion score; it
is a profile containing:

```ts
interface RelationshipProfile {
  affinity: number;   // -100 to +100
  trust: number;      // 0 to 100
  respect: number;    // 0 to 100
  fear: number;       // 0 to 100
  jealousy: number;   // 0 to 100
  rivalry: number;    // 0 to 100
  history: RelationshipEvent[];
}
```

This allows a hero to dislike someone while still trusting and respecting their ability. Each
conversation, argument, shared training session, rescue, loss, and mission should leave a bounded
history entry so important relationship changes can be explained to the player.

Range:

```text
-100 to +100
```

Examples:

```text
Elias → Marcus: +81
Marcus → Elias: +63
Nia → Kara: -42
```

Relationship labels are derived summaries rather than the underlying state:

- Enemy
- Rival
- Dislike
- Neutral
- Acquaintance
- Friend
- Close Friend
- Romantic Interest
- Partner
- Family-Like Bond

Long-lived relationship types can include mentor/protégé, trusted teammate, shieldmate, life debt,
survivor bond, found family, and nemesis. Romance remains subtle and serves the survival drama rather
than becoming a separate dating system.

Relationships need not be symmetrical.

---

# 18. Relationship Effects

Relationships can affect combat.

Examples:

A hero may:

- Protect a close friend
- Heal a loved one first
- Refuse to abandon someone
- Become reckless after a friend's death
- Ignore a rival
- Fight harder near a trusted leader

This creates emergent squad behavior.

## 18.1 Squad Chemistry

Squads expose a readable cohesion and trust summary derived from the directional relationships of
their members. Repeated safe training and successful expeditions can improve chemistry; distrust,
fear, jealousy, grief, or unresolved conflict can weaken it. Combat effects such as rescue priority,
formation stability, panic resistance, healing coordination, and retreat consistency are introduced
only when their supporting combat systems exist.

## 18.2 Settlement Reputation

Reputation describes what the refuge believes about a hero, not necessarily who that hero truly is.
Possible earned titles include Survivor, Coward, Prodigy, Protector, Reliable Captain, Monster
Slayer, Butcher, Lucky One, and Living Legend. Reputation grows from witnessed events and expedition
history and may later influence first impressions, authority, fear, and morale.

---

# 19. Hero Needs

Heroes have needs inside the base:

- Hunger
- Fatigue
- Morale
- Health
- Social need
- Safety
- Stress

Poor conditions affect:

- Training
- Loyalty
- Combat
- Relationships
- Injury recovery

---

# 20. Training System

Training types:

- Strength
- Endurance
- Weapon proficiency
- Defense
- Agility
- Squad drills
- Leadership
- Medical practice
- Tactical training

Training consumes:

- Time
- Stamina
- Facility capacity

Overtraining can cause:

- Fatigue
- Injury
- Morale loss

---

# 21. Mentorship System

Veteran heroes can train weaker heroes.

Example:

```text
Mentor:
Elias

Student:
Ren

Training:
Spear Combat
```

Mentorship can improve:

- Skill growth
- Relationship
- Loyalty
- Class unlocks

---

# 22. Class System

Heroes begin as:

```text
UNCLASSIFIED
```

Classes emerge based on:

- Stats
- Skills
- Weapons
- Personality
- Training
- Experience
- Achievements

Origin occupation contributes experience and possible affinities, but never determines class by
itself. Magical compatibility is mostly hidden and rare. Initial branches should stay readable:

```text
Martial:   Fighter → Swordsman / Axeman / Brawler
Defense:  Defender → Shieldbearer / Vanguard
Spear:    Spearman → Lancer / Pikeman / Dragoon
Ranged:   Archer → Ranger / Sharpshooter
Rogue:    Rogue → Thief / Scout / Trickster
Support:  Medic / Priest / Alchemist
Command:  Leader → Squad Captain / Commander / Tactician
```

Hybrid classes require evidence from more than one discipline, for example Spellblade, Arcane
Guardian, Arcane Archer, Mystic Healer, Vanguard Commander, Scout Captain, or Paladin.

Example:

```text
High Strength
+
Axe Training
+
High Aggression

↓

Berserker
```

Another:

```text
Shield Training
+
High Discipline
+
High Endurance

↓

Guardian
```

Another:

```text
Sword Training
+
High Leadership
+
Squad Command Experience

↓

Commander
```

---

# 23. Class Evolution

Example class paths:

```text
Unclassified
   ↓
Swordsman
   ↓
Knight
   ↓
Guardian
```

Or:

```text
Unclassified
   ↓
Swordsman
   ↓
Duelist
   ↓
Blade Master
```

Classes should branch.

---

# 24. Experience-Based Skill Unlocks

Skills may unlock from behavior.

Example:

A hero survives 5 battles below 20% health.

Unlock:

```text
DEATH'S DOOR

While below 20% HP:
Defense +15%
Fear Resistance +25%
```

Another hero heals 50 wounded allies.

Unlock:

```text
FIELD MEDIC

Can stabilize critically wounded allies during expeditions.
```

This encourages emergent development.

---

# 25. Equipment

Equipment slots:

- Main weapon
- Off-hand
- Armor
- Helmet
- Accessory
- Consumable

Weapon types:

- Sword
- Spear
- Axe
- Bow
- Dagger
- Staff
- Shield

Equipment has:

- Rarity
- Durability
- Stats
- Traits
- Requirements

---

# 26. Crafting

The Smithy creates:

- Weapons
- Armor
- Tools
- Ammunition

Materials come from:

- Expeditions
- Salvage
- Rewards
- Trading

Higher-level crafting requires skilled workers.

---

# 27. Squad System

Squad size:

Recommended MVP:

```text
3 heroes
```

Later:

```text
4–6 heroes
```

Squad roles:

- Vanguard
- Defender
- Damage
- Support
- Healer
- Scout

---

# 28. Squad Formation

Formation examples:

```text
FRONT

[Guardian] [Fighter]

MID

[Spearman]

BACK

[Archer] [Medic]
```

Formation affects:

- Targeting
- Protection
- Movement
- Ability range

---

# 29. Tactical Doctrine

Before battle, choose doctrine.

Examples:

## Aggressive

- Higher damage
- Higher risk
- Pursue enemies

## Balanced

- Standard behavior

## Defensive

- Stay together
- Protect support heroes

## Survival

- Retreat earlier
- Avoid unnecessary fights

---

# 30. Tactical Rules

The player can configure:

```text
Retreat if team health < 30%

Protect:
Nia

Priority:
Enemy Healers

Avoid:
Elite enemies

Formation:
Defensive
```

This provides strategy without direct micromanagement.

---

# 31. Hero Combat AI

Use **Utility AI**.

Each possible action receives a score.

Example:

```text
Attack Enemy       52
Protect Ally       68
Heal Ally          91
Retreat            20
Reposition          45
```

The highest valid score becomes the action.

Personality modifies scores.

Example:

A brave hero:

```text
Retreat score -20%
```

A cowardly hero:

```text
Retreat score +30%
```

A protective hero:

```text
Protect friend score +40%
```

---

# 32. Combat Actions

Initial combat actions:

- Move
- Basic attack
- Defend
- Dodge
- Retreat
- Protect ally
- Heal ally

Later:

- Skills
- Area attacks
- Buffs
- Debuffs
- Crowd control
- Revive
- Summons

---

# 33. Expedition System

The dimensional wilderness is called:

# The Rift

The Rift contains procedural zones.

Examples:

- Ruined village
- Dark forest
- Abandoned fortress
- Frozen wasteland
- Ancient ruins
- Desert kingdom
- Underground city
- Corrupted temple

---

# 34. Expedition Structure

Each expedition contains:

```text
Entry
   ↓
Encounter
   ↓
Choice
   ↓
Battle
   ↓
Loot
   ↓
Event
   ↓
Objective
   ↓
Exit
```

Expeditions should be shorter than full campaigns.

---

# 35. Mission Types

Possible mission objectives:

- Eliminate enemies
- Survive
- Defend location
- Escort survivor
- Rescue captives
- Recover artifact
- Explore ruins
- Reach extraction
- Assassinate target
- Destroy structure
- Boss encounter

---

# 36. Expedition Danger

Each mission displays:

```text
Difficulty:
★★★

Expected Enemies:
Medium

Estimated Duration:
8 minutes

Recommended:
Level 8+

Known Threats:
Poison
Ranged Enemies
```

Some information may remain unknown.

---

# 37. Procedural Encounters

Encounters may include:

- Enemy patrol
- Traps
- Survivors
- Treasure
- Puzzle
- Environmental hazard
- Ambush
- Merchant
- Enemy faction
- Boss

---

# 38. Injuries

Heroes may return with injuries.

Examples:

- Broken arm
- Deep wound
- Burn
- Concussion
- Poison
- Infection

Injuries affect performance.

Some injuries create permanent consequences.

Example:

```text
Permanent Scar

Fear Resistance +5%
Social Reaction Modifier
```

---

# 39. Death

Death is permanent by default.

When a hero dies:

1. Hero becomes inactive
2. Death event is logged
3. Relationships react
4. Memories are created
5. Equipment may be recovered
6. Grave appears
7. Settlement history updates

---

# 40. Memorial System

The base contains a memorial area.

Clicking a grave shows:

```text
MARCUS VALE

Day 4 — Day 51

Rank:
★★★

Class:
Vanguard

Expeditions:
24

Victories:
19

Kills:
83

Cause of Death:
Rift Guardian

Closest Bond:
Elias

Final Squad:
Alpha
```

---

# 41. Recruitment / Summoning

Recruitment uses a non-monetized in-game system.

Resource example:

```text
Rift Shards
```

Spend shards to activate the dimensional gate.

Possible pull:

```text
SUMMON COMPLETE

★

LENA ARDEN

Former Occupation:
Nurse
```

---

# 42. Recruitment Philosophy

The system should avoid:

```text
Low rank = automatic trash
```

Instead:

```text
Low rank = uncertain potential
```

The player should want to test and develop heroes.

---

# 43. Hero Discovery

Some information begins hidden.

Example:

```text
Potential:
???

Combat Affinity:
Unknown

Leadership:
Unknown
```

Information is revealed through use.

---

# 44. Base Social Simulation

Heroes perform autonomous activities.

Examples:

- Eat together
- Train together
- Talk
- Argue
- Rest
- Visit injured friends
- Attend funerals
- Celebrate victories
- Practice alone

---

# 45. Social Events

Possible events:

- Friendship formed
- Rivalry
- Argument
- Fight
- Romance
- Breakup
- Mentorship
- Jealousy
- Admiration
- Grief
- Leadership conflict

---

# 46. Loyalty

Heroes develop loyalty toward:

- The Overseer
- Their squad
- Individual heroes
- The settlement

Low loyalty can cause:

- Refusal
- Desertion
- Sabotage
- Poor morale

High loyalty can cause:

- Heroic behavior
- Risk-taking for allies
- Better teamwork

---

# 47. Orders and Refusal

Heroes are not completely obedient.

An order can fail because of:

- Fear
- Injury
- Hatred
- Low loyalty
- Trauma
- Personal relationships

Example:

```text
DEPLOYMENT WARNING

Ren refuses to enter the Rift.

Reason:
Recent Trauma
Morale: 18%
```

The player can:

- Force deployment
- Replace hero
- Rest hero
- Talk through leader/mentor system later

---

# 48. Events at the Base

Examples:

```text
EVENT

Kara challenged Elias during training.

Possible Outcomes:
- Friendly rivalry
- Injury
- Respect increase
- Relationship decrease
```

Not every event requires player input.

---

# 49. Resources

Core resources:

- Food
- Water
- Scrap
- Wood
- Metal
- Medicine
- Rift Shards
- Components

Advanced:

- Arcane Dust
- Energy Cores
- Ancient Parts
- Rare Materials

---

# 50. Economy

Resources are gained through:

- Expeditions
- Facilities
- Salvage
- Trading
- Events

They are spent on:

- Recruitment
- Construction
- Healing
- Crafting
- Upgrades
- Research

---

# 51. Research

Research unlocks:

- New facilities
- Equipment
- Training
- Scouting
- Better recruitment analysis
- Rift information

---

# 52. Progression

Progression exists on several layers.

## Hero

- Level
- Rank
- Class
- Skills
- Traits
- Equipment

## Squad

- Teamwork
- Formation mastery
- Shared experience

## Base

- Facilities
- Capacity
- Technology
- Resources

## Rift

- New regions
- Enemies
- Bosses
- Rewards
- Lore

---

# 53. World Progression

Instead of copying a literal floor system, use:

```text
Rift Depth
```

Example:

```text
Depth 1–5
Ashlands

Depth 6–10
Dark Forest

Depth 11–15
Frozen Kingdom

Depth 16–20
Ancient Ruins

Depth 20
Guardian Encounter
```

---

# 54. Lore

The refuge exists outside normal reality.

Civilizations across different worlds have been destroyed by a phenomenon called:

```text
The Collapse
```

The Dimensional Gate pulls survivors from dying worlds.

The Rift may contain fragments of those worlds.

As the player advances, they discover:

- Why the refuge exists
- Who created the gate
- Why heroes are summoned
- What caused The Collapse
- Whether the Overseer is truly helping

---

# 55. Three.js Visual Style

Recommended art direction:

# Procedural Low-Poly Diorama

The first version can use almost zero external assets.

Heroes:

- Sphere / low-poly head
- Box torso
- Simple limbs
- Procedural hair
- Equipment meshes

Buildings:

- Boxes
- Roofs
- Pipes
- Panels
- Doors
- Windows

Environment:

- Primitive rocks
- Trees
- Ruins
- Crystals
- Debris

---

# 56. Procedural Hero Appearance

Hero appearance can use:

```ts
interface HeroAppearance {
  height: number;
  bodyWidth: number;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  clothingColor: string;
  equipmentStyle: string;
}
```

Equipment visibly changes the model.

---

# 57. Camera

Recommended:

**Elevated isometric / free orbital camera**

Controls:

```text
WASD = Pan
Mouse Wheel = Zoom
Q/E = Rotate
Left Click = Select
Right Click = Context
```

---

# 58. UI

Use HTML/CSS for interface panels.

Three.js should handle the world.

HUD example:

```text
DAY 18

Food        214
Medicine     18
Scrap        83
Rift Shards 120

Heroes:
12 / 16

Squads:
2

Morale:
74%
```

---

# 59. Hero Panel

Example:

```text
ELIAS VANE

Rank:
★★★

Level:
24

Class:
Spearman

Health:
█████████░

Morale:
███████░░░

Traits:
Protective
Battle-Hardened
Patient

Skills:
Spear       8
Defense     6
Leadership  7

Relationships:
Marcus   +82
Nia      +61
Kara     -25

Memories:
- Survived Depth 8
- Marcus saved Elias
```

---

# 60. Event Log

Example:

```text
08:22 Elias entered training.

09:41 Nia treated Ren.

10:12 Kara argued with Elias.

11:07 Squad Alpha deployed.

11:43 Marcus was critically wounded.

11:46 Elias protected Marcus.

12:18 Squad Alpha returned.
```

---

# 61. Save System

Use:

```text
IndexedDB
```

Optional:

```text
Dexie.js
```

Save:

- Heroes
- Relationships
- Memories
- Base
- Buildings
- Resources
- Rift progression
- Expeditions
- Dead heroes
- World seed
- Game time

---

# 62. Recommended Tech Stack

Core:

```text
Vite
TypeScript
Three.js
HTML
CSS
IndexedDB
```

Optional later:

```text
Zustand
Dexie
Howler.js
Rapier
```

Avoid adding heavy dependencies before necessary.

---

# 63. Architecture

Keep simulation independent from rendering.

```text
Simulation
   ↓
Game State
   ↓
Render Synchronization
   ↓
Three.js
```

Never let a Three.js mesh become the authoritative hero data.

---

# 64. Suggested Project Structure

```text
src/

core/
  Game.ts
  GameClock.ts
  EventBus.ts
  Random.ts

simulation/
  Simulation.ts
  TickSystem.ts

heroes/
  Hero.ts
  HeroGenerator.ts
  HeroManager.ts
  HeroProgression.ts
  PersonalitySystem.ts
  TraitSystem.ts
  MemorySystem.ts
  RelationshipSystem.ts
  NeedsSystem.ts

training/
  TrainingSystem.ts
  MentorSystem.ts

classes/
  ClassSystem.ts
  ClassDefinitions.ts

combat/
  CombatSimulation.ts
  UtilityAI.ts
  ActionScoring.ts
  CombatResolver.ts
  FormationSystem.ts

squads/
  Squad.ts
  SquadManager.ts

expeditions/
  Expedition.ts
  ExpeditionGenerator.ts
  EncounterSystem.ts
  MissionSystem.ts

base/
  Base.ts
  FacilitySystem.ts
  ConstructionSystem.ts
  ResourceSystem.ts

world/
  RiftGenerator.ts
  RegionGenerator.ts

rendering/
  Renderer.ts
  CameraController.ts
  SceneManager.ts

rendering/heroes/
  HeroRenderer.ts
  HeroMeshGenerator.ts

rendering/base/
  FacilityRenderer.ts

rendering/world/
  EnvironmentGenerator.ts

ui/
  HUD.ts
  HeroPanel.ts
  SquadPanel.ts
  ExpeditionPanel.ts
  EventLog.ts

storage/
  SaveManager.ts
```

---

# 65. MVP

The first playable MVP should contain only:

## Base

- Small procedural base
- Training area
- Dormitory
- Gate

## Heroes

5 procedural heroes.

Each hero has:

- Name
- Appearance
- Health
- Morale
- Skills
- Personality
- Traits
- Relationships
- Level

## Training

- Basic physical training
- Weapon training

## Squad

- 3-person squad

## Combat

- One small arena
- Basic enemies
- Utility AI
- Basic attack
- Defense
- Heal
- Retreat

## Expedition

- One mission type
- One environment
- One reward system

## Death

- Permanent hero death

## Base Life

- Eating
- Sleeping
- Training
- Social interaction

## UI

- HUD
- Hero selection
- Hero panel
- Squad setup
- Event log

---

# 66. MVP Success Criteria

The MVP succeeds if:

- Heroes feel different
- A weak hero can become useful
- Squad composition matters
- Watching combat is interesting
- Relationships create behavior changes
- Hero death feels significant
- Returning from expeditions feels rewarding
- The player wants to know what happens to individual heroes

---

# 67. Long-Term Expansion Ideas

Possible future systems:

- Magic
- Advanced classes
- Rival settlements
- PvE factions
- Diplomacy
- Large bosses
- More expedition biomes
- Crafting specialties
- Hero titles
- Family systems
- Hero retirement
- Legacy traits
- Procedural story arcs
- Modding
- Challenge modes
- Endless Rift
- Scenario editor
- Daily world modifiers
- Boss mutations
- Seasonal systems

---

# 68. Core Unique Selling Point

> **A living 3D hero-management game where procedurally generated recruits grow through training, relationships, trauma, survival, and autonomous combat—turning ordinary survivors into legends or permanent casualties.**

---

# 69. Development Rule

Whenever deciding between:

```text
More heroes
```

and:

```text
Deeper hero behavior
```

choose deeper behavior.

Whenever deciding between:

```text
More maps
```

and:

```text
Better expedition decisions
```

choose better decisions.

Whenever deciding between:

```text
More stats
```

and:

```text
More meaningful consequences
```

choose consequences.

The game should always answer this question:

> **“Will this system create a story the player remembers?”**
