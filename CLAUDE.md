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
