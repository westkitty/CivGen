# CLAUDE.md — CivGen

**Civilization Simulator Lite** — a single-file browser game with a phone remote control.

---

## Project Structure

```
CivGen/
├── index.html      # Entire game — React 18 (CDN+Babel), ~5000 lines
├── remote.html     # Phone controller UI (plain HTML/JS, ~375 lines)
├── server.js       # Bun relay server — serves files + WebSocket relay
├── progress.md     # Session history / feature log
└── output/
    └── web-game/   # Playwright validation artifacts (screenshots, state JSON)
```

No build step, no package.json, no bundler. Everything runs from files directly.

---

## Running the Game

```bash
# Start the relay server (requires Bun)
bun server.js
# → Game:   http://<LAN-IP>:4321/
# → Remote: http://<LAN-IP>:4321/remote
```

- Open the **Game** URL on desktop/laptop.
- Open the **Remote** URL on a phone (same WiFi) to get the mobile controller.
- The server auto-detects local IP and prints both URLs on startup.

---

## Architecture

### `index.html` — The Game

Single-file React 18 app loaded via CDN (`unpkg.com`). Babel transpiles JSX in-browser, which produces one expected Babel warning in the console — this is normal and not an error.

**State management:** React `useReducer` with a pure `reducer(state, action)` function.

**Reducer actions:**
| Action | Description |
|--------|-------------|
| `START_GAME` | Transitions from `menu` to `running` |
| `PAUSE_GAME` | Pauses the auto-step timer |
| `RESUME_GAME` | Resumes from paused state |
| `STEP_TURN` | Advances simulation by one turn |
| `RESET_GAME` | Resets to initial state with a new seed (`{ seed: number }`) |
| `SET_POLICY` | Adjusts a policy track (`{ key, delta: +1/-1 }`) |
| `PIN_DISTRICT` | Pins/unpins a district in the inspector |
| `SELECT_TILE` | Selects a map tile / district |
| `SET_OVERLAY` | Switches map overlay mode |
| `RENAME_VILLAGE` | Renames a settlement |
| `START_PROJECT` | Queues a production project |
| `TOGGLE_COMPACT` | Toggles compact HUD mode |

**Game status enum:** `"menu"` → `"running"` ↔ `"paused"` → `"ended"`

**Policy tracks (8 total, max 14 points across all):**
`agriculture`, `industry`, `education`, `health`, `environment`, `security`, `welfare`, `research`

**Development stages:** Defined in the `STAGES` array — the village advances through named stages as it grows.

**Key functions:**
- `createInitialState(seed?)` — deterministic world generation
- `reducer(state, action)` — pure state transition function
- `getVillageModel(state)` — derives rich inspector data (alerts, notices, comparisons, zones)
- `getWorldSnapshot(state)` — serializable state snapshot for testing/remote

**Deterministic testing hooks** (exposed on `window` while game is mounted):
```js
window.render_game_to_text()  // → JSON snapshot of current world state
window.advanceTime(ms)        // → simulate passage of time
```

**Keyboard shortcuts:**
| Key | Action |
|-----|--------|
| `Space` | Start / Pause / Resume |
| `N` | Next Turn |
| `R` | Reset |
| `C` | Toggle compact mode |
| `O` | Cycle map overlay |
| `1`–`6` | Select inspector tab |
| `M` | Center map |
| `F` | Fullscreen |

**Inspector tabs:** Overview, Events, Policies, Buildings, Districts, Production

**Map overlay modes:** State, Influence, Stress (visually distinct fills/patterns)

### `remote.html` — Phone Controller

Plain HTML/JS with no framework. Connects to the relay server at `/ws?role=controller`.

- Displays live game state (turn, score, population, happiness, food, stability, stage).
- Sends dispatch commands to the game: `START_GAME`, `STEP_TURN`, `PAUSE_GAME`, `RESUME_GAME`, `RESET_GAME`, `SET_POLICY`.
- Auto-reconnects every 3 s on disconnect.
- Policy cap enforced client-side (14 total points).

### `server.js` — Bun Relay

WebSocket relay on port `4321`. Two roles:
- **host** (`/ws?role=host`) — the desktop game tab; broadcasts state snapshots to controllers.
- **controller** (`/ws?role=controller`) — phone remotes; sends dispatch commands to hosts.

The server just relays messages: host→all controllers (state), controller→all hosts (commands). No game logic lives here.

---

## Design System

All colors are CSS custom properties on `:root`:

| Variable | Value | Usage |
|----------|-------|-------|
| `--ink` | `#112538` | Primary text, dark |
| `--paper` | `#f0eadb` | Background, panels |
| `--sand` | `#dcc9a3` | Borders, muted fills |
| `--gold` | `#d59f4d` | Accents, highlights |
| `--brass` | `#c57d2c` | Labels, secondary accents |
| `--sea` | `#2f7f9d` | Links, info, primary buttons |
| `--forest` | `#42734f` | Growth, positive indicators |
| `--wine` | `#7f3f35` | Danger, reset actions |
| `--crisis` | `#a63d33` | Crisis state |
| `--prosper` | `#4f8e5d` | Prosperous state |

**Fonts:** `Bree Serif` (headings, `h1`–`h4`) + `Space Grotesk` (body, UI). Loaded from Google Fonts.

**Panel style:** `background: var(--panel)` with `backdrop-filter: blur(14px)`, `border-radius: 24px`, `box-shadow: var(--shadow)`.

---

## Conventions

- **No build step.** Never add a bundler or npm package. CDN links only.
- **Single file for game.** All game logic, styles, and assets live in `index.html`. Do not split into multiple files.
- **Pure reducer.** `reducer()` must remain a pure function. Side effects belong in `useEffect` hooks.
- **Deterministic seeding.** World generation uses a seed so states are reproducible.
- **One Babel warning is expected.** Do not suppress it — it's a known CDN limitation.
- **Remote shares the same design tokens.** Keep `--ink`, `--paper`, `--gold`, etc. in sync between `index.html` and `remote.html`.
- **server.js is dumb.** It routes messages only. No game state, no validation.

---

## Verification

After changes to `index.html`:
1. Run `bun server.js` and open `http://localhost:4321/` in a browser.
2. Check browser console — only the Babel in-browser transpile warning is acceptable. Zero runtime errors.
3. Test: Start → Step Turn × 3 → Pause → Resume → Reset.
4. If Playwright is available: `window.render_game_to_text()` should return valid JSON.

After changes to `server.js`:
- Kill and restart with `bun server.js`.
- Confirm both Game and Remote URLs load correctly.
- Connect Remote and verify state updates flow through.

---

## WebSocket Message Protocol

**host → server → controllers** (state broadcast):
```json
{ "type": "state", "status": "running", "turn": 12, "score": 340,
  "population": 87, "happiness": 62, "food": 44, "stability": 71,
  "stage": "Hamlet", "policies": { "agriculture": 2, "industry": 1, ... } }
```

**controller → server → hosts** (dispatch relay):
```json
{ "type": "dispatch", "action": { "type": "STEP_TURN" } }
{ "type": "dispatch", "action": { "type": "SET_POLICY", "key": "health", "delta": 1 } }
{ "type": "dispatch", "action": { "type": "RESET_GAME", "seed": 1709906123 } }
```

**server → controller** (host count notification):
```json
{ "type": "hosts", "count": 1 }
```

---

## 4X Game Systems (Phases 1-8)

### Phase 1: World Map & Fog of War

**Functions:**
- `generateWorldMap(width, height, seed)` → generates deterministic 128×128 tile grid
- `getVisibleTiles(centerX, centerY, radius, worldMap)` → calculates sight radius for units
- `seededRandom(seed)`, `mulberry32(a)`, `simplexNoise(x, y, seed)` → deterministic RNG/noise

**Biomes:** water, coast, plains, forest, mountain, desert, tundra, swamp, crystalForest, ruins

**Resources:** copper, iron, wood, wheat, aether, fish (tied to specific biomes)

**State additions:**
- `worldMap: Tile[][]` — full map state
- `exploredTiles: Set<"x,y">` — discovered but not currently visible
- `visibleTiles: Set<"x,y">` — in current sight range
- `mapOverlay: 'none'|'terrain'|'resources'|'magic'`

**Actions:** `EXPLORE_REGION`, `CYCLE_MAP_OVERLAY`

---

### Phase 2: Multi-City Empire System

**Structure:**
```js
empire: {
  name: "Your Civilization",
  cities: [{ id, name, x, y, population, food, industry, ... }, ...],
  selectedCityId: "city-capital-123",
  units: [{ id, type, x, y, health, movement, ... }, ...],
  selectedUnitId: "unit-scout-0",
  factions: { player, faction-1, faction-2, faction-3 },
  selectedFactionId: "player",
}
```

**City Properties:** population, food, industry, knowledge, happiness, health, environment, stability, technologyLevel, developmentStage, policies, projectQueue, eventLog, history

**Actions:** `FOUND_CITY { x, y, name }`, `SELECT_CITY { cityId }`

**Key function:** `simulateTurn()` now syncs city data bidirectionally

---

### Phase 3: Units & Movement & Exploration

**Unit Types:**
| Type | Movement | Sight | Can Found | Cost |
|------|----------|-------|-----------|------|
| Scout | 4 | 4 | No | 25 |
| Settler | 2 | 2 | Yes | 40 |
| Warrior | 2 | 2 | No | 35 |
| Archer | 2 | 3 | No | 40 |
| Cavalry | 4 | 2 | No | 50 |

**Functions:**
- `createUnit(type, x, y, ownerId, id)` → creates unit instance
- `findPath(startX, startY, endX, endY, worldMap)` → A* pathfinding
- `getTerrainCost(tile)` → movement cost by biome

**Actions:** `MOVE_UNIT { unitId, x, y }`, `SELECT_UNIT { unitId }`, `CREATE_UNIT { cityId, unitType }`

**Mechanics:**
- Scout/Settler auto-explore (reveal fog) when moving
- Units have movement budget per turn
- Terrain affects pathfinding (mountains/forests = higher cost)

---

### Phase 4: Rival Factions & AI

**Factions:**
- `player` — Your Civilization (blue)
- `faction-1` — Shadowborn Empire (wine red)
- `faction-2` — Luminaries (gold)
- `faction-3` — Wildborn Tribes (forest green)

**Structure:**
```js
factions: {
  id: "faction-1",
  name: "Shadowborn Empire",
  color: "#7f3f35",
  cities: [{ id, name, x, y, population, ... }, ...],
  units: [{ id, type, x, y, ... }, ...],
  research: { currentTech, points },
  diplomacy: { player: "war", "faction-2": "peace", ... },
  treasury: 50,
}
```

**AI Decision System:** `makeAIDecision(faction, worldMap, allFactions, allUnits, turn, seed)`
- 70% chance: attempt to found new city (if < 3 cities)
- 80% chance: produce Scout unit (if > 30 industry)
- 90% chance: move a unit autonomously

Fully deterministic based on seed + turn + faction ID.

**Actions:** Game now spawns AI turns after STEP_TURN

---

### Phase 5: Combat System

**Combat Resolution:**
```js
resolveCombat(attacker, defender) → { attackerWins: bool, damage: number }
```

Odds calculated: `attackerStr / (attackerStr + defenderStr)` where strength = health × unit-type-multiplier

**Actions:** `ATTACK_UNIT { attackerId, defenderId }`

**Mechanics:**
- Damage ranges 10-70 depending on outcome
- Units die when health ≤ 0
- Combat feedback logged to action feed

---

### Phase 6: Research & Civics Trees

**Technologies (10 total):**
| Tech | Cost | Era | Requires |
|------|------|-----|----------|
| Bronze | 50 | Ancient | — |
| Archery | 60 | Ancient | — |
| Writing | 70 | Ancient | — |
| Iron | 75 | Classical | Bronze |
| Mathematics | 80 | Classical | Writing |
| Commerce | 85 | Classical | Writing |
| Engineering | 100 | Medieval | Mathematics |
| Military | 90 | Medieval | Archery |
| Banking | 110 | Renaissance | Commerce |
| Gunpowder | 120 | Renaissance | Iron |

**Civics (4 types):**
- Monarchy (cost: 40)
- Republic (cost: 60)
- Theocracy (cost: 50)
- Democracy (cost: 70)

**Actions:** `QUEUE_TECH { techId }`, `QUEUE_CIVIC { civicId }`

**Mechanics:** Tech/civic research consumes knowledge/culture points; unlocks buildings, units, bonuses

---

### Phase 7: Diplomacy & Victory Conditions

**Diplomatic Actions:** `DECLARE_WAR { factionId }`, `FORM_ALLIANCE { factionId }`

**Victory Conditions:**
| Type | Target | Tracking |
|------|--------|----------|
| Score | 5000 points | Accumulation |
| Domination | Control 60% of world | City/tile count |
| Science | Final tech: Space | Tech completion |
| Diplomatic | World Congress vote | Influence/favor |

**Grievance System Framework:**
- Border disputes (random starting point)
- Surprise war penalties
- Territorial violations
- Diplomatic consequences

---

### Phase 8: Magic Systems & Endgame

**Magical Features:**
- Ley lines on map (resource nodes for mana)
- Crystal forests (magical terrain)
- Ruins (exploration rewards)
- Artifact discovery (5 total: Grail, Crown, Staff, Ring, Sword)

**Actions:** `ACTIVATE_SPELL { spellId }`, `COLLECT_ARTIFACT { artifactId }`

**Mechanics:**
- Magic resources (aether/mana) regenerate per turn
- Spells have cooldowns and mana costs
- Artifacts provide permanent bonuses
- Artifact victory: collect 5 artifacts to win

**Late-Game Layers:**
- Naval units unlock late-era
- Sky/orbital units in final eras
- Espionage actions
- Ideological blocs
- Climate/plague mechanics

---

## Reducer Action Summary

| Action | Phase | Purpose |
|--------|-------|---------|
| START_GAME | Core | Begin simulation |
| PAUSE_GAME | Core | Pause auto-resolve |
| RESUME_GAME | Core | Resume auto-resolve |
| STEP_TURN | Core | Advance 1 turn |
| RESET_GAME | Core | New game with seed |
| SET_POLICY | Core | Adjust policy slider |
| EXPLORE_REGION | 1 | Reveal fog of war |
| CYCLE_MAP_OVERLAY | 1 | Switch map view |
| FOUND_CITY | 2 | Create new city |
| SELECT_CITY | 2 | Switch active city |
| MOVE_UNIT | 3 | Move unit, explore |
| SELECT_UNIT | 3 | Select active unit |
| CREATE_UNIT | 3 | Produce unit |
| ATTACK_UNIT | 5 | Battle units |
| QUEUE_TECH | 6 | Research technology |
| QUEUE_CIVIC | 6 | Adopt government |
| DECLARE_WAR | 7 | War declaration |
| FORM_ALLIANCE | 7 | Alliance pact |
| ACTIVATE_SPELL | 8 | Cast spell |
| COLLECT_ARTIFACT | 8 | Find artifact |

---

## Testing & Verification Checklist

**Per-phase verification:**
1. ✅ World map generates identically with same seed
2. ✅ Multiple cities can be founded at different coordinates
3. ✅ Units move and explore, revealing fog of war
4. ✅ AI factions autonomously settle and expand
5. ✅ Combat resolves units correctly
6. ✅ Tech/civic queuing tracks knowledge consumption
7. ✅ Diplomacy actions log to action feed
8. ✅ Spells and artifacts integrate with map features

**Determinism hooks:**
```js
window.render_game_to_text() // → Full game state JSON
window.advanceTime(1000)     // → Simulate 1000 game turns
```

Both must be identical across runs with same seed.

---

## Known Limitations & Future Work

- **AI:** Deterministic but simple; no long-term strategy planning
- **UI:** Mostly text-based action feedback; map visualization not yet integrated
- **Multiplayer:** Single-player only; remote control is informational
- **Balance:** Resource costs and tech trees not fully tuned
- **Late-game:** Naval, sky, and espionage mechanics defined but not implemented
- **Graphics:** No custom SVG assets yet; text-based game board

---

## Architecture Principles Maintained

1. **Single HTML file** — All code in `index.html`, no build step
2. **Pure reducer** — All state transitions deterministic
3. **Deterministic seeding** — Every world/city/unit reproducible
4. **Phone remote control** — State broadcasts every 1s, commands relay bidirectionally
5. **Keyboard-first UI** — Full game playable via `Space`, `N`, `R`, `C`, `O`, `1-6`, `M`, `F`, `Ctrl+S`, `Ctrl+L`
6. **Zero runtime errors** — Console clean except expected Babel warning
7. **Elegant feedback** — Action feed explains what happened and why
8. **Modular logic** — Each phase is self-contained; easy to extend

---

## Phase 9: Late-Game Enhancements & Quality-of-Life (2026-03-09)

### Feature 1: Fog of War Visualization
- **Mode toggle:** `TOGGLE_FOG_VISUALIZATION` switches between visual patterns and simple colors
- **Three states:** unseen (dark), explored (muted), visible (normal)
- **Rendering:** Stripe patterns for explored tiles, overlay for unseen
- **Control:** Driven by unit sight radius and city control ranges

### Feature 2: Naval Units & Water Systems
- **Unit types:** GALLEY (scout), CARAVEL (trade), BATTLESHIP (combat)
- **Mechanics:** Water-only units with 6 movement points, 100 HP
- **Action:** `CREATE_NAVAL_UNIT { unitType, x, y, faction }`
- **AI:** Naval units move autonomously to patrol and explore coastlines

### Feature 3: Late-Game Crises
- **Plague system:** Triggers when health < 45, spreads to cities
- **Climate change:** Accumulates based on pollution/environment degradation
- **Migration waves:** Activates when population > 150, puts border pressure
- **Integration:** Crisis state tracked in `crises` object, logged in crisis log
- **Effects:** Plague damages health, climate increases severity, migration causes unrest
- **UI:** Crises displayed in status text with intensity levels

### Feature 4: Espionage & Intelligence Layer
- **Spy dispatch:** `DISPATCH_SPY { targetFaction, mission, x, y, detectionRisk }`
- **Missions:** Tech theft, sabotage, reconnaissance, espionage
- **State:** `espionage.playerSpies` tracks active operations
- **Risk:** Detection risk 0.3–0.8; failure consequences vary by mission
- **Rival spies:** Rival factions also spy; player gets alerts on detected operations

### Feature 5: Cultural & Ideological Victory Path
- **Culture generation:** Accumulates from knowledge, tourism, and special buildings
- **Tourism:** Generated through trade routes and cultural wonders
- **Ideologies:** Autocracy, Democracy, Theocracy, Meritocracy (track adherents)
- **Victory condition:** Reach cultural dominance when rival cultures < 30%
- **Action:** `GENERATE_CULTURE { amount, tourism }` manually boosts progress

### Feature 6: AI Adaptivity & Learning
- **Tactic tracking:** `aiLearning.playerTactics` records player strategies (population-growth, military-focus, tech-rush)
- **Threat assessment:** Rivals evaluate player military strength, expansion rate, tech advantage
- **Coalition forming:** AI factions ally when threatened by stronger rival
- **Counter-building:** Rivals prioritize counters to detected player strategies
- **Behavior:** Shifts from expansion-heavy to defense-heavy based on threat level

### Feature 7: Animation Queue System
- **State:** `animations` tracks unit movements, combat sequences, wonder constructions
- **Actions:** `QUEUE_ANIMATION { animationType, id, duration, data }`
- **Types:** unitMovements, combatSequences, wonderConstructions
- **Rendering:** Canvas can poll animation queue for transition effects

### Feature 8: Faction Specialization & Unique Units
- **Specialization bonuses:** Each faction has unique strengths (military, science, culture, balanced)
- **Unique buildings:** Factions unlock faction-specific structures (e.g., Elven Archers Tower)
- **Unique units:** Orcs get heavier units, Elves get archers with bonuses, Humans get versatile units
- **Action:** `ADD_FACTION_BUILDING { faction, building }` unlocks structure
- **Gameplay:** Faction identity emerges naturally through building availability

### Feature 9: Wonder Construction Animations
- **Tracking:** `wonderConstructionStates` maps wonder ID to (progress, constructing, animationFrame)
- **Action:** `UPDATE_WONDER_CONSTRUCTION { wonderId, progress, constructing, frame }`
- **Animation frames:** 0–100 representing construction stages
- **Visual:** Canvas can render partial wonder completion as frame-based animation

### Feature 10: Save/Load & Persistent Sessions
- **Auto-save:** Every 5 turns, game saves to localStorage with key `civgen-save-{timestamp}`
- **Save data:** turn, year, rngSeed, empire, factions, crises, culture, timestamp
- **Keyboard shortcuts:**
  - `Ctrl+S` → Save current game state
  - `Ctrl+L` → Load latest autosave
- **Restoration:** Loaded game resumes in paused state with full state restored
- **Capacity:** Multiple saves kept in localStorage; oldest auto-deleted when quota full

---

## New Reducer Actions (Phase 9)

| Action | Purpose |
|--------|---------|
| `TOGGLE_FOG_VISUALIZATION` | Switch fog of war visual mode |
| `CREATE_NAVAL_UNIT` | Spawn ship unit on water |
| `TRIGGER_CRISIS` | Activate plague/climate/migration |
| `DISPATCH_SPY` | Send spy mission to rival faction |
| `GENERATE_CULTURE` | Boost cultural progress |
| `UPDATE_AI_LEARNING` | Record player tactics for AI |
| `QUEUE_ANIMATION` | Add animation to queue |
| `ADD_FACTION_BUILDING` | Unlock faction-specific structure |
| `UPDATE_WONDER_CONSTRUCTION` | Animate wonder progress |
| `SAVE_GAME` | Save to localStorage |
| `LOAD_GAME` | Restore from localStorage |

---

## New State Fields (Phase 9)

```javascript
{
  fogOfWarRenderMode: 'visual' | 'simple',
  seaUnits: [{ id, type, x, y, faction, hp, movement }],
  crises: {
    plague: { active, intensity, affectedCities },
    climate: { temperature, severity },
    migration: { active, pressureLevel },
  },
  crisisLog: [{ turn, type, detail }],
  espionage: {
    playerSpies: { [spyId]: { id, target, mission, x, y, detectionRisk } },
    rivalSpies: {},
    techThefts: [],
    sabotageTargets: [],
  },
  culture: {
    playerCulture,
    tourismGenerated,
    culturalInfluence: {},
    ideologies: { autocracy, democracy, theocracy, meritocracy },
    ideologyAdherents: {},
  },
  aiLearning: {
    playerTactics: [],
    coalitions: [],
    threatAssessment: {},
    adaptiveResponses: {},
  },
  animations: {
    unitMovements: [{ id, duration, startTime, data }],
    combatSequences: [],
    wonderConstructions: [],
  },
  factionSpecializations: { [faction]: { strengthBonus, scienceBonus, cultureBonus, uniqueBuildings, uniqueUnits } },
  wonderConstructionStates: { [wonderId]: { progress, constructing, animationFrame } },
  autoSaveEnabled: true,
  lastSaveTime: number,
}
```

---

