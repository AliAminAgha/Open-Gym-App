// Energy estimates — Mifflin-St Jeor BMR + activity TDEE + conservative goal bands.
// Every output is an estimate; UI must label them as such.

import { ACTIVITY, currentWeightKg, heightCmOf } from './profile.js'

/** Mifflin–St Jeor resting metabolic rate (kcal/day). */
export function estimateBmr(profile, weightKg) {
  const age = profile?.age
  const height = heightCmOf(profile)
  const sex = profile?.sex
  if (!(age > 0) || !(height > 0) || !(weightKg > 0) || !sex) return null
  // Men: 10w + 6.25h − 5a + 5 · Women: 10w + 6.25h − 5a − 161
  const base = 10 * weightKg + 6.25 * height - 5 * age
  return Math.round(sex === 'female' ? base - 161 : base + 5)
}

export function activityFactor(activityId) {
  return (ACTIVITY.find(a => a.id === activityId) || ACTIVITY[2]).factor
}

/** Total daily energy expenditure estimate. */
export function estimateTdee(profile, weightKg) {
  const bmr = estimateBmr(profile, weightKg)
  if (!bmr) return null
  return Math.round(bmr * activityFactor(profile?.activity || 'moderate'))
}

/**
 * Conservative calorie suggestion for the user's goal.
 * Returns { maintenance, low, high, label } — all estimates.
 * Caps deficit/surplus to sustainable bands (~300–500 kcal).
 */
export function calorieSuggestion(profile, weightKg) {
  const maintenance = estimateTdee(profile, weightKg)
  if (!maintenance) return null
  const goal = profile?.goal || 'fitness'
  let low = maintenance
  let high = maintenance
  let label = 'Estimated maintenance'

  if (goal === 'fatloss' || goal === 'recomp') {
    // ~15–20% deficit, floored so we never go below ~BMR × 1.1 aggressively
    const bmr = estimateBmr(profile, weightKg) || maintenance * 0.7
    low = Math.max(Math.round(bmr * 1.15), Math.round(maintenance - 500))
    high = Math.round(maintenance - 300)
    if (high < low) high = low + 100
    label = goal === 'recomp' ? 'Suggested range (mild deficit)' : 'Suggested range (fat loss)'
  } else if (goal === 'muscle') {
    low = Math.round(maintenance + 200)
    high = Math.round(maintenance + 350)
    label = 'Suggested range (muscle gain)'
  } else if (goal === 'strength') {
    low = Math.round(maintenance + 100)
    high = Math.round(maintenance + 250)
    label = 'Suggested range (strength)'
  } else if (goal === 'maintain') {
    low = Math.round(maintenance - 100)
    high = Math.round(maintenance + 100)
    label = 'Suggested range (maintain)'
  } else {
    low = Math.round(maintenance - 150)
    high = Math.round(maintenance + 150)
    label = 'Suggested range (general fitness)'
  }

  return { maintenance, low, high, label, bmr: estimateBmr(profile, weightKg) }
}

/** Rough protein target g/day from bodyweight (estimate). */
export function proteinSuggestion(profile, weightKg) {
  if (!(weightKg > 0)) return null
  const goal = profile?.goal
  let perKg = 1.6
  if (goal === 'muscle' || goal === 'recomp' || goal === 'strength') perKg = 1.8
  if (goal === 'fatloss') perKg = 2.0
  if (goal === 'fitness' || goal === 'maintain') perKg = 1.4
  return Math.round(weightKg * perKg)
}

/**
 * Resistance-training calorie burn estimate (MET × kg × hours).
 * Clearly approximate — not a measured EE.
 */
export function estimateWorkoutKcal(w, S) {
  const kg = currentWeightKg(S)
  if (!(kg > 0) || !w?.start || !w?.end) return null
  const hours = Math.max(0.15, (w.end - w.start) / 3600000)
  // ~5 MET for typical lifting; nudge up if volume is high relative to duration
  let met = 5
  const sets = (w.entries || []).reduce((n, e) => n + (e.sets || []).filter(s => s.done).length, 0)
  if (sets / Math.max(hours * 60, 1) > 0.35) met = 5.5
  if ((w.vol || 0) / kg > 80) met = Math.max(met, 5.5)
  return Math.round(met * kg * hours)
}

export function formatKcalRange(low, high) {
  if (low == null) return '—'
  if (high == null || high === low) return `~${low} kcal/day`
  return `~${low}–${high} kcal/day`
}
