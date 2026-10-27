// Renders one key frame per scene (half size) into out/storyboard/ for review.
import { execFileSync } from 'node:child_process'

const FPS = 60
const SHOTS = [
  ['1-morning', 3.4],
  ['2-focus', 8.6],
  ['3-music', 14.2],
  ['4-dev', 23.5],
  ['5-night', 32.0],
  ['6-cats', 37.8],
  ['7-logo', 43.6]
]
const VERTICAL = ['2-focus', '4-dev', '7-logo']

for (const [name, at] of SHOTS) {
  for (const [comp, suffix] of [['BrandFilm', ''], ...(VERTICAL.includes(name) ? [['BrandFilmVertical', '-9x16']] : [])]) {
    execFileSync(
      'npx',
      ['remotion', 'still', 'src/index.ts', comp, `out/storyboard/${name}${suffix}.png`, `--frame=${Math.round(at * FPS)}`, '--scale=0.5'],
      { stdio: 'inherit', shell: true }
    )
  }
}
