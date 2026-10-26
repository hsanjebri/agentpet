# AgentPet

A desktop pet (Noodle, a white pixel-art cat) that babysits your AI coding agent (Claude Code).
It floats above all windows, shows the agent's state with its mood/tail, lets you **approve
permission requests from its bubble**, shows session usage, pings your phone, and vibes to music.
`AGENTPET_PLAN.md` is the original build plan (status note at its top); `README.md` is user-facing.
Repo: github.com/hsanjebri/agentpet (**private** for now). Current version: **0.4.0**.

## Stack
Electron 44 + electron-vite, React 19 + TypeScript, Zustand, electron-store, electron-updater,
Vitest, ESLint + Prettier, electron-builder. Hook CLI: plain Node (zero deps). Music helper: C# (.NET 8).

## Layout
- `src/main/` (Electron main)
  - `index.ts` entry (order matters: register modules before `createPetWindow()`); `--disconnect-claude` mode for the uninstaller
  - `window.ts` transparent click-through overlay, drag, alert hop, walking
  - `server.ts` local HTTP server 127.0.0.1:7777 (fallback 7777–7787, port in `~/.agentpet/server.json`)
  - `bridge.ts` server ↔ pet window: events, permissions, risk, progress, phone, click-to-focus
  - `permissions.ts` pending Approve/Deny queue · `risk.ts` hiss rules · `sessions.ts` hover info
  - `progress.ts` stats/XP/unlocks store · `music.ts` runs nowplaying helper · `phone.ts` + `phonePing.ts` ntfy pings
  - `wander.ts` idle strolls · `focus.ts` bring terminal/IDE to front · `updater.ts` auto-update
  - `connect.ts` Claude Code connect/disconnect · `pages.ts` small windows (connect/profile/phone) · `tray.ts` · `settings.ts`
- `src/preload/index.ts` the only renderer API (`window.api`, typed by `PetApi` in `src/shared/ipc.ts`)
- `src/shared/` types + pure logic shared by both sides: `events.ts` (protocol), `ipc.ts` (channels), `progress.ts`, `music.ts`, `skins.ts`
- `src/renderer/src/` (pet window, React)
  - `App.tsx` decides what shows (mood, bubbles, music, focus mode) · `store.ts` Zustand state + IPC wiring
  - `moodMachine.ts` pure mood logic · `usePetPointer.ts` hover/click/drag/hold-to-pet
  - Bubbles: `ApprovalBubble.tsx`, `MusicBubble.tsx`, `InfoBubble.tsx` · `UsageBar.tsx` · `sounds.ts` (Web Audio synth)
  - Pages by URL hash: `Welcome.tsx` (#welcome, first-run wizard: cat, name, Claude Code, extras; tray › Run setup again), `Connect.tsx` (#connect, `ConnectPanel` reused by Welcome; shows connected / needs fixing / heard from agent), `Profile.tsx` + `RecapCard.tsx` (#profile), `Phone.tsx` (#phone); dev only: `Gallery.tsx` (#gallery, #gallery-extras, #gallery-cards), `Showcase.tsx` (#showcase)
  - `pets/pixel/` generic pixel toolkit (`canvas.ts`, `PixelSprite.tsx`) · `pets/noodle/` the cat (body.ts face+accessories, tail.ts, effects.ts, layers.ts, palette.ts skins, noodle.css)
- Hooks = `curl` (exec form) POSTing Claude Code's raw JSON to `/hook` with `X-AgentPet-Hook: event|permission|statusline`;
  `~/.agentpet/agentpet-send.curl` (url + bearer token, rewritten each start) · `hookInput.ts` translates · `peerPid.ts` finds the agent PID for click-to-focus
- `scripts/claude-hooks.mjs` (pure merge/remove of our entries), `claude-settings.mjs` (file I/O + backups), `install-hooks.mjs` / `uninstall-hooks.mjs`, `icons/` (icon generator)
- `helper/nowplaying/` C# helper: Windows media session → JSON lines on stdout, `toggle/next/prev` on stdin
- `build/installer.nsh` NSIS uninstall step · `electron-builder.yml` · `site/` landing page · `.github/workflows/` release (3 OS) + pages
- `tests/` Vitest (178 tests)

## How moods work
- Agent events (from hooks → server → bridge → renderer) feed `moodMachine.ts`: base `sleeping|working`,
  short-lived `happy|sad|hiss|sweat` (timeouts), and a `needs` flag that wins until the user responds.
- Priority: needs > hiss > sad > happy > sweat > working > sleeping (`PRIORITY` in moodMachine.ts).
- Overlays decided in `App.tsx`, below every agent mood: **music** (vibing when idle, headphones while
  working) > **wandering** (main/wander.ts, paused while music plays) > sleeping.
- Rare moments, accessories, growth stage come from `src/shared/progress.ts` (look) and are drawn by `pets/noodle/`.

## Features (version)
- v0.1.0: overlay pet, 7 tail moods, Claude Code hooks, Approve/Deny bubble, usage bar, click-to-focus,
  meow/hop alert, hover info, risk hiss, focus mode, start on login, skins (Noodle/Mochi/Zitouna), installers
- v0.2.x: recap card + weekly Wrapped (save/copy/share on X), evolution (kitten→cat→senior), accessories
  (top hat/sunglasses/crown), rare moments, hold-to-pet + purr, fish feeding, wandering, time greetings, naming
- v0.3.0: **Music** (Windows): nowplaying helper, headphones/vibing, pixel ⏮⏯⏭ in bubble, songs in recaps
- v0.4.0: **Phone ping** via ntfy (opt-in): ping after N min waiting, optional long-task-done ping
- unreleased (on main): uninstaller disconnects Claude, auto-update, landing page, version-free asset names

## Commands
- `npm run dev` · `AGENTPET_DEMO=1 npm run dev` (mood demo) · `npm test` · `npm run lint` · `npm run typecheck`
- `npm run helper:build` (needs .NET 8 SDK; output `helper/nowplaying/dist/nowplaying.exe`, stop the app first: it locks the exe)
- `npm run build:win` (helper + app + NSIS → `dist/AgentPet-Setup.exe`) · `build:mac` / `build:linux` (CI)
- `npm run hooks:preview|hooks:install|hooks:uninstall` (dev checkout ↔ `~/.claude/settings.json`)
- `npm run icons` (regenerate icons from Noodle's pixels)
- Release: bump `package.json` version, push, `gh release create vX.Y.Z` → workflow builds and attaches installers

## Conventions
- Pixel-art everything: text sprites with one char per palette key (`pets/noodle/palette.ts`, `W` = always white),
  auto outline, `crispEdges`/`image-rendering: pixelated`, `steps()` animations, 4 px per cell. All skins = palette swaps.
- Bubbles reuse the `.bubble` / `.btn` styles (thick ink border, hard shadow); controls get `data-ui`
  (clickable, not draggable); only `data-pet-hit` and `data-ui` catch the mouse, everything else is click-through.
- Pure logic in testable modules (`shared/*`, `moodMachine.ts`, `phonePing.ts`, `risk.ts`); Electron glue stays thin.
- Hooks: curl only (no Node needed), quiet on failure (`silent`+`fail`), print only a permission decision or the status line. On start the app upgrades older installs (`upgrade()` in claude-settings.mjs).
- Privacy: everything local (server on 127.0.0.1, rejects requests with an Origin header). Only Phone ping
  sends data out, opt-in, project name only by default. No song history (daily count only). No telemetry.
- Always back up `~/.claude/settings.json` before changing it; only touch entries containing `agentpet-send`.
- Ask before adding dependencies. Commit only when asked; commit messages end with the Co-Authored-By line.

## Known issues / TODO next
- Pre-launch (built, need the repo **public**): auto-update untested end-to-end; landing page not deployed
  (GitHub Pages workflow skips private repos). Then publish v0.4.1 and test an update v0.4.1 → test release.
- Clean-PC test was done on the dev PC (Windows Sandbox not enabled); a truly fresh machine is still untested.
- TODO: auto-hide during meetings / screen sharing (not built).
- Music: two Chrome tabs both playing look like one app to Windows (controls may hit the wrong tab);
  `prev` on Spotify not verified; "no music app" case only unit-tested. Helper is 93 MB self-contained (trimming untested).
- macOS: unsigned → no auto-update, Gatekeeper warning; Music is Windows-only. Installers not code-signed (SmartScreen).
- Byte / Ribbit / Bolt skins not drawn; "sit on windows" / "chase cursor" not built.
- Ideas queued: waiting timer (sadder the longer Claude waits), one cat per session, session timeline, test results, Codex/Cursor support.
