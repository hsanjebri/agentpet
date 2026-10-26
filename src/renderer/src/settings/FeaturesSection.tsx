// Settings › Features: every feature on or off, each with one line on what it does.
import type { PetSettings } from '@shared/ipc'
import type { SoundName } from '@shared/settings'
import { Group, Row, Section, Toggle } from './controls'
import { PomodoroGroup } from './PomodoroGroup'

const SOUNDS: Array<[SoundName, string, string]> = [
  ['meow', '😺 Meow', 'when he needs you'],
  ['toot', '🌈 Toot', 'the rainbow fart'],
  ['purr', '💤 Purr', 'while you pet him'],
  ['tick', '⏱️ Ticking', 'softly during a Pomodoro']
]

export function FeaturesSection({ settings: s }: { settings: PetSettings }): React.JSX.Element {
  const change = window.api.changeSettings
  const dev = s.mode === 'developer'
  const soon = (supported: boolean): string | undefined =>
    supported ? undefined : 'Windows only for now: coming soon here.'

  return (
    <Section title="✨ Features" intro="Everything applies right away.">
      <Toggle
        label="🎵 Vibe to my music"
        description={
          soon(s.musicSupported) ??
          'Headphones on when Spotify, YouTube, Deezer… play. Read on this PC only.'
        }
        checked={s.music}
        disabled={!s.musicSupported}
        onChange={(music) => change({ music })}
      />
      <Toggle
        label="🚶 Wander when idle"
        description="Strolls along the bottom of the screen now and then."
        checked={s.wander}
        onChange={(wander) => change({ wander })}
      />
      <Toggle
        label="🍽️ Feeding & hunger"
        description={
          dev
            ? 'A fish for every finished task or Pomodoro; a bit hungry after 3 days without.'
            : 'A fish for every Pomodoro; a bit hungry after 3 days without.'
        }
        checked={s.feeding}
        onChange={(feeding) => change({ feeding })}
      />
      <Toggle
        label="🌟 Rare moments"
        description="1 time in 50: golden rainbow, double fart, asleep on the keyboard."
        checked={s.rareMoments}
        onChange={(rareMoments) => change({ rareMoments })}
      />
      <Toggle
        label="👋 Greetings"
        description="Good morning ☕ once a day, and “go to bed” late at night."
        checked={s.greetings}
        onChange={(greetings) => change({ greetings })}
      />
      <Toggle
        label="🎯 Focus mode"
        description="Only shows up when he needs you (or is vibing)."
        checked={s.focusMode}
        onChange={(focusMode) => change({ focusMode })}
      />

      <PomodoroGroup settings={s} />

      <Group title="🔊 Sounds">
        <Toggle
          label="Sounds on"
          description="Off = completely silent (same as Mute in the tray)."
          checked={!s.muted}
          onChange={(on) => change({ muted: !on })}
        />
        <Row label="Volume">
          <input
            type="range"
            min={0}
            max={100}
            disabled={s.muted}
            value={Math.round(s.sounds.volume * 100)}
            onChange={(e) => change({ sounds: { volume: Number(e.target.value) / 100 } })}
          />
        </Row>
        {SOUNDS.map(([name, label, description]) => (
          <Toggle
            key={name}
            label={label}
            description={description}
            checked={s.sounds[name]}
            disabled={s.muted}
            onChange={(on) => change({ sounds: { [name]: on } })}
          />
        ))}
      </Group>

      <Group title="🙈 Auto-hide">
        {!s.autoHideSupported && <p className="connect-small">{soon(false)}</p>}
        <Toggle
          label="Fullscreen apps"
          description="Videos, games, slides."
          checked={s.autoHide.fullscreen}
          disabled={!s.autoHideSupported}
          onChange={(on) => change({ autoHide: { fullscreen: on } })}
        />
        <Toggle
          label="Meetings & screen share"
          description="While your microphone is in use."
          checked={s.autoHide.meetings}
          disabled={!s.autoHideSupported}
          onChange={(on) => change({ autoHide: { meetings: on } })}
        />
        <Toggle
          label="Do not disturb"
          description="While Windows' Do not disturb / Focus assist is on."
          checked={s.autoHide.dnd}
          disabled={!s.autoHideSupported}
          onChange={(on) => change({ autoHide: { dnd: on } })}
        />
      </Group>
    </Section>
  )
}
