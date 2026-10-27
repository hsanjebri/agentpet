// Daily life: water reminders, weather outfits, prayer times + Ramadan, and the state the pet
// window draws from them (DailyState). Weather is opt-in and sends only the place's
// coordinates to Open-Meteo; prayer times are calculated here, offline.
import { BrowserWindow, app, ipcMain } from 'electron'
import { type DailyState, IPC, type PlaceResult } from '../shared/ipc'
import { type Outfit, outfitFor, parseForecast } from '../shared/weather'
import { inFocusRound, onPomodoroChange } from './pomodoro'
import { PRAYER_LABELS, iftarAt, isRamadan, nextPrayer } from './prayerTimes'
import { recordActivity, sendMoment } from './progress'
import { onSettingsChange, storedSettings } from './settings'

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
  ipcMain.handle(IPC.searchPlace, (_, query: unknown) => searchPlace(query))

  scheduleWater()
  void updateWeather()
  updatePrayer()

  onSettingsChange((now, before) => {
    if (JSON.stringify(now.water) !== JSON.stringify(before.water)) scheduleWater()
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
    for (const t of [waterTimer, waterGone, weatherTimer, prayerTimer, matTimer]) clearTimeout(t)
  })
}
