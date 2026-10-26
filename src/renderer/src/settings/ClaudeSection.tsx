// Settings › Claude Code (developer mode only): connection, usage bar, risk warnings, approvals.
import type { ConnectStatus, PetSettings } from '@shared/ipc'
import { RISK_KINDS, RISK_LABELS } from '@shared/settings'
import { useEffect, useState } from 'react'
import { ConnectPanel } from '../Connect'
import { ActionButton, Group, Section, Toggle } from './controls'

/** The panel below shows connected / needs fixing / not connected; this adds "not found". */
function Status({ status }: { status: ConnectStatus | null }): React.JSX.Element | null {
  if (!status || status.claudeFound || status.connected) return null
  return (
    <p className="connect-warn">
      Claude Code not found <span className="connect-small">(run it once, then come back)</span>
    </p>
  )
}

export function ClaudeSection({
  settings: s,
  name
}: {
  settings: PetSettings
  name: string
}): React.JSX.Element {
  const change = window.api.changeSettings
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [allow, setAllow] = useState(s.riskAllow.join('\n'))

  const refresh = (): void => void window.api.connectStatus().then(setStatus)
  useEffect(refresh, [])

  return (
    <Section title="🤖 Claude Code">
      <Group title="Connection">
        <Status status={status} />
        <ConnectPanel name={name} />
        <div className="settings-actions">
          {status?.connected && (
            <ActionButton action="disconnectClaude" onDone={refresh}>
              Disconnect
            </ActionButton>
          )}
          {Boolean(status?.backups) && (
            <ActionButton
              action="restoreClaudeBackup"
              confirm="Put back the settings file from before AgentPet's last change?"
              onDone={refresh}
            >
              Restore my settings backup
            </ActionButton>
          )}
        </div>
      </Group>

      <Group title="On the pet">
        <Toggle
          label="📊 Usage bar"
          description="Your 5-hour Claude limit (or context window) under the pet."
          checked={s.usageBar}
          onChange={(usageBar) => change({ usageBar })}
        />
        <Toggle
          label="✅ Approve / Deny bubble"
          description={`Off = ${name} only alerts you; you answer in the terminal.`}
          checked={s.approvalBubble}
          onChange={(approvalBubble) => change({ approvalBubble })}
        />
      </Group>

      <Group title="😾 Risk warnings">
        <p className="connect-small">{name} hisses and says why when Claude is about to:</p>
        {RISK_KINDS.map((kind) => (
          <Toggle
            key={kind}
            label={RISK_LABELS[kind]}
            checked={s.risks[kind]}
            onChange={(on) => change({ risks: { [kind]: on } })}
          />
        ))}
        <label className="settings-textarea">
          <b>Never warn about</b>
          <span className="connect-small">
            One path or command per line, e.g. <code>.env.example</code> or <code>rm -rf dist</code>
            .
          </span>
          <textarea
            rows={3}
            value={allow}
            spellCheck={false}
            onChange={(e) => setAllow(e.target.value)}
            onBlur={() => change({ riskAllow: allow.split('\n') })}
          />
        </label>
      </Group>
    </Section>
  )
}
