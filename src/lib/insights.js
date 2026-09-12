// Lightweight training insights for Home / Finish / Workout — pure helpers, no store writes.
import { EXIDX } from './exercises.js'
import { loadOfRoutine, MUSCLE_NAME, rankOf } from './muscles.js'
import { workoutVolume, modeOf } from './history.js'
import { fmtNum } from './format.js'

/** Rough session length from planned sets (~2.5 min per set incl. rest). */
export function estimateMinutes(routine) {
  if (!routine?.ex?.length) return 0
  const sets = routine.ex.reduce((n, e) => n + (e.sets || 3), 0)
  return Math.max(15, Math.round(sets * 2.5))
}

/** Top muscle labels for a routine (translated by caller via t()). */
export function routineMuscles(routine, limit = 4) {
  const load = loadOfRoutine(routine)
  const { worked } = rankOf(load)
  return worked.slice(0, limit).map(id => MUSCLE_NAME[id] || id)
}

export function lastWorkoutForRoutine(S, routineId) {
  if (!routineId) return null
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    if (S.workouts[i].routineId === routineId) return S.workouts[i]
  }
  return null
}

/** Volume delta vs previous session of the same routine. */
export function volumeCompare(w, S) {
  const prev = [...S.workouts].reverse().find(x => x.id !== w.id && x.routineId && x.routineId === w.routineId)
  if (!prev || !prev.vol) return null
  const cur = w.vol || workoutVolume(w)
  if (!cur) return null
  const pct = Math.round(((cur - prev.vol) / prev.vol) * 100)
  if (!isFinite(pct) || pct === 0) return { pct: 0, prev, cur }
  return { pct, prev, cur }
}

/** Compare current set target to last session's matching set — for in-workout cue. */
export function setVsLast(entry, setIdx, lastEntry) {
  if (!lastEntry?.sets?.length) return null
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  if (mode !== 'reps') return null
  const cur = entry.sets[setIdx]
  const prev = lastEntry.sets[Math.min(setIdx, lastEntry.sets.length - 1)]
  if (!cur || !prev || !(prev.w > 0)) return null
  const wSame = Math.abs((cur.w || 0) - (prev.w || 0)) < 0.05
  const rDiff = (cur.r || 0) - (prev.r || 0)
  const wDiff = (cur.w || 0) - (prev.w || 0)
  return { prev, cur, wSame, rDiff, wDiff, mode }
}

export function formatOverloadCue(cmp, unit, t) {
  if (!cmp) return null
  const { prev, wSame, rDiff, wDiff } = cmp
  const last = `${fmtNum(prev.w)} ${unit} × ${prev.r}`
  if (wSame && rDiff > 0) return { last, today: `${fmtNum(cmp.cur.w)} ${unit} × ${cmp.cur.r} ↑`, kind: 'up' }
  if (wDiff > 0) return { last, today: `${fmtNum(cmp.cur.w)} ${unit} × ${cmp.cur.r} ↑`, kind: 'up' }
  if (wDiff < 0 || rDiff < 0) return { last, today: `${fmtNum(cmp.cur.w)} ${unit} × ${cmp.cur.r}`, kind: 'down' }
  return { last, today: `${fmtNum(cmp.cur.w)} ${unit} × ${cmp.cur.r}`, kind: 'same' }
}

/** Soft next-session target when today already beats last at the same load. */
export function nextSessionHint(cmp, unit, step = 2.5) {
  if (!cmp?.prev || !(cmp.prev.w > 0)) return null
  const { prev, cur, wSame, rDiff, wDiff } = cmp
  if (wSame && rDiff > 0) {
    const nw = Math.round((prev.w + step) * 10) / 10
    return `${fmtNum(nw)} ${unit} × ${prev.r}`
  }
  if (wDiff > 0 && (cur.r || 0) >= (prev.r || 0)) {
    return `${fmtNum(cur.w)} ${unit} × ${prev.r}`
  }
  return null
}

export function prLabel(id) {
  return (EXIDX[id] || {}).n || id
}
