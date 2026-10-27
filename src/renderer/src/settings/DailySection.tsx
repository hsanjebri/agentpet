// Settings › Daily life: your city (typed, never detected), weather outfits, prayer times and
// Ramadan. Weather sends only the city's coordinates; prayer times are calculated on this PC.
import type { PetSettings, PlaceResult } from '@shared/ipc'
import { PRAYER_METHODS, type PrayerMethod } from '@shared/settings'
import { useState } from 'react'
import { Group, Row, Section, Toggle } from './controls'

const METHOD_LABELS: Record<PrayerMethod, string> = {
  MuslimWorldLeague: 'Muslim World League',
  Egyptian: 'Egyptian General Authority',
  Karachi: 'Karachi',
  UmmAlQura: 'Umm al-Qura (Makkah)',
  Dubai: 'Dubai',
  Qatar: 'Qatar',
  Kuwait: 'Kuwait',
  Turkey: 'Turkey (Diyanet)',
  Tehran: 'Tehran',
  Singapore: 'Singapore',
  NorthAmerica: 'North America (ISNA)',
  MoonsightingCommittee: 'Moonsighting Committee'
}

function PlacePicker({ settings: s }: { settings: PetSettings }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [busy, setBusy] = useState(false)

  const search = (): void => {
    setBusy(true)
    void window.api.searchPlace(query).then((r) => {
      setResults(r)
      setBusy(false)
    })
  }

  return (
    <>
      <Row
        label="📍 My city"
        description={
          s.place
            ? `${s.place.city} (${s.place.lat.toFixed(2)}, ${s.place.lon.toFixed(2)})`
            : 'Not set'
        }
      >
        <input
          className="settings-input"
          value={query}
          placeholder="Tunis"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && query.trim().length > 1 && search()}
        />
        <button
          className="btn btn-terminal"
          disabled={busy || query.trim().length < 2}
          onClick={search}
        >
          {busy ? '…' : 'Search'}
        </button>
      </Row>
      {results && results.length === 0 && (
        <p className="connect-small">Nothing found (or offline).</p>
      )}
      {results?.map((r) => (
        <button
          key={`${r.lat},${r.lon}`}
          className="btn place-result"
          onClick={() => {
            window.api.changeSettings({
              place: { city: `${r.city}, ${r.country}`, lat: r.lat, lon: r.lon }
            })
            setResults(null)
            setQuery('')
          }}
        >
          {r.city}, {r.country}
        </button>
      ))}
      <p className="connect-small">
        The search sends what you type to Open-Meteo once. Only the city is used, never your
        location.
      </p>
    </>
  )
}

export function DailySection({ settings: s }: { settings: PetSettings }): React.JSX.Element {
  const change = window.api.changeSettings
  const needPlace = !s.place
  return (
    <Section title="🌍 Daily life">
      <PlacePicker settings={s} />

      <Group title="⛅ Weather outfits">
        <Toggle
          label="Dress for the weather"
          description={
            needPlace
              ? 'Set your city first.'
              : 'Raincoat when it rains, scarf when it’s cold, sunglasses when it’s hot. Checks every 30 min (Open-Meteo, free).'
          }
          checked={s.weather}
          disabled={needPlace}
          onChange={(weather) => change({ weather })}
        />
      </Group>

      <Group title="🕌 Prayer times">
        <Toggle
          label="Prayer reminders"
          description={
            needPlace
              ? 'Set your city first.'
              : 'At each prayer time he sits on a little prayer mat with a soft reminder. Calculated on this computer.'
          }
          checked={s.prayer.enabled}
          disabled={needPlace}
          onChange={(enabled) => change({ prayer: { enabled } })}
        />
        <Row label="Calculation method">
          <select
            value={s.prayer.method}
            disabled={!s.prayer.enabled}
            onChange={(e) => change({ prayer: { method: e.target.value as PrayerMethod } })}
          >
            {PRAYER_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Row>
        <Toggle
          label="🏮 Ramadan mode"
          description="During Ramadan: a lantern next to him and the iftar countdown when you hover him."
          checked={s.prayer.ramadan}
          disabled={!s.prayer.enabled}
          onChange={(ramadan) => change({ prayer: { ramadan } })}
        />
      </Group>
    </Section>
  )
}
