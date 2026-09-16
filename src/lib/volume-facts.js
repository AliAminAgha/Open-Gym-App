// Fun volume comparisons for the home stats tile (all reference weights in kg).
import { t } from './i18n.js'
import { weightToKg } from './profile.js'

const SK = 'gym_vol_fact_v1'

const THINGS = [
  { kg: 75, label: '≈ {0} adult humans' },
  { kg: 90, label: '≈ {0} fridges' },
  { kg: 200, label: '≈ {0} motorcycles' },
  { kg: 270, label: '≈ {0} grizzly bears' },
  { kg: 300, label: '≈ {0} grand pianos' },
  { kg: 450, label: '≈ {0} horses' },
  { kg: 1400, label: '≈ {0} mid-size cars' },
  { kg: 6000, label: '≈ {0} elephants' },
  { kg: 150000, label: '≈ {0} blue whales' }
]

function fmtCount(n) {
  if (n >= 100) return Math.round(n)
  if (n >= 10) return Math.round(n)
  return Math.round(n * 10) / 10
}

function buildFacts(vol, unit) {
  const kg = weightToKg(vol, unit) || 0
  if (kg < 50) return []

  const out = []
  for (const thing of THINGS) {
    const count = kg / thing.kg
    if (count < 0.8 || count > 8000) continue
    const n = fmtCount(count)
    out.push({ n, text: t(thing.label, n) })
  }
  return out
}

/** One comparison fact for this browser session (new pick when tab/app reopens). */
export function sessionVolumeFact(vol, unit) {
  if (!(vol > 0)) return null

  try {
    const raw = sessionStorage.getItem(SK)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.vol === vol && saved.unit === unit && saved.text) return saved.text
    }
  } catch { /* ignore */ }

  const facts = buildFacts(vol, unit)
  if (!facts.length) return null

  const pick = facts[Math.floor(Math.random() * facts.length)]
  try {
    sessionStorage.setItem(SK, JSON.stringify({ vol, unit, text: pick.text }))
  } catch { /* ignore */ }

  return pick.text
}
