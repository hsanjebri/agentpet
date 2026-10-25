# AgentPet — Build Plan

> A desktop pet that babysits your AI coding agent. It sleeps when the agent is idle,
> types while it works, **jumps and meows when the agent needs your approval**, and
> dances when the task is done.

> **Status (Oct 2026):** Phases 0–4 are built (v0.1.0). Changes from the original plan, made
> while building: Noodle became a white Beluga-inspired cat on 4 legs (section 6); vector skins
> were dropped for pixel recolors; the agent's permission prompts can be **approved from the
> pet** (`PermissionRequest` hook) and a **session usage bar** reads Claude Code's status line;
> the hook script is `cli/agentpet-send.mjs` and the install scripts are plain `.mjs`; renderer
> code lives in `src/renderer/src/` (electron-vite layout); events gained `tool_done` and `pid`.

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

**Noodle** is AgentPet's mascot and default pet: a chubby **white cat with black patches**
(one over the back ear and eye, one on his back), small shiny eyes and a wide calm smile, in
light pixel art. He stands **on 4 legs** (side view, face turned to the viewer) and lies down
like a loaf to sleep or sulk. His **long tail is the status display**, and he **farts a
rainbow** when a task is done.

**Concept line for the README:** "Noodle's tail tells you what your agent is doing."

#### Pixel spec
- Grid: **88 × 46 cells**, plus a 1-cell border for outlines; rendered at **4 px per cell**
  (360 × 192). He faces **right**, so his head sits near the screen corner and the tail and
  rainbow extend toward the middle of the screen
- Always rendered with `shape-rendering: crispEdges`; motion uses `steps()` keyframes
- 1-cell dark outline computed automatically (any empty cell touching a filled cell)
- Layers, back to front: rainbow (happy only) → tail → body → tail in front (sleeping only),
  plus an effects layer on top
- Tail animation re-rasterizes the tail polyline rotated around its base, so it stays crisp
- Code: `src/renderer/src/pets/pixel/` (generic toolkit: canvas, outline, renderer) and
  `src/renderer/src/pets/noodle/` (body + face, tail, effects, palette)

#### Palette (one character per color in the text sprites)
| Key | Use | Hex |
|---|---|---|
| `k` | outline, mouth | `#1F1C1A` |
| `w` | fur (changes per skin) | `#FFFFFF` |
| `W` | always white: eye shine, fangs, cloud | `#FFFFFF` |
| `d` | patches, tail tip | `#43403D` |
| `g` | far-side legs (in shadow) | `#D9D5CF` |
| `s` | soft shading lines (jaw, belly), steam | `#BDB8B1` |
| `e` | eyes | `#2A221E` |
| `p` | nose, inner ears, tongue | `#F4A0AE` |
| `r o y G B P` | rainbow (`r` also alerts, `y` coin + sparkles) | |
| `b` `m` `c` `v` `Y` | sweat/tears, mug, coffee, sleep Z, coin detail | |

#### Moods — the tail is the star
| Mood | Pose | Tail | Face | Extras | Motion |
|---|---|---|---|---|---|
| sleeping | lying (loaf) | wrapped around the front like a blanket | closed eyes, small smile | z Z | slow breathing |
| working | standing | raised, tip holds a coffee mug | the classic: small shiny eyes, wide smile | steam | tail sways |
| needs | standing | straight up like an antenna, red tip | big shiny eyes, "o" mouth | red "!" | hops, tail vibrates |
| happy | standing | draws a heart | "^ ^", open smile | **rainbow fart** + cloud, sparkles | bounces, tail wiggles |
| sweat | standing | fans himself, tip holds a coin | worried brows, wavy mouth | sweat drop | shivers |
| sad | lying | flat on the floor | worried brows, tears, frown | — | droops |
| hiss | standing, fur up along the back | puffed bottle brush | angry brows, fangs | lightning | shakes |

### 6.2 Skins
Recolors of Noodle's pixels (same shapes, every mood):

| Skin | Description | Fur / patches |
|---|---|---|
| **Noodle** (default) | white cat, black patches | `#FFFFFF` / `#43403D` |
| **Mochi** | orange tabby | `#F2A65A` / `#B8682A` |
| **Zitouna** | gray Tunisian street cat, white eye patch | `#A8A49C` / `#F4F2EC` |

Still to draw in the same pixel style (need their own shapes): **Byte** (dog with floppy ears),
**Ribbit** (frog), **Bolt** (robot).

### 6.3 Around the pet
- **Approval bubble** (permission requests): what the agent wants to run, with Approve / Deny /
  answer-in-terminal buttons
- **Usage bar** under the pet: the 5-hour session limit (or context window), green → yellow → red
- **Hover bubble**: `project · last action · N tools · M min`
- **Warning bubble** while hissing: why (`touching .env`, `rm -rf`…)
- Sounds are synthesized (Web Audio): a meow for needs-you, a little "toot" for the rainbow

All motion respects `prefers-reduced-motion` (animations become gentle opacity pulses).

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
- [x] Pet floats above windows, click-through outside the pet, draggable
- [x] Noodle (pixel mascot) with all 7 tail moods, plus skins (Mochi, Zitouna; Byte, Ribbit, Bolt still to draw)
- [x] Claude Code hooks installed with one click, with backup and clean uninstall
- [x] Needs-you alert with sound, bubble message, click-to-focus
- [x] Hook script never blocks or breaks the agent (tested with app closed)
- [x] Installers for Windows / macOS / Linux (built by `.github/workflows/release.yml`)
- [x] README with GIF, privacy note, and uninstall instructions
- [x] Mood machine unit tests passing

---

## 10. Instructions for Claude Code
- Build phase by phase; after each phase, run the app and the tests, then summarize what works
- Check current docs for Electron window APIs and Claude Code hooks before implementing those parts
- Keep `agentpet-send` dependency-free and always exit 0
- Prefer small, readable files over clever abstractions
- Ask before adding any dependency not listed in section 2
