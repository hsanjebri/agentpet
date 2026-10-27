// Settings › Friends: off by default. When on: your code, add by code, requests, friends with
// online dots, remove / block, and who may visit (for playdates later).
import type { FriendsResult, FriendsView, FriendPet, RespondAction } from '@shared/friends'
import type { PetSettings } from '@shared/ipc'
import { useEffect, useState } from 'react'
import { Choice, Group, Row, Section, Toggle } from './controls'

function useFriends(): FriendsView | null {
  const [view, setView] = useState<FriendsView | null>(null)
  useEffect(() => {
    window.api.getFriends().then(setView)
    return window.api.onFriends(setView)
  }, [])
  return view
}

/** Send your cat to an online friend's desktop for a few minutes. */
function VisitButton({ pet }: { pet: FriendPet }): React.JSX.Element {
  const [note, setNote] = useState('')
  return (
    <>
      {note && <span className="connect-small">{note}</span>}
      <button
        className="btn btn-approve"
        title={`Send your cat to visit ${pet.name}`}
        onClick={() => void window.api.visitFriend(pet.userId).then(setNote)}
      >
        Visit 🧳
      </button>
    </>
  )
}

function PetRow({
  pet,
  dot,
  actions,
  extra
}: {
  pet: FriendPet
  dot?: boolean
  actions: Array<[RespondAction, string, string?]>
  extra?: React.ReactNode
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  return (
    <div className="settings-row friend-row">
      {dot !== undefined && (
        <span
          className={`friend-dot${pet.online ? ' online' : ''}`}
          title={pet.online ? 'online' : 'offline'}
        />
      )}
      <span className="settings-row-text">
        <b>
          {pet.name} <span className="connect-small">· lv {pet.level}</span>
        </b>
        <span className="connect-small">
          {pet.skin} · {pet.code}
        </span>
      </span>
      <span className="settings-row-control">
        {extra}
        {actions.map(([action, label, style]) => (
          <button
            key={action}
            className={`btn ${style ?? ''}`}
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void window.api
                .friends({ type: 'respond', id: pet.id, action })
                .finally(() => setBusy(false))
            }}
          >
            {label}
          </button>
        ))}
      </span>
    </div>
  )
}

export function FriendsSection({ settings: s }: { settings: PetSettings }): React.JSX.Element {
  const view = useFriends()
  const [code, setCode] = useState('')
  const [result, setResult] = useState<FriendsResult | null>(null)
  const [copied, setCopied] = useState(false)

  const toggle = (
    <Toggle
      label="Friends"
      description="Shares only your pet's name, skin, level and online status. Nothing else."
      checked={s.friends}
      onChange={(friends) => window.api.changeSettings({ friends })}
    />
  )

  if (!s.friends || !view || view.status === 'off')
    return (
      <Section title="👥 Friends" intro="See your friends' pets and when they're around.">
        {toggle}
        <p className="connect-small">
          Off: nothing is sent anywhere. When on, you get an anonymous account (no email, no
          password) on AgentPet&apos;s Friends server.
        </p>
      </Section>
    )

  if (view.status === 'unconfigured')
    return (
      <Section title="👥 Friends">
        {toggle}
        <p className="connect-warn">Friends isn&apos;t set up in this build yet.</p>
      </Section>
    )

  if (view.status !== 'online')
    return (
      <Section title="👥 Friends">
        {toggle}
        <p className="connect-small">
          {view.status === 'connecting' ? 'Connecting…' : '📴 Friends are offline right now.'}
        </p>
        {view.status === 'offline' && (
          <button
            className="btn btn-terminal"
            onClick={() => window.api.friends({ type: 'retry' })}
          >
            Try again
          </button>
        )}
      </Section>
    )

  const add = (): void => {
    setResult(null)
    void window.api.friends({ type: 'add', code }).then((r) => {
      setResult(r)
      if (r.ok) setCode('')
    })
  }

  return (
    <Section title="👥 Friends">
      {toggle}

      <Row label="My code" description="Give it to a friend so they can add you.">
        <code className="friend-code">{view.myCode ?? '…'}</code>
        <button
          className="btn btn-terminal"
          disabled={!view.myCode}
          onClick={() => {
            void navigator.clipboard.writeText(view.myCode ?? '')
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </Row>
      <Row label="Add friend">
        <input
          className="settings-input"
          value={code}
          placeholder="MOCHI-7K2P"
          maxLength={14}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && code.trim() && add()}
        />
        <button className="btn btn-approve" disabled={!code.trim()} onClick={add}>
          Add
        </button>
      </Row>
      {result?.message && (
        <p className={result.ok ? 'connect-ok-small' : 'connect-error'}>{result.message}</p>
      )}

      {view.incoming.length > 0 && (
        <Group title="Requests">
          {view.incoming.map((pet) => (
            <PetRow
              key={pet.id}
              pet={pet}
              actions={[
                ['accept', 'Accept', 'btn-approve'],
                ['decline', 'Decline'],
                ['block', 'Block', 'btn-deny']
              ]}
            />
          ))}
        </Group>
      )}

      <Group title={`Friends (${view.friends.length})`}>
        {view.friends.length === 0 && (
          <p className="connect-small">No friends yet: share your code!</p>
        )}
        {view.friends.map((pet) => (
          <PetRow
            key={pet.id}
            pet={pet}
            dot
            extra={pet.online ? <VisitButton pet={pet} /> : undefined}
            actions={[
              ['remove', 'Remove'],
              ['block', 'Block', 'btn-deny']
            ]}
          />
        ))}
      </Group>

      {view.outgoing.length > 0 && (
        <Group title="Waiting for them">
          {view.outgoing.map((pet) => (
            <PetRow key={pet.id} pet={pet} actions={[['cancel', 'Cancel']]} />
          ))}
        </Group>
      )}

      {view.blocked.length > 0 && (
        <Group title="Blocked">
          {view.blocked.map((pet) => (
            <PetRow key={pet.id} pet={pet} actions={[['unblock', 'Unblock']]} />
          ))}
        </Group>
      )}

      <Group title="Playdates">
        <Row
          label="Accept visits from"
          description="Friends' cats can come and play next to yours for a few minutes (never during a focus round or bedtime)."
        >
          <Choice
            value={s.visits}
            options={[
              { value: 'friends', label: 'Friends' },
              { value: 'nobody', label: 'Nobody' }
            ]}
            onChange={(visits) => window.api.changeSettings({ visits })}
          />
        </Row>
      </Group>
    </Section>
  )
}
