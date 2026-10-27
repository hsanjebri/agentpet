// The guest window: a friend's cat visiting your desktop. It plays next to your cat for a few
// minutes (happy, curious, a hop now and then), shows whose cat it is, and goes home on "Bye".
// Click-through except the bubble's button.
import type { Guest as GuestInfo } from '@shared/visits'
import { useEffect, useState } from 'react'
import type { Mood } from './moods'
import { Pet } from './pets/Pet'

/** What he does while visiting, a few seconds each. */
const PLAY: Mood[] = ['happy', 'working', 'needs', 'happy', 'sleeping', 'working']

export default function Guest(): React.JSX.Element {
  const [guest, setGuest] = useState<GuestInfo | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    window.api.getGuest().then(setGuest)
    const timer = setInterval(() => setStep((s) => s + 1), 3500)
    // only the Bye button catches the mouse
    const onMove = (e: MouseEvent): void =>
      window.api.guestInteractive(e.target instanceof Element && !!e.target.closest('[data-ui]'))
    window.addEventListener('mousemove', onMove)
    return () => {
      clearInterval(timer)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  if (!guest) return <main className="stage" />
  const stage = guest.level < 5 ? 'kitten' : guest.level < 20 ? 'cat' : 'senior'
  return (
    <main className="stage">
      <div className="bubble bubble-water guest-tag" data-ui="">
        {guest.name} is visiting 👋
        <div className="bubble-sub">lv {guest.level} · a friend&apos;s cat</div>
        <div className="bubble-actions">
          <button className="btn btn-terminal" data-ui="" onClick={() => window.api.guestBye()}>
            Bye 👋
          </button>
        </div>
      </div>
      <div className={`pet-spot guest-pet${step % 4 === 2 ? ' hop' : ''}`}>
        <Pet
          skin={guest.skin}
          mood={PLAY[step % PLAY.length]}
          facing="right"
          look={{
            petName: guest.name,
            level: guest.level,
            levelProgress: 0,
            stage,
            wearing: [],
            hungry: false,
            focusStreak: 0
          }}
          wiggle={step % 3 === 1 ? step : 0}
        />
      </div>
    </main>
  )
}
