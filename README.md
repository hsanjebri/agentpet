<p align="center"><img src="docs/icon.png" width="96" alt="AgentPet icon"></p>

# AgentPet

A desktop pet that babysits your AI coding agent. Noodle sleeps while Claude Code is idle,
works while it works, **hops and meows when it needs your approval** (approve right from his
bubble), and farts a rainbow when the task is done. 🌈

<p align="center"><img src="docs/demo.gif" width="380" alt="Noodle going through his moods"></p>

## What Noodle does

| Mood      | When                                                                         | Noodle                                        |
| --------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| sleeping  | agent idle                                                                   | lies down, tail wrapped around him            |
| working   | agent working                                                                | tail holds a coffee mug                       |
| **needs** | **waiting for your approval**                                                | meows, hops toward you, Approve / Deny bubble |
| happy     | task done                                                                    | tail draws a heart, rainbow fart              |
| sweat     | session usage passes 50 / 80 / 95 %                                          | holds a coin, sweats                          |
| sad       | the agent hit an error                                                       | lies flat, tears                              |
| hiss      | risky action: `.env`, `rm -rf`, `git push --force`, deleted tests, 25+ files | puffed tail, says why                         |

- **Approve / Deny from the pet**: no need to go back to the terminal for every permission.
- **Session usage bar** under Noodle: your 5-hour Claude limit (or context window), resets at…
- **Click Noodle** to jump to the terminal / IDE where Claude is running.
- **Hover** for what Claude is up to: `my-app · editing App.tsx · 12 tools · 4 min`.
- **Daily recap card + weekly "Wrapped"**: tray › _profile & recap_ → save, copy or share on X.
- **He grows up**: kitten → cat → chonky senior cat with glasses as you level up (10 tasks a level).
- **Unlock accessories**: top hat (100 tasks), sunglasses (7-day streak), crown (1,000 approvals).
- **Rare moments** (1 task in 50): golden rainbow, double fart, asleep on the keyboard.
- **Pet him**: click and hold, he purrs. **Feed him**: every finished task is a fish.
- **Wanders** along the bottom of the screen when idle; good morning / go-to-bed greetings;
  party hat on Fridays. **Name your cat** when you first start the app.
- **🎵 Music** (Windows): Noodle puts on headphones and vibes to Spotify, YouTube, Deezer…
  Hover him for pixel play / pause / next buttons.
- Skins: Noodle, Mochi (orange tabby), Zitouna (street cat). Tray menu › Skin.
- Tray menu: Mute, Wander, Focus mode (only shows up when needed), Start on login, Mood demo.

## Install

1. Download the installer for your system from
   [Releases](https://github.com/hsanjebri/agentpet/releases) (`AgentPet-0.3.0-setup.exe`,
   `.dmg` or `.AppImage`).
   The builds aren't code-signed yet, so Windows SmartScreen / macOS Gatekeeper will warn:
   choose "More info › Run anyway" (Windows) or right-click › Open (macOS).
2. Start AgentPet. A **Connect Claude Code** window opens: click **Connect**.
   It shows exactly what it adds to `~/.claude/settings.json` and backs the file up first.
3. Start a **new** Claude Code session. That's it.

Requires [Node.js](https://nodejs.org) on your PATH (the hooks are a tiny Node script).

## Privacy

Everything stays on your computer. The app only listens on `127.0.0.1`, refuses requests
from web pages, keeps nothing on disk except its settings, and has no telemetry.

## Uninstall

Tray menu › **Disconnect Claude Code** (removes only AgentPet's entries and restores your
previous status line), then uninstall the app as usual. Or from a clone:
`npm run hooks:uninstall`.

## Development

```bash
npm install
npm run dev               # start the app
npm test                  # unit tests
npm run lint && npm run typecheck
npm run build:win         # or build:mac / build:linux -> dist/
npm run icons             # redraw the icons from Noodle's pixels

npm run hooks:preview     # show what gets added to ~/.claude/settings.json
npm run hooks:install     # connect this checkout to Claude Code
npm run hooks:uninstall
```

While `npm run dev` runs, open the renderer URL (e.g. `http://localhost:5173`) with
`#gallery` to see every mood, or `#showcase` for the demo loop on a plain background.
`AGENTPET_DEMO=1 npm run dev` starts with the mood demo on.

See [`AGENTPET_PLAN.md`](AGENTPET_PLAN.md) for the full build plan.
