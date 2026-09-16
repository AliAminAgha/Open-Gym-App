// Privacy-safe progress snapshot for partner sharing — no workout logs or weight history.
import { todayISO, isoOf } from './format.js'
import { streakWeeks, lastBW } from './history.js'
import { hasProfile, goalWeight, goalLabel, currentWeightKg } from './profile.js'
import { calorieSuggestion } from './calories.js'
import { t } from './i18n.js'

export const PARTNER_FMT = 1

/** Mon–Sun trained? for the calendar week containing `today`. */
export function buildWeekActivity(workouts, today = new Date()) {
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const doneDays = new Set((workouts || []).map(w => w.d))
  const activity = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    activity.push(doneDays.has(isoOf(d)))
  }
  return activity
}

export function buildGoalSummary(S) {
  if (!hasProfile(S)) return null
  const cur = lastBW(S)?.w
  const goal = goalWeight(S)
  const g = S.profile.goal
  const showGoal = cur != null && goal != null && (g === 'fatloss' || g === 'muscle' || g === 'recomp' || g === 'maintain')
  if (!showGoal) return null
  const rem = Math.round((goal - cur) * 10) / 10
  const cals = calorieSuggestion(S.profile, currentWeightKg(S), S.unit)
  return {
    type: g,
    typeLabel: goalLabel(g),
    currentW: cur,
    targetW: goal,
    toGoal: rem,
    weeks: cals?.weeksToGoal ?? null,
    unit: S.unit || 'kg'
  }
}

/** Build the shareable partner summary from live state. */
export function buildPartnerSummary(S, name) {
  const workouts = S.workouts || []
  const monthPrefix = todayISO().slice(0, 7)
  const sorted = [...workouts].sort((a, b) => b.d.localeCompare(a.d) || (b.end || 0) - (a.end || 0))
  const today = todayISO()
  return {
    opengym_partner: PARTNER_FMT,
    name: name || '',
    exported: today,
    streakWeeks: streakWeeks(S),
    workoutsThisMonth: workouts.filter(w => w.d.slice(0, 7) === monthPrefix).length,
    totalWorkouts: workouts.length,
    weekActivity: buildWeekActivity(workouts),
    goal: buildGoalSummary(S),
    lastWorkoutDate: sorted[0]?.d || null,
    trainedToday: workouts.some(w => w.d === today),
    accent: null
  }
}

/** Validate + normalise an imported summary. Throws with a friendly message. */
export function parsePartnerSummary(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!data || data.opengym_partner !== PARTNER_FMT) {
    throw new Error(t('This isn’t an openGym partner progress link'))
  }
  const weekActivity = Array.isArray(data.weekActivity) ? data.weekActivity.slice(0, 7) : []
  while (weekActivity.length < 7) weekActivity.push(false)
  const goal = data.goal && typeof data.goal === 'object' ? {
    type: data.goal.type || null,
    typeLabel: data.goal.typeLabel || '',
    currentW: data.goal.currentW ?? null,
    targetW: data.goal.targetW ?? null,
    toGoal: data.goal.toGoal ?? null,
    weeks: data.goal.weeks ?? null,
    unit: data.goal.unit || 'kg'
  } : null
  return {
    opengym_partner: PARTNER_FMT,
    name: String(data.name || '').slice(0, 80),
    exported: String(data.exported || todayISO()).slice(0, 10),
    streakWeeks: Math.max(0, Number(data.streakWeeks) || 0),
    workoutsThisMonth: Math.max(0, Number(data.workoutsThisMonth) || 0),
    totalWorkouts: Math.max(0, Number(data.totalWorkouts) || 0),
    weekActivity: weekActivity.map(Boolean),
    goal,
    lastWorkoutDate: data.lastWorkoutDate ? String(data.lastWorkoutDate).slice(0, 10) : null,
    trainedToday: !!data.trainedToday,
    accent: data.accent ? String(data.accent).slice(0, 32) : null
  }
}

export function partnerSummaryId(summary) {
  return (summary.name || 'partner') + '@' + (summary.exported || '')
}
