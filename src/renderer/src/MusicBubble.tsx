// Hover bubble while music is around: the song, the app, and pixel-art prev / play-pause / next.
// Same bubble and button styles as the Approve / Deny bubble, icons drawn like Noodle.
import type { MusicCommand, MusicState } from '@shared/music'
import { songLine } from '@shared/music'
import { PALETTE } from './pets/noodle/palette'
import { createMap, stamp, toRuns } from './pets/pixel/canvas'

// 1 character = 1 pixel (k = ink), drawn at 2 screen px per pixel
const ICONS = {
  prev: ['k....k', 'k...kk', 'k..kkk', 'k.kkkk', 'k..kkk', 'k...kk', 'k....k'],
  play: ['k.....', 'kkk...', 'kkkkk.', 'kkkkkk', 'kkkkk.', 'kkk...', 'k.....'],
  pause: ['kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk'],
  next: ['k....k', 'kk...k', 'kkk..k', 'kkkk.k', 'kkk..k', 'kk...k', 'k....k']
} as const

const ICON_SCALE = 2

export function PixelIcon({ rows }: { rows: readonly string[] }): React.JSX.Element {
  const w = rows[0].length
  const h = rows.length
  const map = createMap(w, h)
  stamp(map, 0, 0, rows)
  return (
    <svg
      width={w * ICON_SCALE}
      height={h * ICON_SCALE}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {toRuns(map).map((run) => (
        <rect
          key={`${run.x},${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={PALETTE[run.key]}
        />
      ))}
    </svg>
  )
}

interface Props {
  music: MusicState
  /** extra line about the agent session, if any */
  agentLine?: string
  onCommand(command: MusicCommand): void
}

export function MusicBubble({ music, agentLine, onCommand }: Props): React.JSX.Element {
  const live = music.hasSession
  const button = (
    command: MusicCommand,
    icon: readonly string[],
    label: string
  ): React.JSX.Element => (
    <button
      className="btn btn-icon"
      disabled={!live}
      title={label}
      aria-label={label}
      onClick={() => onCommand(command)}
    >
      <PixelIcon rows={icon} />
    </button>
  )

  return (
    <div className="bubble bubble-music" data-ui="">
      <div className="bubble-title">{live ? `🎵 ${songLine(music)}` : '🎵 nothing playing'}</div>
      {live && music.app && <div className="bubble-sub">{music.app}</div>}
      {agentLine && <div className="bubble-sub">{agentLine}</div>}
      <div className="bubble-actions">
        {button('prev', ICONS.prev, 'Previous')}
        {button(
          'toggle',
          music.playing ? ICONS.pause : ICONS.play,
          music.playing ? 'Pause' : 'Play'
        )}
        {button('next', ICONS.next, 'Next')}
      </div>
    </div>
  )
}
