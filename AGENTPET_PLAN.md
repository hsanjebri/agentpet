# AgentPet — Build Plan

> A desktop pet that babysits your AI coding agent. It sleeps when the agent is idle,
> types while it works, **jumps and meows when the agent needs your approval**, and
> dances when the task is done.

This file is the source of truth for building AgentPet. Work through the phases in
order. Each phase ends with acceptance criteria — don't start the next phase until
they pass.

---

## 1. Product summary

**Problem:** Developers start an AI agent (Claude Code, Codex, Cursor…), switch to
another window, and the agent sits waiting for a permission prompt for 10–20 minutes.
Nobody notices. Nobody knows what the agent is doing or how much it costs.

**Solution:** A small always-on-top animated pet in the corner of the screen that
reflects the agent's live status and grabs your attention only when it matters.

**Target users:** Developers and vibe coders using terminal/IDE AI agents.

**Principles**
- Lightweight and never in the way (click-through except on the pet itself)
- Never slows down or breaks the agent (hooks must be fire-and-forget)
- Local only: no data leaves the machine, server binds to 127.0.0.1
- Cute and shareable: every feature should look good in a 15-second video

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| App shell | Electron (latest stable) |
| Scaffolding | `electron-vite` (React + TypeScript template) |
| UI | React 18 + TypeScript, pets drawn as SVG React components, CSS keyframe animations |
| State | Small custom store (Zustand) in the renderer |
| Local event server | Node `http` module inside the Electron main process |
| Hook CLI | Small Node script `agentpet-send` (zero dependencies) |
| File watching (later) | `chokidar` |
| Settings persistence | `electron-store` |
| Sounds | Short `.ogg` / `.mp3` files played from the renderer |
| Packaging | `electron-builder` (Windows .exe, macOS .dmg, Linux .AppImage) |
| Tests | Vitest (state machine, event parsing) |
| Lint/format | ESLint + Prettier |

---

## 3. Architecture

```
┌────────────────┐   hook fires    ┌──────────────────┐   HTTP POST    ┌─────────────────────────┐
│  Claude Code   │ ──────────────► │  agentpet-send   │ ─────────────► │ Electron main process   │
│  (or Codex…)   │  JSON on stdin  │  (Node CLI)      │ 127.0.0.1:7777 │  - event server          │
└────────────────┘                 └──────────────────┘                │  - session tracker      │
                                                                        │  - window manager       │
                                                                        └───────────┬─────────────┘
                                                                                    │ IPC
                                                                        ┌───────────▼─────────────┐
                                                                        │ Renderer (React)        │
                                                                        │  - mood state machine   │
                                                                        │  - pet SVG + animations │
                                                                        │  - speech bubble, sound │
                                                                        └─────────────────────────┘
```

### Folder structure

```
agentpet/
├── src/
│   ├── main/
│   │   ├── index.ts            # app entry, creates window + tray
│   │   ├── window.ts           # transparent overlay window, positioning, click-through
│   │   ├── server.ts           # local HTTP event server (127.0.0.1:7777)
│   │   ├── sessions.ts         # tracks active agent sessions (one pet per session later)
│   │   ├── tray.ts             # tray icon + menu (skin, mute, focus mode, quit)
│   │   └── focus.ts            # bring the agent's terminal/IDE to front (best effort)
│   ├── preload/
│   │   └── index.ts            # exposes safe IPC API: onAgentEvent, setInteractive, etc.
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── store.ts            # Zustand store: mood, session info, settings
│   │   ├── moodMachine.ts      # pure function: (state, event) -> new state
│   │   ├── pets/
│   │   │   ├── Pet.tsx         # picks skin + mood, renders SVG
│   │   │   ├── pixel/          # Noodle pixel-art renderer: grid.ts, tail.ts, outline.ts, NoodleSprite.tsx
│   │   │   ├── skins.ts        # vector skins (Mochi, Zitouna, Byte, Ribbit, Bolt)
│   │   │   └── parts/          # Eyes.tsx, Mouth.tsx, Ears.tsx, Effects.tsx
│   │   ├── Bubble.tsx          # hover/status speech bubble
│   │   ├── sounds.ts
│   │   └── styles/animations.css
│   └── shared/
│       └── events.ts           # shared event types (used by main, renderer, CLI)
├── cli/
│   └── agentpet-send.js        # hook script: reads stdin JSON, POSTs to app, never fails
├── scripts/
│   ├── install-hooks.ts        # merges AgentPet hooks into ~/.claude/settings.json (with backup)
│   └── uninstall-hooks.ts
├── assets/
│   ├── sounds/                 # meow.ogg, done.ogg, alert.ogg
│   └── icons/                  # tray + app icons
├── tests/
├── electron-builder.yml
└── README.md
```

---

## 4. Event protocol

All agents are normalized into one event shape before reaching the renderer.

```ts
// src/shared/events.ts
export type AgentKind = "claude-code" | "codex" | "cursor" | "unknown";

export type PetEventType =
  | "session_start"
  | "working"        // user sent a prompt
  | "tool"           // agent is using a tool (edit, bash, read…)
  | "needs_you"      // agent is waiting for permission / input
  | "done"           // agent finished its turn
  | "error"          // tests failed / command failed
  | "risky"          // risky action detected (.env, deleted tests, many files)
  | "session_end";

export interface PetEvent {
  type: PetEventType;
  agent: AgentKind;
  sessionId?: string;
  cwd?: string;          // project folder (show project name in bubble)
  toolName?: string;     // e.g. "Edit", "Bash"
  target?: string;       // file path or command (shortened for display)
  message?: string;      // e.g. permission message from the agent
  timestamp: number;
}
```

### Mood state machine

| Mood | Entered on | Leaves when |
|---|---|---|
| `sleeping` | app start, or no events for 2 min | any `working` / `tool` event |
| `working` | `working`, `tool` | `needs_you`, `done`, `error`, `risky` |
| `needs` | `needs_you` | next `working`/`tool` event, or user clicks the pet |
| `happy` | `done` | after 5 s → `sleeping` (or `working` if new event) |
| `sweat` | session cost passes threshold (Phase 4) | after 4 s → previous mood |
| `sad` | `error` | after 5 s → previous mood |
| `hiss` | `risky` | after 4 s → previous mood |

Priority when events collide: `needs` > `hiss` > `sad` > `happy` > `sweat` > `working` > `sleeping`.
`needs` must never be overwritten by a lower-priority event until the user responds.

Implement `moodMachine.ts` as a **pure function** with full unit tests.

---

## 5. Claude Code integration

Claude Code supports **hooks**: shell commands run at lifecycle events. The hook
receives a JSON payload on stdin (fields include things like `session_id`, `cwd`,
`hook_event_name`, `tool_name`, `tool_input`, and `message` for notifications).
**Verify the exact event names and payload fields against the current Claude Code
hooks documentation before implementing** — do not assume.

### Mapping

| Claude Code hook | AgentPet event |
|---|---|
| `SessionStart` | `session_start` |
| `UserPromptSubmit` | `working` |
| `PreToolUse` (matcher `*`) | `tool` (+ risk check on `tool_input`) |
| `Notification` | `needs_you` |
| `Stop` | `done` |
| `SessionEnd` | `session_end` |

### `cli/agentpet-send.js` requirements
- Usage: `agentpet-send <claude-code|codex> [eventOverride]`
- Reads all of stdin (with a 500 ms cap), parses JSON if present, maps to `PetEvent`
- POSTs to `http://127.0.0.1:7777/event` with a **300 ms timeout**
- **Always exits 0, prints nothing to stdout**, even if the app isn't running or JSON is broken.
  A hook must never block, slow down, or change the agent's behavior.
- No npm dependencies (plain Node), so it runs anywhere Node is installed

### Risk detection (runs in main process on `tool` events)
Flag as `risky` when:
- an edited/written file path matches `.env*`, `*secret*`, `*.pem`, `id_rsa*`
- a bash command contains `rm -rf`, `git push --force`, `DROP TABLE`, `chmod 777`
- a test file is deleted
- more than 25 distinct files touched in the current turn

### `scripts/install-hooks.ts`
- Locate `~/.claude/settings.json` (create if missing)
- **Back it up** to `settings.json.agentpet-backup-<timestamp>` before writing
- Merge AgentPet hook entries without removing or modifying the user's existing hooks
- Idempotent: running twice doesn't duplicate entries (tag entries so they can be found)
- `uninstall-hooks.ts` removes only AgentPet's entries
- The app's first-run screen offers "Connect Claude Code" which runs this, and shows exactly what will be added

---

## 6. Pet design

### 6.1 Main mascot: Noodle 🐱 (pixel art)

**Noodle** is AgentPet's official mascot and default pet: a chubby gray tabby in
pixel-art style whose **ridiculously long tail is the status display**. The face
reacts, but the tail does the talking. Noodle is an original character — keep him
original (no meme-cat lookalikes) so the brand is fully ours.

**Concept line for the README:** "Noodle's tail tells you what your agent is doing."

#### Pixel spec
- Grid: **34 × 22 pixels** (cat body uses roughly cols 2–18, tail space cols 16–33)
- Render scale: 7 px per pixel by default (238 × 154), integer scaling only (×1, ×2, ×3)
- Always render with `shape-rendering: crispEdges` (SVG) or `image-rendering: pixelated` (canvas/PNG)
- 1-pixel dark outline around body and tail, computed automatically (any empty cell
  touching a filled cell becomes outline)
- Tail is drawn as a separate layer from the body so it can animate independently
  (rotation origin = tail base)

#### Palette
| Key | Use | Hex |
|---|---|---|
| `k` | outline, eyes, mouth | `#2B2724` |
| `g` | body gray | `#B9B4AC` |
| `s` | tabby stripes, tail bands | `#7E7870` |
| `c` | cream muzzle, belly, paws | `#F3EEE6` |
| `p` | pink nose, inner ears | `#F2A0A8` |
| `w` | eye shine, fangs | `#FFFFFF` |
| `b` | sweat, tears | `#5AA9E6` |
| `r` | alert red | `#E24B4A` |
| `y` | coin, sparkles | `#EF9F27` |
| `m` | coffee mug | `#8A5A3B` |
| `v` | sleep "Z" | `#7F77DD` |

#### Body construction (grid coordinates)
- Head: ellipse center (10, 6.5), rx 7.6, ry 5.2
- Body: ellipse center (10, 15), rx 6.6, ry 5
- Ears: triangles from y 0–3 on cols 4–8 (left) and 12–16 (right), pink pixel at (5,2) and (15,2)
- Cream muzzle: ellipse (10, 9) rx 3.2 ry 1.7; cream belly: ellipse (10, 16) rx 3.6 ry 3
- Stripes: forehead (9,2) (10,2) (11,2) (10,3); cheeks (3,7) (17,7); sides (4,13) (4,14) (16,13) (16,14)
- Nose: (10, 8) pink; paws: (6,19) (7,19) (13,19) (14,19) cream
- Tail: 1 pixel thick (3 with outline), bands alternate `g`/`s` every 2 pixels,
  drawn as a polyline (Bresenham) from the base at about (16, 16–18)

#### Moods — the tail is the star
| Mood | Tail pose (polyline) | Face | Extra pixels | Animation |
|---|---|---|---|---|
| sleeping | wraps around the front like a blanket: (16,18)→(19,19)→(23,19)→(25,17)→(24,15)→(22,16) | closed line eyes | purple "z Z" | slow breathing |
| working | raised, tip holds a tiny coffee mug: (16,16)→(20,14)→(22,10)→(22,5) | half-lidded dot eyes | brown mug + steam at tail tip | tail sways while sipping |
| needs | **straight up like an antenna**, tip pixel turns red: (16,16)→(20,15)→(22,12)→(22,2) | big 2×2 eyes with shine, "o" mouth | red "!" next to the tail | body hops, tail vibrates |
| happy | **draws a heart** in the air: (16,16)→(20,14)→(23,11)→(21,8)→(21,6)→(23,5)→(24,6)→(25,5)→(27,6)→(27,8)→(24,11) | "^ ^" eyes, open smile | yellow/pink sparkles | tail wiggles fast |
| sweat | fans himself, tip holds a coin: (16,16)→(20,13)→(24,10)→(27,9) | dot eyes | sweat drop, 2×2 gold coin at tip | tail fans rapidly, body shivers |
| sad | **lies flat on the floor**, fully defeated: (16,18)→(19,20)→(31,20)→(32,19) | dot eyes + blue tear | — | slow droop |
| hiss | **puffed bottle brush** (3 pixels wide): (16,16)→(20,14)→(21,10)→(21,3) | angry diagonal brows, open mouth with fangs | red lightning | whole body shakes |

#### Implementation notes
- Build `src/renderer/pets/pixel/` with:
  - `grid.ts` — rasterizes the body shapes + mood face pixels into a cell map
  - `tail.ts` — tail polylines per mood + Bresenham line + banding
  - `outline.ts` — auto outline pass
  - `NoodleSprite.tsx` — renders the cell maps as SVG `<rect>`s in two layers
    (`<g class="tail">`, `<g class="body">`) plus an effects layer
- Animations are CSS keyframes using `steps()` timing so motion feels pixel-art (not smooth)
- Later, export each mood as a PNG sprite sheet (for tray icons, README GIFs, stickers)
- The reference prototype was designed in chat (interactive mood viewer); match its look

### 6.2 Additional skins (vector style)

Vector skins are SVG React components built from parts so every skin supports every mood.

| Skin | Description | Base / dark / belly |
|---|---|---|
| **Noodle** (default) | Pixel-art gray tabby, tail shows status (see 6.1) | `#B9B4AC` / `#7E7870` / `#F3EEE6` |
| **Mochi** | Orange tabby cat | `#F2A65A` / `#B8682A` / `#FCE3C4` |
| **Zitouna** | Tunisian street cat, white eye patch | `#A8A49C` / `#5F5E5A` / `#F4F2EC` |
| **Byte** | Dog with floppy ears | `#C58B5A` / `#7A4F2C` / `#F1DCC4` |
| **Ribbit** | Frog, eyes on top bumps | `#7CC36A` / `#3B6D11` / `#DDF0C8` |
| **Bolt** | Robot with antenna and face screen | `#AEB8C4` / `#4E5A68` / `#E3E8EE` |

### 6.3 Moods for vector skins
| Mood | Eyes | Mouth | Effect | Animation |
|---|---|---|---|---|
| sleeping | closed arcs | small "w" | floating "z Z" | slow breathing |
| working | dots | small "w" | tiny laptop with code lines | typing jiggle |
| needs | big shiny eyes | open "o" | red "!" bubble + meow | jumping |
| happy | "^ ^" | open smile | confetti | dance (rotate) |
| sweat | dots | wavy | sweat drop + "$" coin | shiver |
| sad | dots + tears | frown | "FAIL" tag | droop |
| hiss | angry brows | open with fangs | lightning bolt | shake |

All animations are CSS keyframes with `transform-origin: bottom center`. Respect
`prefers-reduced-motion` (swap animations for simple opacity pulses).

---

## 7. Phases

### Phase 0 — Setup (day 1)
- Scaffold with `electron-vite` (React + TS), add ESLint, Prettier, Vitest
- Add `src/shared/events.ts`
- ✅ `npm run dev` opens a window; `npm test` runs

### Phase 1 — Overlay window + static pet (days 2–3)
- `BrowserWindow`: `transparent: true`, `frame: false`, `alwaysOnTop: true`
  (use the `'floating'` / `'screen-saver'` level so it stays above full-screen IDEs where possible),
  `skipTaskbar: true`, `resizable: false`, `hasShadow: false`, ~220×220
- Position bottom-right of the primary display's work area; remember position after drag
- Click-through everywhere except the pet: `setIgnoreMouseEvents(true, { forward: true })`,
  renderer toggles interactivity on pet `mouseenter`/`mouseleave` via IPC
- Draggable pet (custom drag, since the window is frameless)
- Render Noodle (pixel art, section 6.1) in `sleeping`
- Tray icon with: Skin ▸, Mute, Quit
- ✅ Pet floats above other windows, clicks pass through the empty area, pet can be dragged

### Phase 2 — Event server + mood machine (days 4–5)
- `server.ts`: `POST /event` and `GET /health` on `127.0.0.1:7777`; reject non-local requests;
  validate body; if the port is taken, try 7778–7787 and write the chosen port to a
  config file that `agentpet-send` reads
- Forward valid events to renderer over IPC
- Implement `moodMachine.ts` + tests for every transition and priority rule
- Implement all 7 moods for Noodle, including the tail poses
- ✅ `curl -X POST 127.0.0.1:7777/event -d '{"type":"needs_you","agent":"claude-code","timestamp":0}'`
  makes Noodle hop with his tail shooting up like a red antenna

### Phase 3 — Claude Code hooks (days 6–8)
- Build `cli/agentpet-send.js` per section 5
- Build install/uninstall scripts + first-run "Connect Claude Code" screen
- **Needs-you alert:** play meow (unless muted), pet hops toward screen center,
  bubble shows the agent's message and project folder name
- **Click the pet** → try to focus the terminal/IDE (best effort, per OS) and return pet to its corner
- Hover bubble: `editing auth.service.ts · 12 tools · 4 min`
- Idle timer: back to `sleeping` after 2 min without events
- ✅ Real Claude Code session drives the pet end-to-end; killing the app never affects Claude Code

### Phase 4 — Launch v0.1 (days 9–10)
- Remaining skins: Mochi, Zitouna, Byte, Ribbit, Bolt (skin picker in tray, saved with `electron-store`)
- Risk detection → `hiss`
- Settings: mute, focus mode (pet hidden unless `needs`/`hiss`/`sad`), start on login
- `electron-builder` installers for Windows, macOS, Linux
- README with GIF at the top, install steps, privacy note ("everything stays local")
- ✅ Fresh machine: download installer → connect Claude Code → working in under 2 minutes

> **Launch here.** Record the 15-second video: you're scrolling something else, the
> agent asks for permission, Noodle's tail shoots up like a red antenna, you click it, back in the terminal.

### Phase 5 — Viral features (week 3)
- **Cost tracking → `sweat`**: estimate tokens/cost per session where the agent exposes it
  (e.g. from transcript/usage data); thresholds $1 / $5 / $20 (faints at $20)
- **Test results → `sad` / flex**: detect test commands in `PreToolUse`/`PostToolUse`
  (`npm test`, `pytest`, `mvn test`, `vitest`…) and read exit status
- **Daily recap card**: export a shareable PNG — "Today your agent edited 84 files,
  you approved 47 times, Noodle's tail went flat twice"
- **Evolution**: XP from sessions, kitten → cat → chonky senior cat (visual size/accessory changes)
- **Codex CLI support** via its notify hook mechanism (verify current docs)
- **Multi-session**: one pet per active session, small name tag with project folder

### Phase 6 — Power features (week 4+)
- **Phone ping**: if the pet is in `needs` for more than 2 min, send a push via
  ntfy.sh or a Telegram bot (user enters their own topic/token in settings; opt-in)
- **Waiting timer**: "waiting for you 6 min" in the bubble, pet gets sadder over time
- **Session timeline**: click → small panel listing tools/files/time for the session
- **Cursor / other agents**: use their hooks if available; otherwise fallback detection
  via process watching + `chokidar` file activity in the project folder
- **Community skins**: load skins from a JSON + SVG folder

### Monetization (later)
- Free and open source core
- Pro (one-time ~$5): premium skins, phone ping, session history, recap themes
- Team mode: see teammates' pets / agent status

---

## 8. Security and privacy checklist
- Server binds to `127.0.0.1` only; reject requests whose remote address isn't loopback
- Validate and size-limit request bodies (e.g. 64 KB max)
- Never log or store full prompts or file contents; keep only short display strings
- Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, minimal preload API
- Hooks installer always backs up the user's settings and only touches its own entries
- No telemetry by default

---

## 9. Definition of done for v0.1
- [ ] Pet floats above windows, click-through outside the pet, draggable
- [ ] Noodle (pixel mascot) with all 7 tail moods, plus 5 vector skins
- [ ] Claude Code hooks installed with one click, with backup and clean uninstall
- [ ] Needs-you alert with sound, bubble message, click-to-focus
- [ ] Hook script never blocks or breaks the agent (tested with app closed)
- [ ] Installers for Windows / macOS / Linux
- [ ] README with GIF, privacy note, and uninstall instructions
- [ ] Mood machine unit tests passing

---

## 10. Instructions for Claude Code
- Build phase by phase; after each phase, run the app and the tests, then summarize what works
- Check current docs for Electron window APIs and Claude Code hooks before implementing those parts
- Keep `agentpet-send` dependency-free and always exit 0
- Prefer small, readable files over clever abstractions
- Ask before adding any dependency not listed in section 2
