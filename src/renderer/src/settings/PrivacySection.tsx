// Settings › Privacy & data: what stays here, what leaves (only if turned on), and resets.
import type { PetSettings } from '@shared/ipc'
import { ActionButton, Group, Row, Section } from './controls'

export function PrivacySection({ settings: s }: { settings: PetSettings }): React.JSX.Element {
  const dev = s.mode === 'developer'
  return (
    <Section title="🔒 Privacy & data">
      <Group title="Stays on this computer">
        <ul className="settings-list">
          <li>Your pet, his level, stats and settings.</li>
          {dev && (
            <li>
              What Claude Code does: the app only listens on this computer and only to hooks
              carrying its local token.
            </li>
          )}
          <li>Music: only a daily song count, never which songs.</li>
          <li>Pomodoros, petting and fish counts.</li>
          <li>No telemetry, no analytics, no account.</li>
        </ul>
      </Group>
      <Group title="Leaves this computer (only if you turn it on)">
        <ul className="settings-list">
          {dev && (
            <li>
              <b>Phone ping</b> sends the project name to your own ntfy topic.
            </li>
          )}
          <li>
            <b>Friends</b> shares your pet&apos;s name, skin, level and online status with the
            friends you accept. Nothing else.{' '}
            {s.friends ? <span className="connect-ok-small">(on)</span> : '(off)'}
          </li>
        </ul>
      </Group>

      <Group title="Your data">
        <Row label="Data folder" description="Settings, stats and progress files.">
          <ActionButton action="openDataFolder">Open</ActionButton>
        </Row>
        <Row label="Reset stats" description="Daily stats and totals. Level and accessories stay.">
          <ActionButton action="resetStats" confirm="Clear all stats?" danger>
            Reset stats
          </ActionButton>
        </Row>
        <Row label="Reset pet progress" description="Back to a level-1 kitten. The name stays.">
          <ActionButton action="resetProgress" confirm="Start over with a kitten?" danger>
            Reset progress
          </ActionButton>
        </Row>
        <Row label="Reset settings" description="Every setting back to its default.">
          <ActionButton action="resetSettings" confirm="Reset all settings?" danger>
            Reset settings
          </ActionButton>
        </Row>
      </Group>
    </Section>
  )
}
