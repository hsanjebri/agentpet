// Transparent stills of the cat (and his tomato) for the website, from the same sprite code.
import { AbsoluteFill } from 'remotion'
import { Noodle, type CatSkin, type Mood, type Wearable } from './Noodle'
import { Tomato } from './ui'

export interface CatArtProps {
  mood: Mood
  skin?: CatSkin
  wear?: Wearable[]
  vibe?: 'groove' | 'still'
  at?: number
}

export function CatArt({ mood, skin, wear, vibe, at = 0.2 }: CatArtProps) {
  return (
    <AbsoluteFill>
      <Noodle mood={mood} skin={skin} wear={wear} vibe={vibe} at={at} scale={8} />
    </AbsoluteFill>
  )
}

export function TomatoArt() {
  return (
    <AbsoluteFill>
      <Tomato scale={8} />
    </AbsoluteFill>
  )
}
