// Weather outfits: what he wears for the weather (Open-Meteo "weather codes", WMO). Pure.

export type WeatherWear = 'rainhood' | 'scarf' | 'sunglasses'

export interface WeatherNow {
  /** °C */
  temp: number
  /** WMO weather code from Open-Meteo */
  code: number
  isDay: boolean
}

export interface Outfit {
  wear: WeatherWear[]
  /** for the hover bubble, e.g. "🌧️ 14°" */
  label: string
}

const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const SNOW = new Set([71, 73, 75, 77, 85, 86])
const CLEAR = new Set([0, 1])

export const COLD_BELOW = 10
export const HOT_FROM = 28

function icon(w: WeatherNow): string {
  if (RAIN.has(w.code)) return w.code >= 95 ? '⛈️' : '🌧️'
  if (SNOW.has(w.code)) return '❄️'
  if (CLEAR.has(w.code)) return w.isDay ? '☀️' : '🌙'
  if (w.code === 45 || w.code === 48) return '🌫️'
  return '☁️'
}

export function outfitFor(w: WeatherNow): Outfit {
  const wear: WeatherWear[] = []
  if (RAIN.has(w.code) || SNOW.has(w.code)) wear.push('rainhood')
  if (w.temp < COLD_BELOW || SNOW.has(w.code)) wear.push('scarf')
  if (w.temp >= HOT_FROM && CLEAR.has(w.code) && w.isDay) wear.push('sunglasses')
  return { wear, label: `${icon(w)} ${Math.round(w.temp)}°` }
}

/** Raining: he curls up (for ambient rain too). */
export function isRaining(w: WeatherNow | null): boolean {
  return Boolean(w && RAIN.has(w.code))
}

/** Open-Meteo's answer -> WeatherNow, or null if it's not what we expect. */
export function parseForecast(json: unknown): WeatherNow | null {
  const current = (json as { current?: Record<string, unknown> } | null)?.current
  if (!current) return null
  const { temperature_2m: temp, weather_code: code, is_day: isDay } = current
  if (typeof temp !== 'number' || typeof code !== 'number') return null
  return { temp, code, isDay: isDay !== 0 }
}
