import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, lastBW, setsDoneActive } from '../../lib/history.js'
import { todayISO, isoOf, DAYN, MONTHS, fmtNum, exCount } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { startFlow, dayOverrideSheet, calendarSheet, workoutDetailSheet, bwSheet } from '../../sheets.jsx'
import { hasProfile, goalWeight, goalLabel, currentWeightKg } from '../../lib/profile.js'
import { calorieSuggestion, macroSuggestion } from '../../lib/calories.js'
import { homeWidgetsOf, optionalHomeCatalog } from '../../lib/home-widgets.js'
import Icon from '../Icon.jsx'
import Heatmap from '../Heatmap.jsx'
import StatsTiles from '../StatsTiles.jsx'
import PartnerCard from '../PartnerCard.jsx'
import { Button } from '../ui.jsx'

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/* ---- Fixed: week strip ---- */
export function HomeWeekWidget() {
  const S = useStore(s => s.S)
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso)
    const ovr = S.dayPlan[iso] !== undefined
    const done = doneDays.has(iso)
    const state = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(
      <button
        key={i}
        type="button"
        className={'hw-wday' + (iso === todayISO() ? ' today' : '') + state}
        onClick={() => dayOverrideSheet(iso)}
      >
        <span className="hw-wday-lab">{t(DAYS_SHORT[d.getDay()])}</span>
        <span className="hw-wday-mark">{done ? <Icon name="check" /> : d.getDate()}</span>
      </button>
    )
  }

  return (
    <section className="hw-card hw-week">
      <div className="hw-week-head">
        <div>
          <div className="hw-kicker">{t('This week')}</div>
          <div className="hw-week-date">
            <span className="hw-week-d">{today.getDate()}</span>
            <span className="hw-week-m">{t(MONTHS[today.getMonth()])}</span>
          </div>
        </div>
        <div className="hw-week-dow">{t(DAYN[today.getDay()])}</div>
      </div>
      <div className="hw-week-strip">{strip}</div>
    </section>
  )
}

/* ---- Fixed: today workout ---- */
export function HomeTodayWidget() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const routine = effectiveRoutine(S, todayISO())
  const estMin = S.profile?.sessionMin || 45
  const activeDone = S.active ? setsDoneActive(S.active) : 0
  const activeTotal = S.active ? S.active.entries.reduce((n, e) => n + e.sets.length, 0) : 0

  const onAction = () => {
    if (S.active) nav('/workout')
    else if (routine) startFlow(routine.id)
    else nav('/plan')
  }

  const title = S.active ? S.active.name : routine ? t('Workout') : t('Rest day')
  const meta = S.active
    ? `${activeDone}/${activeTotal} ${t('sets')}`
    : routine
      ? `${exCount(routine.ex.length)} · ~${estMin} ${t('min')}`
      : t('Nothing scheduled — enjoy the rest')
  const cta = S.active ? t('Resume') : routine ? t('Start workout') : t('View plan')

  return (
    <section className={'hw-card hw-today' + (S.active ? ' live' : '')}>
      <div className="hw-kicker">{S.active ? t('In progress') : t('Today')}</div>
      <div className="hw-today-row">
        <div className="hw-today-copy">
          <h2 className="hw-title">{title}</h2>
          <p className="hw-sub">{meta}</p>
        </div>
        <div className={'hw-today-ico' + (routine || S.active ? '' : ' rest')} aria-hidden>
          <Icon name={S.active ? 'play' : routine ? 'dumbbell' : 'moon'} />
        </div>
      </div>
      <button type="button" className="hw-cta" onClick={onAction}>
        {cta}
        <Icon name="chevronRight" />
      </button>
    </section>
  )
}

/* ---- Fixed: nutrition from onboarding ---- */
export function HomeNutritionWidget() {
  const nav = useNavigate()
  const S = useStore(s => s.S)

  if (!hasProfile(S)) {
    return (
      <button type="button" className="hw-card hw-nutrition setup" onClick={() => nav('/onboarding')}>
        <div className="hw-kicker">{t('Your plan')}</div>
        <h2 className="hw-title">{t('Finish setup')}</h2>
        <p className="hw-sub">{t('We’ll set calories, macros and your week.')}</p>
        <span className="hw-cta ghost">{t('Get started')}<Icon name="chevronRight" /></span>
      </button>
    )
  }

  const target = S.profile?.nutrition?.calorieTarget
  const kg = currentWeightKg(S)
  const macros = target && kg ? macroSuggestion(S.profile, kg, target) : null
  const days = S.profile?.daysPerWeek
  const goal = goalLabel(S.profile?.goal)

  return (
    <button type="button" className="hw-card hw-nutrition" onClick={() => nav('/nutrition')}>
      <div className="hw-kicker">{t('Calories to eat')}</div>
      <div className="hw-kcal">
        {target != null ? fmtNum(target) : '—'}
        <span className="hw-kcal-u">kcal</span>
      </div>
      <div className="hw-macros">
        <div className="hw-macro">
          <div className="hw-macro-v">{macros?.protein ?? '—'}</div>
          <div className="hw-macro-k">{t('Protein')}</div>
        </div>
        <div className="hw-macro">
          <div className="hw-macro-v">{macros?.carbs ?? '—'}</div>
          <div className="hw-macro-k">{t('Carbs')}</div>
        </div>
        <div className="hw-macro">
          <div className="hw-macro-v">{macros?.fat ?? '—'}</div>
          <div className="hw-macro-k">{t('Fat')}</div>
        </div>
      </div>
      {(goal || days) && (
        <div className="hw-nutrition-foot">
          {[goal, days ? t('{0} days / week', days) : null].filter(Boolean).join(' · ')}
        </div>
      )}
    </button>
  )
}

/* ---- Optional: weight goal ---- */
export function HomeGoalWidget() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const cur = lastBW(S)?.w
  const goal = goalWeight(S)
  const g = S.profile?.goal

  if (!hasProfile(S) || cur == null || goal == null) {
    return (
      <button type="button" className="hw-card hw-goal" onClick={() => nav('/onboarding?restart=1')}>
        <div className="hw-kicker">{t('Weight goal')}</div>
        <h2 className="hw-title">{t('Set a target')}</h2>
        <p className="hw-sub">{t('Restart onboarding to pick one.')}</p>
      </button>
    )
  }

  const rem = Math.round((goal - cur) * 10) / 10
  const cals = calorieSuggestion(S.profile, currentWeightKg(S), S.unit)
  const weeks = cals?.weeksToGoal
  const progress = (() => {
    const first = S.bodyweight[0]?.w
    if (!(first > 0) || first === goal) return null
    const total = Math.abs(first - goal)
    const done = Math.abs(first - cur)
    if (!(total > 0)) return null
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
  })()

  return (
    <button type="button" className="hw-card hw-goal" onClick={() => bwSheet()}>
      <div className="hw-kicker">{t('Weight goal')}</div>
      <div className="hw-goal-nums">
        <div>
          <div className="hw-goal-v">{fmtNum(cur)}</div>
          <div className="hw-macro-k">{t('Now')}</div>
        </div>
        <div className="hw-goal-arrow" aria-hidden><Icon name="chevronRight" /></div>
        <div>
          <div className="hw-goal-v">{fmtNum(goal)}</div>
          <div className="hw-macro-k">{t('Goal')}</div>
        </div>
      </div>
      {progress != null && (
        <div className="hw-goal-bar" aria-hidden>
          <i style={{ width: progress + '%' }} />
        </div>
      )}
      <div className="hw-sub" style={{ margin: '10px 0 0' }}>
        {fmtNum(Math.abs(rem))} {S.unit} {t('to go')}
        {weeks != null ? ` · ${t('~{0} wk', weeks)}` : ''}
        {g ? ` · ${goalLabel(g)}` : ''}
      </div>
    </button>
  )
}

/* ---- Optional: activity heatmap ---- */
export function HomeActivityWidget() {
  const S = useStore(s => s.S)
  return (
    <section className="hw-card hw-activity">
      <div className="hw-kicker">{t('Activity')}</div>
      <h2 className="hw-title" style={{ fontSize: 18, marginBottom: 12 }}>{t('Workout Activity')}</h2>
      <Heatmap
        S={S}
        onDay={iso => {
          const ws = S.workouts.filter(w => w.d === iso)
          if (ws.length === 1) workoutDetailSheet(ws[0])
          else if (ws.length) calendarSheet(iso)
        }}
      />
    </section>
  )
}

export function HomeStatsWidget() {
  return <StatsTiles className="hw-stats" />
}

export function HomePartnerWidget() {
  return <PartnerCard />
}

/* ---- Customize sheet content ---- */
export function HomeWidgetsEditor({ close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const enabled = homeWidgetsOf(S)
  const catalog = optionalHomeCatalog()

  const toggle = id => {
    update(s => {
      const cur = homeWidgetsOf(s)
      s.homeWidgets = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    })
  }

  return (
    <>
      <h3>{t('Home widgets')}</h3>
      <p className="dim small" style={{ margin: '-4px 0 14px', lineHeight: 1.45 }}>
        {t('Today, this week and your calories stay put. Add anything else you want.')}
      </p>
      <div className="list">
        {catalog.map(w => {
          const on = enabled.includes(w.id)
          return (
            <button key={w.id} type="button" className="lrow tap" onClick={() => toggle(w.id)}>
              <span className="lrow-i" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
                <Icon name={w.icon} />
              </span>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="lrow-t">{w.label}</div>
                <div className="lrow-s">{w.desc}</div>
              </div>
              <span className={'hw-toggle' + (on ? ' on' : '')} aria-hidden>
                {on ? <Icon name="check" /> : null}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ height: 12 }} />
      <Button variant="primary" onClick={close}>{t('Done')}</Button>
    </>
  )
}

export function renderOptionalWidget(id) {
  switch (id) {
    case 'goal': return <HomeGoalWidget key="goal" />
    case 'stats': return <HomeStatsWidget key="stats" />
    case 'partner': return <HomePartnerWidget key="partner" />
    case 'activity': return <HomeActivityWidget key="activity" />
    default: return null
  }
}
