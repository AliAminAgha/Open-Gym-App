import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { lastBW } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { hasProfile, goalWeight, goalLabel, currentWeightKg } from '../lib/profile.js'
import { calorieSuggestion } from '../lib/calories.js'
import Icon from './Icon.jsx'

export default function GoalSummary() {
  const nav = useNavigate()
  const S = useStore(s => s.S)

  if (!hasProfile(S)) return null

  const cur = lastBW(S)?.w
  const goal = goalWeight(S)
  const g = S.profile.goal
  const showGoal = cur != null && goal != null && (g === 'fatloss' || g === 'muscle' || g === 'recomp' || g === 'maintain')
  if (!showGoal) return null

  const rem = Math.round((goal - cur) * 10) / 10
  const cals = calorieSuggestion(S.profile, currentWeightKg(S), S.unit)
  const weeks = cals?.weeksToGoal

  return (
    <button type="button" className="home-goal" onClick={() => nav('/stats')}>
      <span className="home-goal-icon"><Icon name="target" /></span>
      <div className="home-goal-body">
        <div className="home-goal-line1">
          <span className="v">{fmtNum(Math.abs(rem))} {S.unit}</span>
          <span className="tag">{t('to goal')}</span>
        </div>
        <div className="home-goal-line2">
          {goalLabel(g)} · {fmtNum(cur)} → {fmtNum(goal)} {S.unit}
          {weeks != null && <> · {t('~{0} wk', weeks)}</>}
        </div>
      </div>
      <Icon name="chevronRight" className="chev" />
    </button>
  )
}
