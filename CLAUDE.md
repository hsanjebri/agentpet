# AgentPet

A desktop pet (Noodle, a white pixel-art cat) that babysits your AI coding agent (Claude Code).
It floats above all windows, shows the agent's state with its mood/tail, lets you **approve
permission requests from its bubble**, shows session usage, pings your phone, and vibes to music.
Two modes: **developer** (follows Claude Code) and **Fun & focus** (no Claude anywhere: music, Pomodoro, company).
`AGENTPET_PLAN.md` is the original build plan (status note at its top); `README.md` is user-facing.
Repo: github.com/hsanjebri/agentpet (**private** for now). Current version: **0.6.0**.

## Stack
Electron 44 + electron-vite, React 19 + TypeScript, Zustand, electron-store, electron-updater,
Vitest, ESLint + Prettier, electron-builder, qrcode-generator, @supabase/supabase-js (Friends only, lazy-loaded).
Hooks: curl. Music helper: C# (.NET 8). Auto-hide watcher: inline PowerShell.

## Layout
- `src/main/` (Electron main)
  - `index.ts` entry (order matters: register modules before `createPetWindow()`); `--disconnect-claude` mode for the uninstaller
  - `window.ts` transparent click-through overlay, drag, alert hop, walking
  - `server.ts` local HTTP server 127.0.0.1:7777 (fallback 7777–7787, port in `~/.agentpet/server.json`)
  - `bridge.ts` server ↔ pet window: events, permissions, risk, progress, phone, click-to-focus
  - `permissions.ts` pending Approve/Deny queue · `risk.ts` hiss rules · `sessions.ts` hover info
  - `progress.ts` stats/XP/unlocks store · `music.ts` runs nowplaying helper · `phone.ts` + `phonePing.ts` ntfy pings
  - `wander.ts` idle strolls · `focus.ts` bring terminal/IDE to front · `updater.ts` auto-update
  - `connect.ts` Claude Code connect/disconnect + Welcome · `pages.ts` small windows (welcome/settings/connect/profile) · `tray.ts` (tray + pet right-click menu)
  - `settings.ts` the one settings store: `updateSettings()` validates, saves, broadcasts; modules react via `onSettingsChange()`
  - `actions.ts` Settings buttons (restore backup, check updates, resets…) · `pomodoro.ts` timer owner · `autoHide.ts` OS watcher (Windows)
  - `daily.ts` water / stretch / bedtime / weather (Open-Meteo) / prayer + Ramadan → `DailyState` · `prayerTimes.ts` (adhan, offline)
  - `guard.ts` distraction guard (Windows, focus rounds only) · `laser.ts` Ctrl+Alt+L red dot · `notes.ts` sticky notes
  - `friends.ts` + `friendsService.ts` Friends over Supabase (only loaded when on) · `config/supabase.json` URL + anon key · `supabase/` SQL + setup guide
- `src/preload/index.ts` the only renderer API (`window.api`, typed by `PetApi` in `src/shared/ipc.ts`)
- `src/shared/` types + pure logic shared by both sides: `events.ts` (protocol), `ipc.ts` (channels), `settings.ts` (model, defaults, validation, migration), `progress.ts`, `pomodoro.ts`, `autoHide.ts`, `friends.ts`, `weather.ts`, `guard.ts`, `habits.ts`, `music.ts`, `skins.ts`
- `src/renderer/src/` (pet window, React)
  - `App.tsx` decides what shows (mood, bubbles, music, focus mode) · `store.ts` Zustand state + IPC wiring
  - `moodMachine.ts` pure mood logic · `usePetPointer.ts` hover/click/drag/hold-to-pet
  - Bubbles: `ApprovalBubble.tsx`, `MusicBubble.tsx`, `InfoBubble.tsx` · `UsageBar.tsx` · `sounds.ts` (Web Audio synth)
  - `settings/` the Settings window (#settings or #settings:<section>): sidebar + one file per section, `controls.tsx` shared rows/toggles
  - Pages by URL hash: `Welcome.tsx` (#welcome, first-run wizard: cat, name, mode, [Claude Code], features; Settings › General › Replay), `Connect.tsx` (#connect, `ConnectPanel` reused by Welcome; shows connected / needs fixing / heard from agent), `Profile.tsx` + `RecapCard.tsx` (#profile), `Phone.tsx` (#phone); dev only: `Gallery.tsx` (#gallery, #gallery-extras, #gallery-cards), `Showcase.tsx` (#showcase)
  - `pets/pixel/` generic pixel toolkit (`canvas.ts`, `PixelSprite.tsx`) · `pets/noodle/` the cat (body.ts face+accessories, tail.ts, effects.ts, layers.ts, palette.ts skins, noodle.css)
- Hooks = `curl` (exec form) POSTing Claude Code's raw JSON to `/hook` with `X-AgentPet-Hook: event|permission|statusline`;
  `~/.agentpet/agentpet-send.curl` (url + bearer token, rewritten each start) · `hookInput.ts` translates · `peerPid.ts` finds the agent PID for click-to-focus
- `scripts/claude-hooks.mjs` (pure merge/remove of our entries), `claude-settings.mjs` (file I/O + backups), `install-hooks.mjs` / `uninstall-hooks.mjs`, `icons/` (icon generator)
- `helper/nowplaying/` C# helper: Windows media session → JSON lines on stdout, `toggle/next/prev` on stdin
- `build/installer.nsh` NSIS uninstall step · `electron-builder.yml` · `site/` landing page · `.github/workflows/` release (3 OS) + pages
- `tests/` Vitest (220 tests + 2 live Friends tests)

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
- v0.4.1: curl hooks (no Node.js needed), first-run Welcome window, uninstaller disconnects Claude, auto-update, landing page
- v0.5.0: **Settings window** (every feature on/off, instant), developer / **Fun & focus** modes, **Pomodoro**,
  **auto-hide** (Windows), per-type risk warnings + allow-list, size S/M/L, sound volume, **Friends** (Supabase, opt-in)
- v0.6.0: **distraction guard**, **drink water**, **stretch with me**, **bedtime mode**, **weather outfits** (opt-in),
  **prayer times + Ramadan** (opt-in, offline), **laser game**, study streak scarf, exam countdown sign, sticky notes
- Dropped for now (decided): ambient sounds, toss a fish, birthday/holiday outfits, photo mode, second pet

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
  (project name), Friends (pet name, skin, level, online) and weather (city coordinates → Open-Meteo, plus the typed
  city search) send data out, all opt-in. Window titles (distraction guard) never leave the PC. No telemetry.
- Fun & focus mode: never show Claude / terminal / hooks / code wording (bridge ignores agent events in that mode).
- Always back up `~/.claude/settings.json` before changing it; only touch entries containing `agentpet-send`.
- Ask before adding dependencies. Commit only when asked; commit messages end with the Co-Authored-By line.

## Known issues / TODO next
- Pre-launch (built, need the repo **public**): auto-update untested end-to-end; landing page not deployed
  (GitHub Pages workflow skips private repos). Then publish v0.4.1 and test an update v0.4.1 → test release.
- Clean-PC test was done on the dev PC (Windows Sandbox not enabled); a truly fresh machine is still untested.
- Friends: live project bksantonbevmojtdcxrq; `AGENTPET_LIVE=1 npx vitest run tests/friends.live.test.ts` runs the full flow (2 anon users). Two-machine test pending.
- Auto-hide: Windows only; DND detection reads the notification toggle (best effort); meetings = microphone in use.
- Music: two Chrome tabs both playing look like one app to Windows (controls may hit the wrong tab);
  `prev` on Spotify not verified; "no music app" case only unit-tested. Helper is 93 MB self-contained (trimming untested).
- macOS: unsigned → no auto-update, Gatekeeper warning; Music is Windows-only. Installers not code-signed (SmartScreen).
- Byte / Ribbit / Bolt skins not drawn; "sit on windows" / "chase cursor" not built.
- Ideas queued: waiting timer (sadder the longer Claude waits), one cat per session, session timeline, test results, Codex/Cursor support.
