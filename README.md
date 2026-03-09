# CivGen — Civilization Simulator Lite

A browser-based **4X fantasy strategy game** you can play on desktop and control from your phone. Single-file React app with no build step, deterministic seeding, and complete AI-driven rivals.

## Quick Start

```bash
# Install Bun (if needed)
curl https://bun.sh | bash

# Start the relay server
bun server.js

# Then open in your browser:
# Game:   http://localhost:4321/
# Remote: http://localhost:4321/remote
```

- **Game URL** (desktop): Full strategy interface with map, HUD, inspector
- **Remote URL** (phone): Touch-friendly controller for commands and policy adjustment
- **Auto IP detection**: Server prints LAN IP on startup; use that to connect from phone

## Features

### 🌍 World & Exploration (Phase 1)
- **128×128 hex grid world** with biomes (grassland, forest, mountain, desert, tundra, coast)
- **Procedural generation** with seeded RNG for reproducible worlds
- **Fog of war system** (unseen → explored → visible tile states)
- **Resource nodes** (iron, copper, horses, wheat, fish, stone, gold, gems, mana)

### 🏘️ Empire Building (Phase 2)
- **Multiple settlements** — found new cities, manage populations
- **Production queue** — buildings, improvements, units
- **Resource economy** — food, industry, knowledge, happiness, stability
- **Growth mechanics** — population growth, unhappiness penalties, surplus/deficit tracking

### 🎖️ Units & Combat (Phases 3–5)
- **5 unit types** — Scout, Warrior, Archer, Knight, Mage
- **A* pathfinding** with terrain-based movement costs
- **Combat system** — melee vs ranged, terrain modifiers, unit strength scaling
- **Retreat mechanics** — damaged units can fall back to safety

### 🤖 Rival Factions (Phase 4)
- **4 AI opponents** — Orcs, Elves, Humans, Dwarves (or seeded variants)
- **Deterministic AI** — reproducible decisions, no hidden RNG
- **Expansion & settling** — rivals found cities and expand territory
- **Strategic behavior** — prioritize threats, defend settlements, pursue tech

### 🔬 Research & Progress (Phase 6)
- **30+ technologies** — Pottery, Agriculture, Writing, Bronze, Iron, Archery, Sailing, etc.
- **Prerequisite chains** — unlock advanced tech through research
- **Science production** — accumulate knowledge to unlock new capabilities
- **Civics system** — governance policies (Monarchy, Democracy, Theocracy, etc.)

### 🕊️ Diplomacy & Victory (Phases 7–8)
- **Diplomacy actions** — declare war, form alliances, propose trade
- **4 victory conditions**:
  - **Score victory** — highest civilization score wins
  - **Domination victory** — control 60%+ of the map
  - **Science victory** — research all technologies
  - **Diplomatic victory** — form alliance with all rivals
- **Magic system** — spells (Heal, Fireball, Meteor Storm), artifacts, mystical rituals

### 📱 Phone Remote Control
- **WebSocket relay server** — synchronizes game state across devices
- **Live game status** — turn, population, resources, happiness, stage
- **Remote controls** — Start, Pause, Resume, Next Turn, Reset
- **Policy adjustment** — modify strategy from your phone (14-point cap enforced)
- **Auto-reconnect** — graceful recovery on network interruption

## Architecture

### No Build Step
Everything runs directly from files in the browser. No bundler, no npm install, no compilation.

- **index.html** (~247 KB) — Entire game: React 18 (via CDN), Babel in-browser transpilation, all game logic and rendering
- **server.js** — Bun WebSocket relay; routes messages between host (game) and controllers (phones)
- **remote.html** — Phone controller UI; plain HTML/JS, no framework

### State Management
**Pure React reducer pattern:**
```javascript
const [state, dispatch] = useReducer(reducer, initialState);
```

Single `reducer(state, action)` function handles all state mutations. Deterministic seeding ensures reproducible worlds.

### Deterministic Gameplay
- **mulberry32** — seeded pseudo-random number generator
- **simplexNoise** — seeded procedural noise for terrain generation
- **Reproducible AI** — rivals make the same decisions given the same state + seed

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / Pause / Resume |
| `N` | Next Turn |
| `R` | Reset (new seed) |
| `C` | Toggle compact HUD mode |
| `O` | Cycle map overlay (State / Influence / Stress) |
| `1`–`6` | Select inspector tab |
| `M` | Center map |
| `F` | Fullscreen |

## Game Loop

1. **Menu** → Start game
2. **Running** → Auto-advance every ~2 seconds (turn = 1 season in game time)
3. **Each turn:**
   - AI factions make decisions (expand, research, attack, form alliances)
   - Resources produce, populations grow, unhappiness accumulates
   - Check victory conditions
4. **Pause/Resume** anytime to think or adjust policy
5. **Reset** to start a fresh world (new seed)

## Design System

All colors are CSS custom properties:

| Variable | Color | Usage |
|----------|-------|-------|
| `--ink` | #112538 | Primary text |
| `--paper` | #f0eadb | Backgrounds |
| `--gold` | #d59f4d | Accents, highlights |
| `--sea` | #2f7f9d | Links, primary buttons |
| `--forest` | #42734f | Growth, prosperity |
| `--wine` | #7f3f35 | Danger, reset |
| `--crisis` | #a63d33 | Crisis state |
| `--prosper` | #4f8e5d | Prosperity state |

**Fonts:** Bree Serif (headings) + Space Grotesk (body) — loaded from Google Fonts.

## WebSocket Protocol

**Host → Server → Controllers** (state broadcast, ~1 Hz):
```json
{
  "type": "state",
  "status": "running",
  "turn": 42,
  "score": 1250,
  "population": 145,
  "happiness": 68,
  "food": 55,
  "stability": 79,
  "stage": "Renaissance",
  "policies": { "agriculture": 2, "industry": 3, ... }
}
```

**Controller → Server → Hosts** (dispatch relay):
```json
{
  "type": "dispatch",
  "action": { "type": "STEP_TURN" }
}
```

## Reducer Actions

All game actions flow through the reducer:

| Action | Purpose |
|--------|---------|
| `START_GAME` | Enter running state |
| `PAUSE_GAME` | Pause simulation |
| `RESUME_GAME` | Resume from paused |
| `STEP_TURN` | Advance one turn |
| `RESET_GAME` | Reset to menu, new seed |
| `FOUND_CITY` | Build new settlement |
| `SELECT_CITY` | Focus inspector on city |
| `MOVE_UNIT` | Move unit to tile (pathfinding) |
| `ATTACK_UNIT` | Melee/ranged combat |
| `QUEUE_TECH` | Start researching technology |
| `QUEUE_CIVIC` | Adopt governance policy |
| `DECLARE_WAR` | Attack rival faction |
| `FORM_ALLIANCE` | Create diplomatic bond |
| `ACTIVATE_SPELL` | Cast magical ability |
| `COLLECT_ARTIFACT` | Gain mystical power |
| `SELECT_TILE` | Highlight map tile |
| `SET_OVERLAY` | Switch map visualization |
| `PIN_DISTRICT` | Pin city in inspector |
| `RENAME_VILLAGE` | Custom settlement name |
| `SET_POLICY` | Adjust policy track |

## Testing Hooks

While the game is mounted, these are exposed on `window`:

```javascript
window.render_game_to_text()  // → JSON snapshot of world state
window.advanceTime(ms)        // → simulate time passage
```

Use these for automated testing, state verification, or debugging.

## Browser Support

- **Chrome/Edge** — Full support (modern React + WebSocket)
- **Firefox** — Full support
- **Safari** — Full support (iOS 14+)
- **Mobile** — Remote controller UI is touch-optimized for phones

## Known Limitations

- **Babel in-browser transpilation** produces one expected warning in the console (not an error; unavoidable with CDN builds)
- **Single-player only** — Game logic is entirely client-side; multiple hosts will have independent worlds
- **localStorage not used** — Game state is ephemeral; refresh resets (use seed copy to resume)
- **No fog of war rendering** on the current map overlay (system exists, just not visualized yet)

## Project Structure

```
CivGen/
├── index.html      # Game (React 18, ~5000 lines, all game logic)
├── remote.html     # Phone controller (~375 lines)
├── server.js       # Bun relay server (~90 lines)
├── CLAUDE.md       # Complete system documentation (the "Bible")
├── progress.md     # Session history & feature log
├── README.md       # This file
└── .gitignore      # Excludes .claude/ metadata
```

## Development

To modify the game:

1. **Edit index.html** — All game code is in `<script type="text/babel">` (single component)
2. **Keep the reducer pure** — No side effects in `reducer()` function
3. **Restart server** — `bun server.js` to reload changes
4. **Check console** — Only Babel transpile warning should appear

For detailed architecture and all reducer actions, see [CLAUDE.md](CLAUDE.md).

## Inspiration

Built with Endless Legend, Civilization VI, and classic 4X strategy games in mind. Deterministic seeding and modular design allow for reproducible gameplay and easy testing.

## License

MIT — Feel free to use, modify, and share!

---

**Ready to play?** Start the server and open http://localhost:4321/ 🎮
