import { describe, expect, it } from 'vitest'
import { distractionIn, parseWindowLine } from '@shared/guard'
import { type Activity, emptyProgress, record } from '@shared/progress'
import { cleanChange, defaultSettings } from '@shared/settings'
import { isRaining, outfitFor, parseForecast } from '@shared/weather'
import { isRamadan, nextPrayer, prayersOn } from '../src/main/prayerTimes'

const TUNIS = { city: 'Tunis', lat: 36.8065, lon: 10.1815 }

describe('weather outfits', () => {
  it('rain hood in the rain, scarf in the cold, sunglasses in the sun', () => {
    expect(outfitFor({ temp: 14, code: 63, isDay: true }).wear).toEqual(['rainhood'])
    expect(outfitFor({ temp: 4, code: 3, isDay: true }).wear).toEqual(['scarf'])
    expect(outfitFor({ temp: 33, code: 0, isDay: true }).wear).toEqual(['sunglasses'])
    expect(outfitFor({ temp: 33, code: 0, isDay: false }).wear).toEqual([]) // no shades at night
    expect(outfitFor({ temp: -2, code: 73, isDay: true }).wear).toEqual(['rainhood', 'scarf'])
    expect(outfitFor({ temp: 20, code: 2, isDay: true })).toEqual({ wear: [], label: '☁️ 20°' })
    expect(isRaining({ temp: 10, code: 61, isDay: true })).toBe(true)
  })

  it('reads Open-Meteo and survives anything else', () => {
    expect(
      parseForecast({ current: { temperature_2m: 18.4, weather_code: 61, is_day: 1 } })
    ).toEqual({ temp: 18.4, code: 61, isDay: true })
    expect(parseForecast({ error: true })).toBeNull()
    expect(parseForecast(null)).toBeNull()
  })
})

describe('distraction guard', () => {
  const sites = ['YouTube', 'Instagram', 'X']
  it('finds the site in a browser title, as a whole word', () => {
    expect(distractionIn('lofi beats - YouTube - Google Chrome', sites)).toBe('YouTube')
    expect(distractionIn('Instagram • Messages', sites)).toBe('Instagram')
    expect(distractionIn('Xbox Game Bar', sites)).toBeNull() // "X" isn't "Xbox"
    expect(distractionIn('main.ts - Meowtify - Visual Studio Code', sites)).toBeNull()
  })

  it('reads watcher lines', () => {
    expect(
      parseWindowLine('{"title":"YouTube","x":0,"y":0,"w":1920,"h":1040,"pid":42}')
    ).toMatchObject({ title: 'YouTube', width: 1920, pid: 42 })
    expect(parseWindowLine('oops')).toBeNull()
  })
})

describe('prayer times (on this PC)', () => {
  it('five prayers in order, all on the same day', () => {
    const day = new Date(2026, 9, 27, 3, 0).getTime()
    const times = prayersOn(TUNIS, 'MuslimWorldLeague', day)
    expect(times.map((t) => t.name)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])
    for (let i = 1; i < times.length; i++) expect(times[i].at).toBeGreaterThan(times[i - 1].at)
  })

  it('after Isha the next prayer is tomorrow’s Fajr', () => {
    const late = new Date(2026, 9, 27, 23, 30).getTime()
    const next = nextPrayer(TUNIS, 'MuslimWorldLeague', late)
    expect(next.name).toBe('fajr')
    expect(next.at).toBeGreaterThan(late)
  })

  it('knows Ramadan from the Islamic calendar', () => {
    expect(isRamadan(new Date(2027, 1, 20).getTime())).toBe(true) // Ramadan 1448
    expect(isRamadan(new Date(2026, 9, 27).getTime())).toBe(false)
  })
})

describe('daily settings and water', () => {
  it('validates the new settings', () => {
    expect(
      cleanChange({
        water: { everyMin: 1, enabled: 'yes' },
        prayer: { method: 'Made up', ramadan: false },
        place: { city: 'Tunis', lat: 36.8, lon: 999 },
        guard: { sites: [' YouTube ', '', 7] }
      })
    ).toEqual({
      water: { everyMin: 15 },
      prayer: { ramadan: false },
      guard: { sites: ['YouTube'] }
    })
    expect(cleanChange({ place: null })).toEqual({ place: null })
    expect(defaultSettings().weather).toBe(false) // opt-in: it uses the network
    expect(defaultSettings().prayer.enabled).toBe(false)
  })

  it('a glass of water is a little XP, capped per day', () => {
    const water: Activity = { type: 'water' }
    const now = new Date(2026, 9, 27, 12).getTime()
    let p = emptyProgress()
    for (let i = 0; i < 20; i++) p = record(p, water, now).progress
    expect(p.xp).toBe(24)
    expect(p.days['2026-10-27'].water).toBe(20)
  })
})
