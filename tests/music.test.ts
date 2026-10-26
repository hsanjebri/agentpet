import { describe, expect, it } from 'vitest'
import {
  HEADPHONES_OFF_AFTER_MS,
  LineBuffer,
  NO_MUSIC,
  type MusicState,
  isNewSong,
  musicView,
  parseMusicLine,
  restartDelay,
  songLine
} from '@shared/music'

const song = (title: string, playing = true, artist = 'Artist'): MusicState => ({
  hasSession: true,
  playing,
  title,
  artist,
  app: 'Spotify'
})

describe('parseMusicLine', () => {
  it('reads a playing session', () => {
    expect(
      parseMusicLine(
        '{"playing":true,"title":"Song","artist":"Band","app":"Spotify","hasSession":true}'
      )
    ).toEqual({
      hasSession: true,
      playing: true,
      title: 'Song',
      artist: 'Band',
      app: 'Spotify',
      thumb: undefined
    })
  })

  it('no session, garbage and non-objects', () => {
    expect(parseMusicLine('{"hasSession":false}')).toEqual(NO_MUSIC)
    expect(parseMusicLine('not json')).toBeNull()
    expect(parseMusicLine('42')).toBeNull()
  })

  it('keeps a reasonable thumbnail only', () => {
    expect(parseMusicLine('{"hasSession":true,"thumb":"iVBOR"}')?.thumb).toBe('iVBOR')
    const huge = 'x'.repeat(300_000)
    expect(parseMusicLine(`{"hasSession":true,"thumb":"${huge}"}`)?.thumb).toBeUndefined()
  })
})

describe('LineBuffer', () => {
  it('joins lines split across chunks and skips blanks', () => {
    const buffer = new LineBuffer()
    expect(buffer.push('{"a":1}\n{"b"')).toEqual(['{"a":1}'])
    expect(buffer.push(':2}\r\n\n')).toEqual(['{"b":2}'])
    expect(buffer.push('')).toEqual([])
  })
})

describe('restartDelay', () => {
  it('backs off, then gives up after 5 tries', () => {
    expect([0, 1, 2, 3, 4].map(restartDelay)).toEqual([1000, 2000, 5000, 10_000, 30_000])
    expect(restartDelay(5)).toBeNull()
  })
})

describe('isNewSong', () => {
  it('counts each track once, only while playing', () => {
    expect(isNewSong(null, song('A'))).toBe(true)
    expect(isNewSong(song('A'), song('A'))).toBe(false)
    expect(isNewSong(song('A'), song('A', false))).toBe(false) // paused
    expect(isNewSong(song('A', false), song('A'))).toBe(false) // resumed: same song
    expect(isNewSong(song('A'), song('B'))).toBe(true)
    expect(isNewSong(song('A'), NO_MUSIC)).toBe(false)
  })
})

describe('musicView', () => {
  it('playing: headphones on and grooving', () => {
    expect(musicView(song('A'), null, 0)).toEqual({ headphones: true, grooving: true })
  })

  it('paused: headphones stay for 30 s, no bob', () => {
    const paused = song('A', false)
    expect(musicView(paused, 1000, 1000 + HEADPHONES_OFF_AFTER_MS - 1)).toEqual({
      headphones: true,
      grooving: false
    })
    expect(musicView(paused, 1000, 1000 + HEADPHONES_OFF_AFTER_MS).headphones).toBe(false)
  })

  it('nothing ever played: no headphones', () => {
    expect(musicView(null, null, 0)).toEqual({ headphones: false, grooving: false })
    expect(musicView(NO_MUSIC, null, 0).headphones).toBe(false)
  })
})

describe('songLine', () => {
  it('title – artist, truncated', () => {
    expect(songLine(song('Song', true, 'Band'))).toBe('Song – Band')
    expect(songLine(song('A very long song title that goes on and on', true, 'Band'), 20)).toBe(
      'A very long song ti…'
    )
  })
})
