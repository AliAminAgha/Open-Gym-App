import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, fmtDur, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, workoutDetailSheet, WorkoutRow } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { useCoachStatus } from '../lib/coach-api.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { InstallBanner } from '../components/InstallApp.jsx'
import { estimateMinutes, routineMuscles, lastWorkoutForRoutine } from '../lib/insights.js'
import { hasProfile, goalLabel } from '../lib/profile.js'
import { homeInsight } from '../lib/coach-tips.js'

function CoachCard({ nav }) {
  const S = useStore(s => s.S)
  const { job, pending } = useCoachStatus(hasConsent(S))
  if (!hasConsent(S) || (!job && !pending)) return null
  const ready = !!pending
  return (
    <div className="card tappable" style={ready ? { borderColor: 'var(--acc-line)' } : null} onClick={() => nav(ready ? '/coach/proposal' : '/coach')}>
      <div className="row between">
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: ready ? 'var(--acc)' : 'var(--orange)', color: ready ? 'var(--on-acc)' : '#1a0c00' }}>
            <Icon name="sparkles" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="t-cap">{t('Coach')}</div>
            <div className="t-head" style={{ marginTop: 2 }}>
              {ready
                ? (pending.kind === 'create'
                  ? t('Your plan is ready')
                  : t(pending.changes?.length === 1 ? '{0} suggestion for you' : '{0} suggestions for you', pending.changes?.length || 0))
                : t('Reading your training…')}
            </div>
          </div>
        </div>
        {ready ? <span className="tag acc">{t('Review')}</span> : <Icon name="chevronRight" className="chev" />}
      </div>
    </div>
  )
}

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const [weekOffset, setWeekOffset] = useState(0)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(
      <div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}>
        <div className="lbl">{t(DAYS[d.getDay()])}</div>
        <div className="num">{d.getDate()}</div>
        <div className={'dot' + dot} />
      </div>
    )
  }

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const weekPct = plannedPerWeek ? Math.min(100, Math.round((wThisWeek / plannedPerWeek) * 100)) : (wThisWeek ? 100 : 0)
  const greeting = today.getHours() < 12 ? t('Good morning') : today.getHours() < 18 ? t('Good afternoon') : t('Good evening')
  const activeDone = S.active ? setsDoneActive(S.active) : 0
  const activeTotal = S.active ? S.active.entries.reduce((n, e) => n + e.sets.length, 0) : 0
  const streak = streakWeeks(S)

  const muscles = routine ? routineMuscles(routine) : []
  const mins = routine ? estimateMinutes(routine) : 0
  const lastSame = routine ? lastWorkoutForRoutine(S, routine.id) : null

  const onPrimary = () => {
    if (S.active) nav('/workout')
    else if (routine) startFlow(routine.id)
    else dayOverrideSheet(todayISO())
  }

  const tip = homeInsight(S)
  const insight = tip?.text
    ? tip.text
    : streak >= 2
      ? <>{t('You’re on a')} <b>{t('{0} week streak', streak)}</b>.</>
      : wThisWeek > 0
        ? <>{t('You’ve trained')} <b>{wThisWeek}</b> {t('time(s) this week')}.</>
        : S.workouts.length
          ? t('Log today’s session to keep your streak alive.')
          : t('Start with today’s workout — one session builds the habit.')

  return (
    <div className="narrow">
      <div className="hdr">
        <div>
          <div className="t-cap" style={{ marginBottom: 6 }}>{greeting}{user ? `, ${user.name.split(' ')[0]}` : ''}</div>
          <h1 style={{ fontSize: 26 }}>{hasProfile(S) ? t('Your plan') : t('What should I do today?')}</h1>
          <div className="sub">
            {hasProfile(S)
              ? `${goalLabel(S.profile.goal)} · ${today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}`
              : today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>

      <InstallBanner />

      {!hasProfile(S) && !S.routines.length && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="t-title2" style={{ marginBottom: 6 }}>{t('Get a personalized plan')}</div>
          <div className="muted small" style={{ marginBottom: 14 }}>
            {t('Tell us your goal and schedule — we’ll build a training week and calorie estimates. No AI required.')}
          </div>
          <Button variant="primary" icon="sparkles" onClick={() => nav('/setup')}>{t('Training Setup')}</Button>
        </div>
      )}

      <section className="home-hero">
        <div className="eyebrow">{S.active ? t('In progress') : t("Today's workout")}</div>
        <div className="name">
          {S.active ? S.active.name : routine ? routine.name : t('Rest day')}
        </div>
        <div className="meta">
          {S.active
            ? t('{0} sets', activeDone + '/' + activeTotal)
            : routine
              ? [
                  `${routine.ex.length} ${t('exercises')}`,
                  mins ? `~${mins} ${t('min')}` : null,
                  todayOvr ? t('rescheduled') : null
                ].filter(Boolean).join(' · ')
              : t('Recover, or schedule a session')}
        </div>

        {!!muscles.length && !S.active && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {muscles.map(m => <span key={m} className="tag">{t(m)}</span>)}
          </div>
        )}

        {lastSame && !S.active && (
          <div className="small muted" style={{ marginBottom: 14 }}>
            {t('Last time')} {fmtDate(lastSame.d, true)}
            {lastSame.end && lastSame.start ? ` · ${fmtDur(lastSame.end - lastSame.start)}` : ''}
            {lastSame.prs?.length ? ` · ${t('{0} PR(s)', lastSame.prs.length)}` : ''}
          </div>
        )}

        <Button
          className="cta"
          variant="primary"
          icon={S.active ? 'play' : routine ? 'dumbbell' : 'plus'}
          onClick={onPrimary}
        >
          {S.active ? t('Resume workout') : routine ? t('Start Workout') : t('Schedule workout')}
        </Button>
      </section>

      {coachOn && <CoachCard nav={nav} />}

      {hasProfile(S) && (
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <Button size="sm" icon="person" onClick={() => nav('/setup?edit=1')}>{t('Edit profile')}</Button>
          <Button size="sm" variant="ghost" icon="flame" onClick={() => nav('/nutrition')}>{t('Nutrition')}</Button>
        </div>
      )}

      {!S.routines.length && !S.active && hasProfile(S) && (
        <div className="card">
          <div className="muted small" style={{ marginBottom: 12 }}>{t('No weekly plan applied yet.')}</div>
          <Button variant="primary" onClick={() => nav('/setup')}>{t('Generate plan')}</Button>
        </div>
      )}

      {!S.routines.length && !S.active && !hasProfile(S) && (
        <div className="card">
          <div className="t-title2" style={{ marginBottom: 6 }}>{t('Welcome!')}</div>
          <div className="muted small" style={{ marginBottom: 14 }}>
            {t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}
          </div>
          <Button variant="primary" icon="sparkles" onClick={() => nav('/setup')}>{t('Training Setup')}</Button>
          <div style={{ height: 8 }} />
          <Button onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
          <div style={{ height: 8 }} />
          <Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
        </div>
      )}

      <div className="insight">
        <span className="ico"><Icon name="bolt" /></span>
        <div className="txt">{insight}</div>
      </div>

      <div className="home-week">
        <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
          <button className="iconbtn" style={{ width: 32, height: 32, fontSize: 14 }} onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week"><Icon name="chevronLeft" /></button>
          <div className="small" style={{ fontWeight: 600 }}>{weekOffset === 0 ? t('This week') : t('Week')}</div>
          <button className="iconbtn" style={{ width: 32, height: 32, fontSize: 14 }} onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week"><Icon name="chevronRight" /></button>
        </div>
        <div className="week">{strip}</div>
        <div style={{ padding: '12px 8px 4px' }}>
          <div className="row between small">
            <span className="muted" onClick={() => calendarSheet()} style={{ cursor: 'pointer' }}>
              <Icon name="flame" style={{ color: 'var(--orange)', marginRight: 4 }} />
              {t('{0} week streak', streak)}
            </span>
            <span style={{ fontWeight: 600 }}>{plannedPerWeek ? `${wThisWeek}/${plannedPerWeek}` : wThisWeek}</span>
          </div>
          {plannedPerWeek > 0 && <div className="week-bar"><i style={{ width: weekPct + '%' }} /></div>}
        </div>
      </div>

      <div className="home-stats">
        <button className="home-stat" onClick={() => nav('/stats')}>
          <div className="k">{t('Workouts')}</div>
          <div className="v">{S.workouts.length}</div>
        </button>
        <button className="home-stat" onClick={() => bwSheet()}>
          <div className="k">{t('Weight')}</div>
          <div className="v" style={delta ? { color: bwDeltaColor(delta, bw?.w) } : undefined}>
            {bw ? fmtNum(bw.w) : '—'}
            {bw && <span className="u">{S.unit}</span>}
          </div>
        </button>
        <button className="home-stat" onClick={() => nav('/stats')}>
          <div className="k">{t('Streak')}</div>
          <div className="v">{streak}<span className="u">{t('wk')}</span></div>
        </button>
      </div>

      {S.workouts.length > 0 && (
        <>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h4 className="sec" style={{ margin: 0 }}>{t('Recent')}</h4>
            <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')}</Button>
          </div>
          <div className="list" style={{ marginBottom: 8 }}>
            {[...S.workouts].reverse().slice(0, 2).map(w => (
              <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
