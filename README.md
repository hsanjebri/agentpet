# AgentPet

A desktop pet that babysits your AI coding agent. It sleeps when the agent is idle, works
while it works, **jumps when the agent needs your approval**, and farts a rainbow when the
task is done. 🌈

> Work in progress. See [`AGENTPET_PLAN.md`](AGENTPET_PLAN.md) for the full build plan.

## Status

- ✅ Phase 0: project setup (Electron + React + TypeScript, Vitest, ESLint, Prettier)
- ✅ Phase 1: transparent always-on-top window, click-through, drag, tray menu
- ✅ Noodle the pixel cat with 7 moods (the tail shows what the agent is doing)
- ⏳ Phase 2: local event server + mood state machine
- ⏳ Phase 3: Claude Code hooks

## Moods

| Mood     | When                             | Noodle                                  |
| -------- | -------------------------------- | --------------------------------------- |
| sleeping | agent idle                       | lies down, tail wrapped around him      |
| working  | agent working                    | tail holds a coffee mug                 |
| needs    | waiting for your approval        | hops, tail shoots up like a red antenna |
| happy    | task done                        | tail draws a heart, rainbow fart        |
| sweat    | session getting expensive        | holds a coin, sweats                    |
| sad      | tests failed                     | lies flat, tears                        |
| hiss     | risky action (`.env`, `rm -rf`…) | puffed tail, bristling back             |

Tray menu › **Mood demo** plays them all in a loop.

## Development

```bash
npm install
npm run dev        # start the app
npm test           # unit tests
npm run lint
npm run typecheck
```

While `npm run dev` is running, open the renderer URL with `#gallery` (for example
`http://localhost:5173/#gallery`) to see every mood side by side.

Start with the mood demo already running: `AGENTPET_DEMO=1 npm run dev`.

## Privacy

Everything stays local: the event server only listens on `127.0.0.1`, and there is no telemetry.
