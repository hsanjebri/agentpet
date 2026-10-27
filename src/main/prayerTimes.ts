// Prayer times, calculated on this computer (adhan library: no network), and Ramadan from the
// Islamic calendar built into the system (Intl). Pure apart from the clock passed in.
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan'
import type { Place, PrayerMethod } from '../shared/settings'

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
export const PRAYERS: readonly PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha'
}

export interface PrayerTime {
  name: PrayerName
  at: number
}

/** The day's five prayers (the local calendar day containing `now`). */
export function prayersOn(place: Place, method: PrayerMethod, now: number): PrayerTime[] {
  const times = new PrayerTimes(
    new Coordinates(place.lat, place.lon),
    new Date(now),
    CalculationMethod[method]()
  )
  return PRAYERS.map((name) => ({ name, at: times[name].getTime() }))
}

/** The next prayer from now (tomorrow's Fajr after Isha). */
export function nextPrayer(place: Place, method: PrayerMethod, now: number): PrayerTime {
  const today = prayersOn(place, method, now).find((p) => p.at > now)
  return today ?? prayersOn(place, method, now + 24 * 60 * 60_000)[0]
}

/** Ramadan is the 9th month of the Islamic calendar. */
export function isRamadan(now: number): boolean {
  const month = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).format(
    new Date(now)
  )
  return Number.parseInt(month, 10) === 9
}

/** Iftar (Maghrib) today, if it's still ahead. */
export function iftarAt(place: Place, method: PrayerMethod, now: number): number | null {
  const maghrib = prayersOn(place, method, now).find((p) => p.name === 'maghrib')
  return maghrib && maghrib.at > now ? maghrib.at : null
}
