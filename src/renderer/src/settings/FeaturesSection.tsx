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

      <Group title="🛡️ Distraction guard">
        <Toggle
          label="Sit on distracting windows"
          description={
            s.autoHideSupported
              ? 'During a Pomodoro focus round, if one of these is in front, he walks over and sits on it. Click him to shoo him away. Titles are only checked on this PC.'
              : 'Windows only for now: coming soon here.'
          }
          checked={s.guard.enabled}
          disabled={!s.autoHideSupported}
          onChange={(enabled) => change({ guard: { enabled } })}
        />
        <label className="settings-textarea">
          <span className="connect-small">
            Sites and apps (one per line, matched in the window title):
          </span>
          <textarea
            rows={3}
            defaultValue={s.guard.sites.join('\n')}
            spellCheck={false}
            disabled={!s.guard.enabled}
            onBlur={(e) => change({ guard: { sites: e.target.value.split('\n') } })}
          />
        </label>
      </Group>

      <Group title="💧 Healthy habits">
        <Toggle
          label="Drink water"
          description="Now and then he pushes a glass of water toward you. Tap “I drank” and he's happy."
          checked={s.water.enabled}
          onChange={(enabled) => change({ water: { enabled } })}
        />
        <Row label="Every">
          <select
            value={s.water.everyMin}
            disabled={!s.water.enabled}
            onChange={(e) => change({ water: { everyMin: Number(e.target.value) } })}
          >
            {[30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h`.replace('1.5 h', '1 h 30')}
              </option>
            ))}
          </select>
        </Row>
      </Group>

      <Group title="🙆 Stretch & sleep">
        <Toggle
          label="Stretch with me"
          description="Now and then he stretches and invites you to copy him (never during a focus round)."
          checked={s.stretch.enabled}
          onChange={(enabled) => change({ stretch: { enabled } })}
        />
        <Row label="Every">
          <select
            value={s.stretch.everyMin}
            disabled={!s.stretch.enabled}
            onChange={(e) => change({ stretch: { everyMin: Number(e.target.value) } })}
          >
            {[60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m === 90 ? '1 h 30' : `${m / 60} h`}
              </option>
            ))}
          </select>
        </Row>
        <Toggle
          label="😴 Bedtime mode"
          description="After this time he gets sleepy, yawns, then lies across your screen: go to bed! Click him for 30 more minutes."
          checked={s.bedtime.enabled}
          onChange={(enabled) => change({ bedtime: { enabled } })}
        />
        <Row label="Bedtime">
          <input
            type="time"
            className="settings-input"
            value={s.bedtime.at}
            disabled={!s.bedtime.enabled}
            onChange={(e) => e.target.value && change({ bedtime: { at: e.target.value } })}
          />
        </Row>
      </Group>

      <Group title="🎮 Play">
        <Toggle
          label="🔴 Laser game"
          description="Press Ctrl+Alt+L: a red dot follows your mouse and he chases it. Esc to stop."
          checked={s.laser}
          onChange={(laser) => change({ laser })}
        />
      </Group>

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
