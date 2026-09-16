// Rule-based weekly plan + exercise picker. No AI — curated pools + filters.
import { EXIDX } from './exercises.js'
import { uid, DAYN } from './format.js'
import { defaultIncrement, nextPrescription } from './progression.js'
import { lastEntryFor, bestWeightFor } from './history.js'
import { goalLabel, experienceLabel } from './profile.js'
import { mergePlan } from './plan-share.js'

/* ---- Curated movement pools (ids from exercises-data) ---- */
const POOLS = {
  squat: ['0043', '1760', '0048', '0174', '0592', '0046'],
  hinge: ['0085', '0032', '0116', '0300', '1459', '0811'],
  lunge: ['0287', '0290', '0416', '1459'],
  horizontalPress: ['0025', '0289', '0047', '0234', '0308', '1254'],
  inclinePress: ['0047', '0308', '0314', '1299'],
  verticalPress: ['0054', '0405', '0334', '0297'],
  horizontalPull: ['0027', '0293', '0238', '1323'],
  verticalPull: ['2330', '0198', '0652', '0007', '0017'],
  curl: ['0294', '0285', '0393', '0241'],
  tricep: ['0251', '0241', '0333', '0426'],
  lateralRaise: ['0334', '0381', '0298'],
  rearDelt: ['0313', '0238', '0027'],
  calf: ['0585', '0586', '1372'],
  core: ['0001', '0002', '0274', '0464', '0872'],
  glute: ['0043', '0085', '0597', '0605', '0739']
}

const HOME_EQ = new Set(['body weight', 'dumbbell', 'kettlebell', 'band', 'medicine ball', 'stability ball', 'ez barbell'])

function eqOk(ex, equipment, location) {
  if (!ex?.eq) return false
  if (equipment?.length) return equipment.includes(ex.eq)
  if (location === 'home') return HOME_EQ.has(ex.eq) || ex.eq === 'body weight'
  return true
}

function pickFrom(pool, { equipment, location, avoid, used, favorites }) {
  const avoidSet = new Set(avoid || [])
  const usedSet = used || new Set()
  const rank = id => {
    if (!EXIDX[id] || avoidSet.has(id) || usedSet.has(id)) return -1
    if (!eqOk(EXIDX[id], equipment, location)) return -1
    let s = 10
    if ((favorites || []).includes(id)) s += 20
    // Prefer matching equipment when gym has barbells etc.
    if (equipment?.length && equipment.includes(EXIDX[id].eq)) s += 5
    return s
  }
  let best = null, bestS = -1
  for (const id of pool) {
    const s = rank(id)
    if (s > bestS) { bestS = s; best = id }
  }
  // Fallback: search EXIDX by first pool exercise's target muscle if nothing matched
  if (!best) {
    for (const id of Object.keys(EXIDX)) {
      if (avoidSet.has(id) || usedSet.has(id)) continue
      if (!eqOk(EXIDX[id], equipment, location)) continue
      const tg = EXIDX[pool[0]]?.tg
      if (tg && EXIDX[id].tg === tg) { best = id; break }
    }
  }
  if (best) usedSet.add(best)
  return best
}

function altFor(id, ctx) {
  const ex = EXIDX[id]
  if (!ex) return null
  // Same target, different equipment preferred
  const cand = Object.values(EXIDX).find(e =>
    e.id !== id && e.tg === ex.tg && e.bp === ex.bp &&
    !ctx.used.has(e.id) && !(ctx.avoid || []).includes(e.id) &&
    eqOk(e, ctx.equipment, ctx.location) && e.eq !== ex.eq
  )
  return cand?.id || null
}

/** Sets × rep range from goal + experience. */
export function schemeFor(profile, role = 'compound') {
  const xp = profile?.experience || 'beginner'
  const goal = profile?.goal || 'fitness'
  if (goal === 'strength') {
    if (role === 'isolation') return { sets: xp === 'beginner' ? 2 : 3, reps: 6, repsMin: 4, restLabel: '2–3 min' }
    return { sets: xp === 'advanced' ? 5 : 4, reps: 5, repsMin: 3, restLabel: '3–5 min' }
  }
  if (goal === 'muscle' || goal === 'recomp') {
    if (role === 'isolation') return { sets: 3, reps: 12, repsMin: 10, restLabel: '60–90 s' }
    return { sets: xp === 'beginner' ? 3 : 4, reps: 10, repsMin: 6, restLabel: '2–3 min' }
  }
  if (goal === 'fatloss' || goal === 'fitness') {
    if (role === 'isolation') return { sets: 2, reps: 15, repsMin: 12, restLabel: '45–60 s' }
    return { sets: 3, reps: 12, repsMin: 8, restLabel: '60–90 s' }
  }
  // maintain
  return { sets: 3, reps: 10, repsMin: 8, restLabel: '90–120 s' }
}

/** How many exercises fit the session length. */
function exerciseBudget(sessionMin, experience) {
  if (sessionMin <= 30) return experience === 'beginner' ? 4 : 5
  if (sessionMin <= 45) return 6
  if (sessionMin <= 60) return 7
  return 8
}

function resolveStyle(profile) {
  if (profile.style && profile.style !== 'custom') return profile.style
  const d = profile.daysPerWeek || 3
  if (d <= 3) return 'fullbody'
  if (d === 4) return 'upperlower'
  return 'ppl'
}

function daySlots(profile) {
  const n = Math.min(6, Math.max(2, profile.daysPerWeek || 3))
  let days = [...(profile.preferredDays || [])].filter(d => d >= 0 && d <= 6)
  if (days.length < n) {
    const defaults = [1, 2, 3, 4, 5, 6, 0]
    for (const d of defaults) if (!days.includes(d) && days.length < n) days.push(d)
  }
  return days.slice(0, n).sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
}

const TEMPLATES = {
  fullbody: {
    roles: [
      ['squat', 'compound'], ['horizontalPress', 'compound'], ['horizontalPull', 'compound'],
      ['hinge', 'compound'], ['verticalPress', 'compound'], ['core', 'isolation'], ['curl', 'isolation']
    ],
    name: 'Full Body', emoji: 'figureStrength'
  },
  upper: {
    roles: [
      ['horizontalPress', 'compound'], ['verticalPull', 'compound'], ['inclinePress', 'compound'],
      ['horizontalPull', 'compound'], ['verticalPress', 'compound'], ['tricep', 'isolation'], ['curl', 'isolation']
    ],
    name: 'Upper Body', emoji: 'arm'
  },
  lower: {
    roles: [
      ['squat', 'compound'], ['hinge', 'compound'], ['lunge', 'compound'],
      ['glute', 'compound'], ['calf', 'isolation'], ['core', 'isolation']
    ],
    name: 'Lower Body', emoji: 'legs'
  },
  push: {
    roles: [
      ['horizontalPress', 'compound'], ['inclinePress', 'compound'], ['verticalPress', 'compound'],
      ['lateralRaise', 'isolation'], ['tricep', 'isolation'], ['core', 'isolation']
    ],
    name: 'Push', emoji: 'barbell'
  },
  pull: {
    roles: [
      ['verticalPull', 'compound'], ['horizontalPull', 'compound'], ['hinge', 'compound'],
      ['rearDelt', 'isolation'], ['curl', 'isolation'], ['core', 'isolation']
    ],
    name: 'Pull', emoji: 'pullup'
  },
  legs: {
    roles: [
      ['squat', 'compound'], ['hinge', 'compound'], ['lunge', 'compound'],
      ['glute', 'compound'], ['calf', 'isolation'], ['core', 'isolation']
    ],
    name: 'Legs', emoji: 'legs'
  }
}

function buildRoutine(key, profile, ctx, S, displayName) {
  const tpl = TEMPLATES[key]
  const budget = exerciseBudget(profile.sessionMin || 45, profile.experience)
  const roles = tpl.roles.slice(0, budget)
  const ex = []
  for (const [poolKey, role] of roles) {
    const id = pickFrom(POOLS[poolKey] || [], ctx)
    if (!id) continue
    const scheme = schemeFor(profile, role)
    const weight = suggestStartWeight(S, profile, id)
    const alt = altFor(id, ctx)
    const row = {
      id,
      sets: scheme.sets,
      reps: scheme.reps,
      ...(scheme.repsMin ? { repsMin: scheme.repsMin } : {}),
      ...(weight > 0 ? { weight } : {}),
      prog: profile.goal === 'strength' ? 'linear' : 'double',
      _meta: {
        role,
        restLabel: scheme.restLabel,
        alt,
        why: whyExercise(profile, id, poolKey)
      }
    }
    ex.push(row)
  }
  return {
    id: uid(),
    name: displayName || 'Workout',
    emoji: tpl.emoji,
    prog: profile.goal === 'strength' ? 'linear' : 'double',
    ex,
    _meta: { key, muscles: musclesOf(ex) }
  }
}

function musclesOf(exList) {
  const set = new Set()
  exList.forEach(e => {
    const x = EXIDX[e.id]
    if (x?.tg) set.add(x.tg)
    ;(x?.sm || []).slice(0, 2).forEach(s => set.add(s))
  })
  return [...set].slice(0, 5)
}

export function whyExercise(profile, id, poolKey) {
  const ex = EXIDX[id]
  const bits = []
  if (ex?.tg) bits.push(`Targets ${ex.tg}`)
  if (ex?.eq) bits.push(`Uses ${ex.eq}`)
  if ((profile.favorites || []).includes(id)) bits.push('On your favorites list')
  if (profile.goal === 'strength' && /squat|press|hinge|horizontalPress|verticalPull/.test(poolKey || '')) {
    bits.push('Compound lift — good for strength')
  }
  if (profile.goal === 'muscle') bits.push('Fits a hypertrophy rep scheme')
  if (profile.location === 'home') bits.push('Works with home equipment')
  return bits.slice(0, 4)
}

/**
 * Suggest starting load. Uses history / exWeights when present; else a conservative estimate.
 */
export function suggestStartWeight(S, profile, exId) {
  if (!S) return 0
  const best = bestWeightFor(S, exId)
  if (best > 0) {
    // Slight bump if last session looked solid — else last known
    const last = lastEntryFor(S, exId)
    if (last?.sets?.length) {
      const done = last.sets.filter(s => s.done && s.w > 0)
      if (done.length) {
        const top = Math.max(...done.map(s => s.w))
        const hit = done.every(s => (s.r || 0) >= 8)
        if (hit) return Math.round((top + defaultIncrement(exId, S.unit || 'kg')) * 10) / 10
        return top
      }
    }
    return best
  }
  const fromMem = (S.exWeights?.[exId] || {}).w
  if (fromMem > 0) return fromMem

  // No history — rough estimate by experience (labeled as estimate in UI)
  const ex = EXIDX[exId]
  if (!ex || ex.eq === 'body weight') return 0
  const xp = profile?.experience || 'beginner'
  const unit = S.unit || 'kg'
  const base = {
    beginner: unit === 'lb' ? 45 : 20,
    intermediate: unit === 'lb' ? 95 : 40,
    advanced: unit === 'lb' ? 135 : 60
  }[xp] || 20
  const heavy = ['upper legs', 'back', 'hips'].includes(ex.bp)
  const light = ['shoulders', 'upper arms', 'lower arms'].includes(ex.bp)
  let w = heavy ? base * 1.4 : light ? base * 0.55 : base
  if (ex.eq === 'dumbbell') w *= 0.45
  if (ex.eq === 'cable' || ex.eq === 'leverage machine') w *= 0.7
  return Math.round(w / 2.5) * 2.5
}

export function whyPlan(profile) {
  const days = profile.daysPerWeek || 3
  const goal = goalLabel(profile.goal)
  const mins = profile.sessionMin || 45
  const xp = experienceLabel(profile.experience) || 'not set'
  return `You train ${days} days per week (~${mins} min) and want to ${goal.toLowerCase() || 'improve'}. ` +
    `Experience level: ${xp}. Exercises are picked to match your goal and equipment — tweak anything anytime.`
}

/**
 * Build a preview plan (routines + week map using temporary ids) and explanation.
 * Does not mutate store.
 */
export function generatePlan(profile, S = null) {
  const style = resolveStyle(profile)
  const days = daySlots(profile)
  const ctx = {
    equipment: profile.equipment?.length ? profile.equipment : null,
    location: profile.location || 'gym',
    avoid: profile.avoid || [],
    favorites: profile.favorites || [],
    used: new Set()
  }

  let keys = []
  if (style === 'fullbody') keys = days.map(() => 'fullbody')
  else if (style === 'upperlower') keys = days.map((_, i) => (i % 2 === 0 ? 'upper' : 'lower'))
  else keys = days.map((_, i) => ['push', 'pull', 'legs'][i % 3])

  // One routine per training day, named by weekday — no Push/Pull/Full Body labels in the UI.
  const routines = []
  const week = {}
  keys.forEach((key, i) => {
    const day = days[i]
    ctx.used = new Set()
    const r = buildRoutine(key, profile, ctx, S, DAYN[day])
    routines.push(r)
    week[day] = r.id
  })

  const estMin = profile.sessionMin || 45
  return {
    style,
    routines,
    week,
    days,
    summary: {
      goal: goalLabel(profile.goal),
      experience: experienceLabel(profile.experience),
      frequency: `${days.length} days/week`,
      session: `~${estMin} min`
    },
    why: whyPlan(profile)
  }
}

/** Apply generated plan into store draft `s` (replace week schedule). */
export function applyGeneratedPlanToState(s, plan, { replace = true } = {}) {
  if (replace) {
    s.routines = []
    s.week = {}
    s.dayPlan = {}
  }
  const bundle = {
    opengym_plan: 1,
    week: { ...plan.week },
    routines: plan.routines.map(r => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      prog: r.prog,
      ex: r.ex.map(({ id, sets, reps, repsMin, weight, prog }) => ({
        id, sets, reps, ...(repsMin ? { repsMin } : {}), ...(weight > 0 ? { weight } : {}), ...(prog ? { prog } : {})
      }))
    })),
    customEx: []
  }
  return mergePlan(s, bundle, { schedule: true })
}

/** Adaptive tip for one exercise from history (suggestion only). */
export function overloadTip(S, exId) {
  if (!S || !exId) return null
  const plan = nextPrescription(S, { id: exId, sets: 3, reps: 8, prog: 'linear' }, null)
  if (!plan || plan.kind === 'off' || plan.kind === 'first') {
    if (plan?.kind === 'first') return { kind: 'estimate', text: 'No history yet — use the starting estimate and adjust.' }
    return null
  }
  const unit = S.unit || 'kg'
  if (plan.kind === 'up' && plan.weight != null) {
    return { kind: 'up', text: `Try ${plan.weight} ${unit} next session.`, why: plan.why }
  }
  if (plan.kind === 'hold') {
    return { kind: 'hold', text: `Keep ${plan.weight != null ? plan.weight + ' ' + unit : 'the same weight'} — still in range.`, why: plan.why }
  }
  if (plan.kind === 'deload' && plan.weight != null) {
    return { kind: 'down', text: `Consider ${plan.weight} ${unit} after missed targets.`, why: plan.why }
  }
  return null
}

export function formatDayPlan(plan) {
  return (plan.days || []).map(d => {
    const rid = plan.week[d]
    const r = plan.routines.find(x => x.id === rid)
    return { day: d, dayName: DAYN[d], routine: r }
  })
}
