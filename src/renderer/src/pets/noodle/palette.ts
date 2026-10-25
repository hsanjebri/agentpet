// One character per color, used by the text sprites in body.ts / tail.ts / effects.ts.
export const PALETTE: Readonly<Record<string, string>> = {
  k: '#1F1C1A', // outline, mouth
  w: '#FFFFFF', // white fur (changes per skin)
  W: '#FFFFFF', // always white: eye shine, fangs, cloud
  d: '#43403D', // black fur patches, tail tip
  g: '#D9D5CF', // far-side legs (in shadow)
  s: '#BDB8B1', // soft shading lines (jaw, belly), steam
  e: '#2A221E', // eyes
  p: '#F4A0AE', // nose, inner ears, tongue
  b: '#5AA9E6', // sweat, tears
  r: '#E24B4A', // alert red, rainbow red
  o: '#F28C28', // rainbow orange
  y: '#F6C744', // rainbow yellow, coin, sparkles
  Y: '#C98A12', // coin detail
  G: '#5CC46B', // rainbow green
  B: '#4A9FE0', // rainbow blue
  P: '#8B6FD8', // rainbow purple
  m: '#8A5A3B', // coffee mug
  c: '#4A2E1E', // coffee
  v: '#7F77DD' // sleep "Z"
}

/** Other cats drawn with the same pixels: only the fur colors change. */
export type CatSkin = 'noodle' | 'mochi' | 'zitouna'

export const CAT_PALETTES: Readonly<Record<CatSkin, Readonly<Record<string, string>>>> = {
  noodle: PALETTE,
  // orange tabby
  mochi: { ...PALETTE, w: '#F2A65A', d: '#B8682A', g: '#D38A45', s: '#C47A36', p: '#F7C0C5' },
  // Tunisian street cat: gray, with a white patch over the eye
  zitouna: { ...PALETTE, w: '#A8A49C', d: '#F4F2EC', g: '#8C8880', s: '#7E7A73' }
}
