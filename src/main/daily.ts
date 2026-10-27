// Daily life: water reminders, weather outfits, prayer times + Ramadan, and the state the pet
// window draws from them (DailyState). Weather is opt-in and sends only the place's
// coordinates to Open-Meteo; prayer times are calculated here, offline.
import { BrowserWindow, app, ipcMain, screen } from 'electron'
import { minutesPastBedtime } from '../shared/habits'
import { type DailyState, IPC, type PlaceResult } from '../shared/ipc'
import { type Outfit, outfitFor, parseForecast } from '../shared/weather'
import { inFocusRound, onPomodoroChange } from './pomodoro'
import { PRAYER_LABELS, iftarAt, isRamadan, nextPrayer } from './prayerTimes'
import { recordActivity, sendMoment } from './progress'
import { onSettingsChange, storedSettings } from './settings'
import { leaveWindow, sitOnWindow } from './window'

const MIN = 60_000
const WEATHER_EVERY_MS = 30 * MIN
const PRAYER_MAT_MS = 10 * MIN
/** an unanswered glass of water goes away after this */
const WATER_WAITS_MS = 15 * MIN
const FETCH_TIMEOUT_MS = 10_000

let state: DailyState = {
  outfit: null,
  praying: false,
  ramadan: null,
  waterDue: false,
  stretchDue: false,
  bedtime: null,
  guarding: null,
  laser: false
}

export function dailyState(): DailyState {
  return state
}

/** Changes what the pet window draws (also used by the distraction guard and laser). */
export function setDaily(change: Partial<DailyState>): void {
  state = { ...state, ...change }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.daily, state)
}

// ---------- water ----------

let waterTimer: NodeJS.Timeout | undefined
let waterGone: NodeJS.Timeout | undefined
let waterLate = false // came due during a focus round: offer it at the break

function scheduleWater(): void {
  clearTimeout(waterTimer)
  const { enabled, everyMin } = storedSettings().water
  if (!enabled) return setDaily({ waterDue: false })
  waterTimer = setTimeout(offerWater, everyMin * MIN)
}

function offerWater(): void {
  if (inFocusRound()) {
    waterLate = true
    return
  }
  waterLate = false
  setDaily({ waterDue: true })
  sendMoment({ kind: 'water' })
  clearTimeout(waterGone)
  waterGone = setTimeout(() => {
    setDaily({ waterDue: false })
    scheduleWater()
  }, WATER_WAITS_MS)
}

function drank(): void {
  clearTimeout(waterGone)
  if (state.waterDue) recordActivity({ type: 'water' })
  setDaily({ waterDue: false })
  scheduleWater()
}

// ---------- stretch with me ----------

let stretchTimer: NodeJS.Timeout | undefined
let stretchGone: NodeJS.Timeout | undefined

function scheduleStretch(): void {
  clearTimeout(stretchTimer)
  const { enabled, everyMin } = storedSettings().stretch
  if (!enabled) return setDaily({ stretchDue: false })
  stretchTimer = setTimeout(offerStretch, everyMin * MIN)
}

function offerStretch(): void {
  // never in the middle of a focus round or late at night: try again a bit later
  if (inFocusRound() || state.bedtime) {
    stretchTimer = setTimeout(offerStretch, 5 * MIN)
    return
  }
  setDaily({ stretchDue: true })
  sendMoment({ kind: 'stretch' })
  clearTimeout(stretchGone)
  stretchGone = setTimeout(stretched, 5 * MIN)
}

function stretched(): void {
  clearTimeout(stretchGone)
  setDaily({ stretchDue: false })
  scheduleStretch()
}

// ---------- bedtime ----------

const SLEEPY_MS = 30 * MIN
let bedtimeTimer: NodeJS.Timeout | undefined
let bedtimeSnoozedUntil = 0

function checkBedtime(): void {
  clearTimeout(bedtimeTimer)
  const { enabled, at } = storedSettings().bedtime
  const late = enabled ? minutesPastBedtime(at, Date.now()) : null
  let phase: DailyState['bedtime'] = null
  if (late !== null)
    phase = late * MIN < SLEEPY_MS || Date.now() < bedtimeSnoozedUntil ? 'sleepy' : 'lying'
  if (phase !== state.bedtime) {
    if (phase === 'sleepy' && !state.bedtime) sendMoment({ kind: 'bedtime' })
    if (phase === 'lying') lieOnScreen()
    if (state.bedtime === 'lying' && phase !== 'lying') leaveWindow()
    setDaily({ bedtime: phase })
  }
  bedtimeTimer = setTimeout(checkBedtime, MIN)
}

function lieOnScreen(): void {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  sitOnWindow(workArea)
}

/** Clicked while lying across the screen: "5 more minutes"… well, 30. */
export function snoozeBedtime(): void {
  if (state.bedtime !== 'lying') return
  bedtimeSnoozedUntil = Date.now() + 30 * MIN
  checkBedtime()
}

// ---------- weather ----------

let weatherTimer: NodeJS.Timeout | undefined

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function updateWeather(): Promise<void> {
  clearTimeout(weatherTimer)
  const { weather, place } = storedSettings()
  if (!weather || !place) return setDaily({ outfit: null })
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(2)}` +
      `&longitude=${place.lon.toFixed(2)}&current=temperature_2m,weather_code,is_day`
    const now = parseForecast(await fetchJson(url))
    const outfit: Outfit | null = now ? outfitFor(now) : null
    setDaily({ outfit })
  } catch {
    // offline: keep the last outfit, try again later
  }
  weatherTimer = setTimeout(() => void updateWeather(), WEATHER_EVERY_MS)
}

/** Settings › city search. Sends only what was typed. */
async function searchPlace(query: unknown): Promise<PlaceResult[]> {
  if (typeof query !== 'string' || query.trim().length < 2) return []
  try {
    const url =
      'https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&format=json&name=' +
      encodeURIComponent(query.trim().slice(0, 80))
    const json = (await fetchJson(url)) as { results?: Array<Record<string, unknown>> }
    return (json.results ?? [])
      .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
      .map((r) => ({
        city: String(r.name),
        country: String(r.country ?? ''),
        lat: r.latitude as number,
        lon: r.longitude as number
      }))
  } catch {
    return []
  }
}

// ---------- prayer times + Ramadan ----------

let prayerTimer: NodeJS.Timeout | undefined
let matTimer: NodeJS.Timeout | undefined

function updatePrayer(): void {
  clearTimeout(prayerTimer)
  const { prayer, place } = storedSettings()
  if (!prayer.enabled || !place) {
    setDaily({ praying: false, ramadan: null })
    return
  }
  const now = Date.now()
  setDaily({
    ramadan:
      prayer.ramadan && isRamadan(now) ? { iftarAt: iftarAt(place, prayer.method, now) } : null
  })
  const next = nextPrayer(place, prayer.method, now)
  // long timers drift (sleep): wake at least every 10 minutes and look again
  const wait = Math.min(next.at - now, 10 * MIN)
  prayerTimer = setTimeout(
    () => {
      if (Date.now() >= next.at - 1000) {
        sendMoment({ kind: 'prayer', label: PRAYER_LABELS[next.name] })
        setDaily({ praying: true })
        clearTimeout(matTimer)
        matTimer = setTimeout(() => setDaily({ praying: false }), PRAYER_MAT_MS)
      }
      updatePrayer()
    },
    Math.max(1000, wait)
  )
}

export function startDaily(): void {
  ipcMain.handle(IPC.getDaily, () => state)
  ipcMain.on(IPC.drank, drank)
  ipcMain.on(IPC.stretched, stretched)
  ipcMain.handle(IPC.searchPlace, (_, query: unknown) => searchPlace(query))

  scheduleWater()
  scheduleStretch()
  checkBedtime()
  void updateWeather()
  updatePrayer()

  onSettingsChange((now, before) => {
    if (JSON.stringify(now.water) !== JSON.stringify(before.water)) scheduleWater()
    if (JSON.stringify(now.stretch) !== JSON.stringify(before.stretch)) scheduleStretch()
    if (JSON.stringify(now.bedtime) !== JSON.stringify(before.bedtime)) checkBedtime()
    if (
      now.weather !== before.weather ||
      JSON.stringify(now.place) !== JSON.stringify(before.place)
    )
      void updateWeather()
    if (
      JSON.stringify(now.prayer) !== JSON.stringify(before.prayer) ||
      JSON.stringify(now.place) !== JSON.stringify(before.place)
    )
      updatePrayer()
  })
  // a glass that came due during focus is offered at the break
  onPomodoroChange(() => {
    if (waterLate && !inFocusRound()) offerWater()
  })
  app.on('before-quit', () => {
    for (const t of [
      waterTimer,
      waterGone,
      weatherTimer,
      prayerTimer,
      matTimer,
      stretchTimer,
      stretchGone,
      bedtimeTimer
    ])
      clearTimeout(t)
  })
}
