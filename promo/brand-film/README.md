# A Day with Noodle (launch film)

Remotion project for Noodle's brand film. Separate from the app: its own `package.json`, nothing
here ships in the installers. The pixel cat is the app's own sprite code
(`src/renderer/src/pets/noodle`), drawn frame by frame from the timeline.

## Setup

```bash
cd promo/brand-film
npm install
```

## Edit

- **Text, colors, URL, BPM, scene timings, audio files:** `src/config.ts` (one place).
- Scenes: `src/scenes/scenes.tsx` · vector UI pieces: `src/ui.tsx` · the cat: `src/Noodle.tsx`.
- Live preview with a timeline: `npm run studio`.

## Render

| What | Command | Output |
| --- | --- | --- |
| Full film, 16:9 (1920×1080, 45 s, 60 fps) | `npm run render` | `out/noodle-16x9.mp4` |
| Full film, 9:16 (1080×1920) | `npm run render:vertical` | `out/noodle-9x16.mp4` |
| 15 s cut, 16:9 | `npm run render:15` | `out/noodle-15s-16x9.mp4` |
| 15 s cut, 9:16 | `npm run render:15:vertical` | `out/noodle-15s-9x16.mp4` |
| Quick low-res preview | `npm run preview` | `out/preview.mp4` |
| Storyboard stills | `npm run storyboard` | `out/storyboard/*.png` |

Any composition at another size or quality: `npx remotion render src/index.ts <Id> <file> --scale=0.5`
(Ids: `BrandFilm`, `BrandFilmVertical`, `Cut15`, `Cut15Vertical`).

## Audio

Put files in `public/audio/` and name them in `config.ts` › `audio` (null = silent):

- `music`: upbeat, royalty-free, ~120 BPM so it lands on the beat grid
- sound effects: `meow`, `purr`, `pop`, `whoosh`, `toot`, `buzz`, `levelUp`

Cue times are listed in `src/Film.tsx` (`SFX` for the full film, the `Cut15` cues for the short one).
