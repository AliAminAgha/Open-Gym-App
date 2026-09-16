// Energy estimates — Mifflin-St Jeor BMR + activity TDEE + goal-based bands.
// Fat-loss deficit scales with the user's chosen loss amount and pace.
// Every output is an estimate; UI must label them as such.

import { ACTIVITY, currentWeightKg, heightCmOf, lossAmountKg, LOSS_PACE } from './profile.js'

const KG_CAL = 7700

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

function paceDeficit(profile, goal) {
  const pace = LOSS_PACE.find(p => p.id === (profile?.lossPace || 'moderate')) || LOSS_PACE[1]
  let kgPerWeek = pace.kgPerWeek
  if (goal === 'recomp') kgPerWeek *= 0.65
  return Math.round((kgPerWeek * KG_CAL) / 7)
}

function fatLossRange(maintenance, bmr, dailyDeficit) {
  const deficit = Math.min(750, Math.max(200, dailyDeficit))
  let low = Math.max(Math.round(bmr * 1.15), maintenance - deficit - 50)
  let high = maintenance - deficit + 50
  if (high >= maintenance) high = maintenance - 150
  if (high < low) high = low + 100
  return { low, high, dailyDeficit: deficit }
}

/**
 * Conservative calorie suggestion for the user's goal.
 * Returns { maintenance, low, high, label, dailyDeficit?, weeksToGoal? } — all estimates.
 */
export function calorieSuggestion(profile, weightKg, unit = 'kg') {
  const maintenance = estimateTdee(profile, weightKg)
  if (!maintenance) return null
  const bmr = estimateBmr(profile, weightKg)
  const goal = profile?.goal || 'fitness'
  let low = maintenance
  let high = maintenance
  let label = 'Estimated maintenance'
  let dailyDeficit = null
  let weeksToGoal = null

  if (goal === 'fatloss' || goal === 'recomp') {
    dailyDeficit = paceDeficit(profile, goal)
    const lossKg = lossAmountKg(profile, weightKg, unit)
    if (lossKg > 0) {
      const pace = LOSS_PACE.find(p => p.id === (profile?.lossPace || 'moderate')) || LOSS_PACE[1]
      let kgPerWeek = pace.kgPerWeek
      if (goal === 'recomp') kgPerWeek *= 0.65
      weeksToGoal = Math.max(1, Math.ceil(lossKg / kgPerWeek))
    }
    const band = fatLossRange(maintenance, bmr || maintenance * 0.7, dailyDeficit)
    low = band.low
    high = band.high
    dailyDeficit = band.dailyDeficit
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

  return { maintenance, low, high, label, bmr, dailyDeficit, weeksToGoal }
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
 * Daily macro split from a calorie target + protein goal.
 * Fat ~0.8–1.0 g/kg, protein from proteinSuggestion, remainder carbs.
 * Returns { kcal, protein, carbs, fat } in grams (kcal is the single intake number).
 */
export function macroSuggestion(profile, weightKg, calorieTarget) {
  if (!(weightKg > 0) || !(calorieTarget > 0)) return null
  const protein = proteinSuggestion(profile, weightKg) || Math.round(weightKg * 1.6)
  const goal = profile?.goal
  let fatPerKg = 0.9
  if (goal === 'fatloss') fatPerKg = 0.8
  if (goal === 'muscle' || goal === 'strength') fatPerKg = 1.0
  let fat = Math.round(weightKg * fatPerKg)
  const proteinKcal = protein * 4
  let fatKcal = fat * 9
  // Keep room for carbs (≥20% of calories)
  const maxFatKcal = Math.round(calorieTarget * 0.35)
  if (fatKcal > maxFatKcal) {
    fat = Math.max(20, Math.round(maxFatKcal / 9))
    fatKcal = fat * 9
  }
  const carbKcal = Math.max(0, calorieTarget - proteinKcal - fatKcal)
  const carbs = Math.round(carbKcal / 4)
  return { kcal: Math.round(calorieTarget), protein, carbs, fat }
}

/**
 * Ideal / goal-aware target weight in the display unit (BMI ~22 as a healthy anchor).
 * Fat loss → toward ideal if above it; muscle → toward ideal if below, else a small surplus.
 */
export function suggestedTargetWeight(heightCm, currentW, unit, goal) {
  if (!(heightCm > 0) || !(currentW > 0)) return null
  const h = heightCm / 100
  const idealKg = 22 * h * h
  const ideal = unit === 'lb' ? idealKg / 0.453592 : idealKg
  const round = w => Math.round(w * 10) / 10
  if (goal === 'fatloss') {
    if (currentW > ideal + 0.5) return round(ideal)
    const step = unit === 'lb' ? 5 : 2
    return round(Math.max(ideal * 0.95, currentW - step))
  }
  if (goal === 'muscle') {
    if (currentW < ideal - 0.5) return round(ideal)
    const step = unit === 'lb' ? 8 : 4
    return round(currentW + step)
  }
  return round(ideal)
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
