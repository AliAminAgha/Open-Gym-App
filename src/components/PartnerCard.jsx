import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DEMO } from '../lib/demo.js'
import { seedDemoPartnerIfEmpty } from '../lib/partner.js'
import { buildPartnerSummary, buildWeekActivity } from '../lib/partner-summary.js'
import { streakWeeks } from '../lib/history.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { partnerSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'

function myStats(S) {
  const monthPrefix = todayISO().slice(0, 7)
  return {
    streak: streakWeeks(S),
    month: S.workouts.filter(w => w.d.slice(0, 7) === monthPrefix).length,
    today: S.workouts.some(w => w.d === todayISO())
  }
}

function WeekDots({ activity, side }) {
  if (!activity?.length) return null
  return (
    <div className={'partner-week' + (side ? ' ' + side : '')}>
      {activity.map((done, i) => (
        <div key={i} className={'partner-dot' + (done ? ' done' : '')} />
      ))}
    </div>
  )
}

export default function PartnerCard() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const partner = useStore(s => s.partner)
  const setPartner = useStore(s => s.setPartner)
  const [open, setOpen] = useState(false)
  const mine = myStats(S)

  useEffect(() => {
    if (DEMO && !partner) seedDemoPartnerIfEmpty(setPartner)
  }, [partner, setPartner])

  if (!partner?.summary) {
    return (
      <button type="button" className="partner-card partner-empty" onClick={partnerSheet}>
        <span className="partner-empty-icon"><Icon name="link" /></span>
        <div className="partner-empty-body">
          <div className="partner-empty-title">{t('Link your partner')}</div>
          <div className="partner-empty-sub">{t('See each other’s streaks and goal progress')}</div>
        </div>
        <Icon name="chevronRight" className="chev" />
      </button>
    )
  }

  const ps = partner.summary
  const goalLine = ps.goal
    ? `${ps.goal.typeLabel || ps.goal.type} · ${fmtNum(Math.abs(ps.goal.toGoal))} ${ps.goal.unit || S.unit} ${t('to goal')}`
    : null

  const partnerAccent = ps.accent || '#ff2d9a'
  const myWeek = buildWeekActivity(S.workouts)

  return (
    <div
      className={'partner-card' + (open ? ' open' : '')}
      style={{ '--partner-acc': partnerAccent }}
    >
      <div className="partner-bar">
        <button type="button" className="partner-bar-main" onClick={() => nav('/partner')}>
          <span className="partner-name">
            <span className="partner-accent-dot" aria-hidden />
            {partner.name || t('Partner')}
          </span>
          <span className="partner-bar-mini">
            <span className="partner-bar-stat you"><Icon name="flame" />{mine.streak}</span>
            <span className="partner-bar-vs">{t('vs')}</span>
            <span className="partner-bar-stat them"><Icon name="flame" />{ps.streakWeeks}</span>
          </span>
        </button>
        <button
          type="button"
          className={'partner-go' + (open ? ' open' : '')}
          onClick={() => setOpen(o => !o)}
          aria-label={t('Partner progress')}
          aria-expanded={open}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} />
        </button>
      </div>

      <div className="partner-expand">
        <div className="partner-expand-inner">
          <div className="partner-compare">
            <div className="partner-col you">
              <div className="partner-label">{t('You')}</div>
              <div className="partner-stat"><Icon name="flame" />{mine.streak}</div>
              <div className="partner-stat-sub">{t('This month')}: {mine.month}</div>
              <div className={'partner-today' + (mine.today ? ' on' : '')}>
                {mine.today ? t('Trained today') : t('Not yet today')}
              </div>
            </div>
            <div className="partner-vs">vs</div>
            <div className="partner-col them">
              <div className="partner-label">{partner.name || t('Partner')}</div>
              <div className="partner-stat"><Icon name="flame" />{ps.streakWeeks}</div>
              <div className="partner-stat-sub">{t('This month')}: {ps.workoutsThisMonth}</div>
              <div className={'partner-today' + (ps.trainedToday ? ' on' : '')}>
                {ps.trainedToday ? t('Trained today') : t('Not yet today')}
              </div>
            </div>
          </div>

          <div className="partner-weeks">
            <WeekDots activity={myWeek} side="you" />
            <WeekDots activity={ps.weekActivity} side="them" />
          </div>
          {goalLine && <div className="partner-goal them-goal dim small">{goalLine}</div>}
          <button type="button" className="partner-detail-link" onClick={() => nav('/partner')}>
            {t('Full comparison')} <Icon name="chevronRight" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Stats for the detail view — includes full week activity for both sides. */
export function partnerDetailStats(S, partnerSummary) {
  const mine = buildPartnerSummary(S, t('You'))
  return { mine, theirs: partnerSummary }
}
