// Short personalized insights for Home — rule-based, suggestion-only.
import { EXIDX } from './exercises.js'
import { fmtNum } from './format.js'
import { lastBW, streakWeeks } from './history.js'
import { hasProfile, goalWeight, goalLabel } from './profile.js'
import { overloadTip } from './plan-gen.js'
import { best1RM } from './onerm.js'

export function homeInsight(S) {
  if (!S) return null

  // Goal weight progress
  if (hasProfile(S) && (S.profile.goal === 'fatloss' || S.profile.goal === 'muscle' || S.profile.goal === 'recomp')) {
    const cur = lastBW(S)?.w
    const goal = goalWeight(S)
    if (cur != null && goal != null) {
      const rem = Math.round((goal - cur) * 10) / 10
      if (S.profile.goal === 'fatloss' && rem < 0) {
        return { text: `You're on track with your weight-loss goal — ${fmtNum(Math.abs(rem))} ${S.unit} remaining.` }
      }
      if (S.profile.goal === 'muscle' && rem > 0) {
        return { text: `${fmtNum(rem)} ${S.unit} to your target weight of ${fmtNum(goal)} ${S.unit}.` }
      }
      if (Math.abs(rem) < 0.3) {
        return { text: `You're at your target weight (${fmtNum(goal)} ${S.unit}).` }
      }
    }
  }

  // Strength tip from a recent lift
  const recentIds = []
  for (let i = S.workouts.length - 1; i >= 0 && recentIds.length < 8; i--) {
    S.workouts[i].entries.forEach(e => { if (!recentIds.includes(e.id)) recentIds.push(e.id) })
  }
  for (const id of recentIds) {
    const tip = overloadTip(S, id)
    if (tip && (tip.kind === 'up' || tip.kind === 'hold' || tip.kind === 'down')) {
      const name = (EXIDX[id] || {}).n || id
      return {
        text: `${name}: ${tip.text}`,
        kind: tip.kind,
        exId: id
      }
    }
  }

  // 8-week strength delta on top lift with history
  for (const id of recentIds) {
    const pts = []
    S.workouts.forEach(w => {
      const en = w.entries.find(e => e.id === id)
      if (!en) return
      const mx = Math.max(0, ...en.sets.filter(s => s.done).map(s => s.w || 0))
      if (mx > 0) pts.push({ t: w.start || 0, y: mx })
    })
    if (pts.length < 3) continue
    const cutoff = Date.now() - 56 * 86400000
    const old = pts.filter(p => p.t && p.t < cutoff)
    const recent = pts.filter(p => !p.t || p.t >= cutoff)
    if (!old.length || !recent.length) continue
    const delta = recent[recent.length - 1].y - old[0].y
    if (Math.abs(delta) >= 2.5) {
      const name = (EXIDX[id] || {}).n || id
      const dir = delta > 0 ? 'up' : 'down'
      return {
        text: `Your ${name} is ${dir} ${fmtNum(Math.abs(delta))} ${S.unit} over the last 8 weeks.`,
        kind: dir === 'up' ? 'up' : 'down'
      }
    }
  }

  const streak = streakWeeks(S)
  if (streak >= 2) return { text: `You're on a ${streak}-week streak — keep the rhythm going.` }

  if (hasProfile(S)) {
    return { text: `Goal: ${goalLabel(S.profile.goal)}. Start today's workout to keep progressing.` }
  }

  return { text: 'Set up your training profile for a personalized plan and calorie estimates.' }
}

/** Best-effort PR list for Progress. */
export function prHistory(S, limit = 12) {
  const rows = []
  Object.entries(S.exWeights || {}).forEach(([id, v]) => {
    if (!(v?.w > 0) || !EXIDX[id]) return
    const e1 = best1RM(S, id)
    rows.push({
      id,
      name: EXIDX[id].n,
      weight: v.w,
      d: v.d,
      e1rm: e1?.est || null
    })
  })
  rows.sort((a, b) => (b.d || '').localeCompare(a.d || ''))
  return rows.slice(0, limit)
}
