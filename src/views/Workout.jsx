import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { effectiveRoutine, lastEntryFor, bestWeightFor, buildSets, setsDoneActive, supersetUnits, unitOf, setLabel, modeOf, EFFORT, effortOf, stepEffort, capEffort } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, exCount, DAYN } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import Media from '../components/Media.jsx'
import { startFlow, exercisePicker, exConfigSheet, exerciseDetailSheet, topWeightSheet, finishWorkout, workoutCompleteSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, NumberField } from '../components/ui.jsx'
import { nextPrescription, applyPrescription } from '../lib/progression.js'
import { glyphOf } from '../lib/glyphs.js'
import { setVsLast, formatOverloadCue, nextSessionHint } from '../lib/insights.js'
import { defaultIncrement } from '../lib/progression.js'

function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const todayR = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const others = S.routines.filter(r => r !== todayR)
  return (
    <div className="narrow">
      <div className="hdr">
        <div>
          <h1>{t('Start workout')}</h1>
          <div className="sub">{t(DAYN[new Date().getDay()])} — {todayR ? t('today is {0}', todayR.name) : t('rest day, but no one’s stopping you')}</div>
        </div>
      </div>

      {todayR && (
        <div className="wo-chooser-hero">
          <div className="t-cap" style={{ color: 'var(--acc)', marginBottom: 10 }}>
            {t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}
          </div>
          <div className="row between" style={{ marginBottom: 18 }}>
            <div>
              <div className="big" style={{ fontSize: 30 }}>{todayR.name}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{exCount(todayR.ex.length)}</div>
            </div>
            <span className="lrow-i" style={{ width: 48, height: 48, borderRadius: 14, fontSize: 24, background: 'var(--acc-soft)', color: 'var(--acc)' }}>
              <Icon name={glyphOf(todayR.emoji)} />
            </span>
          </div>
          <Button variant="primary" icon="play" onClick={() => startFlow(todayR.id)}>{t('Start {0}', todayR.name)}</Button>
        </div>
      )}

      {others.length > 0 && (
        <>
          <h4 className="sec">{t('Other routines')}</h4>
          <div className="list">
            {others.map(r => (
              <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
                <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
                <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
                <span className="tag acc">{t('Start')}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 14 }} />
      <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>
      {!S.routines.length && <><div style={{ height: 10 }} /><Button variant="primary" onClick={() => nav('/plan')}>{t('Build a plan first')}</Button></>}
    </div>
  )
}

function Elapsed({ start }) {
  const [clock, setClock] = useState('0:00')
  useEffect(() => {
    const tick = () => {
      const s = Math.floor((Date.now() - start) / 1000)
      setClock(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [start])
  return <span>{clock}</span>
}

/** Focused single-exercise trainer: one current set, big numbers, one primary action. */
function FocusExercise({ entryIdx, onToggle, onField, onAddSet, onRemoveSet, onSkipSet, onStartTimed, justDone }) {
  const S = useStore(s => s.S)
  const working = useUI(s => s.work)
  const entry = S.active.entries[entryIdx]
  const ex = exOr(entry.id)
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const cardio = mode === 'cardio'
  const timed = mode === 'time'
  const last = lastEntryFor(S, entry.id)
  const best = cardio ? 0 : Math.max(bestWeightFor(S, entry.id), (S.exWeights[entry.id] || {}).w || 0)
  const plan = entry.plan
  const kind = effortOf(S)
  const eff = EFFORT[kind]

  const curIdx = Math.max(0, entry.sets.findIndex(s => !s.done))
  const focusIdx = entry.sets.every(s => s.done) ? entry.sets.length - 1 : curIdx
  const s = entry.sets[focusIdx]
  const allDone = entry.sets.length > 0 && entry.sets.every(x => x.done)

  const cmp = setVsLast(entry, focusIdx, last)
  const cue = formatOverloadCue(cmp, S.unit, t)
  const nextHint = nextSessionHint(cmp, S.unit, defaultIncrement(entry.id, S.unit))

  const col1 = cardio
    ? { f: 'min', step: 1, dec: false, lbl: t('Minutes'), unit: 'min' }
    : timed
      ? { f: 'sec', step: 5, dec: false, lbl: t('Seconds'), unit: 's' }
      : { f: 'w', step: 2.5, dec: true, lbl: t('Weight'), unit: S.unit }

  const col2 = cardio
    ? { f: 'speed', step: 0.5, dec: true, lbl: t('Speed'), unit: 'km/h' }
    : timed
      ? { f: 'w', step: 2.5, dec: true, lbl: t('Weight'), unit: S.unit }
      : { f: 'r', step: 1, dec: false, lbl: t('Reps'), unit: '' }

  const bump = (col, dir) => {
    if (!s) return
    onField(focusIdx, col.f, Math.max(0, Math.round(((s[col.f] || 0) + dir * col.step) * 100) / 100))
  }

  const Field = ({ col }) => (
    <div className="wo-field">
      <div className="lbl">{col.lbl}</div>
      <div className="value">
        <NumberField
          decimal={col.dec}
          value={s?.[col.f] ?? ''}
          onChange={v => onField(focusIdx, col.f, v)}
          style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.05em', background: 'transparent', border: 0, padding: 0, textAlign: 'center', width: '100%' }}
        />
        {col.unit ? <span className="unit">{col.unit}</span> : null}
      </div>
      <div className="wo-bump">
        <button aria-label="Decrease" onClick={() => bump(col, -1)}><Icon name="minus" /></button>
        <button aria-label="Increase" onClick={() => bump(col, 1)}><Icon name="plus" /></button>
      </div>
    </div>
  )

  return (
    <div className={'wo-stage' + (justDone ? ' wo-pop' : '')}>
      <Media ex={ex} compact minimizable />
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="wo-exname" style={{ flex: 1 }}>{ex.n}</div>
        <button className="iconbtn" aria-label={t('Details')} onClick={() => exerciseDetailSheet(ex)}><Icon name="info" /></button>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {cardio && <span className="tag acc"><Icon name="figureRun" />{t('Cardio')}</span>}
        {(ex.tg || ex.bp) && <span className="tag">{t(ex.tg || ex.bp)}</span>}
        {best > 0 && <span className="tag nocap">{t('Best:')} {fmtNum(best)} {S.unit}</span>}
      </div>

      {cue && (
        <div className={'wo-overload' + (cue.kind === 'up' ? ' up' : cue.kind === 'down' ? ' down' : '')}>
          <div><span className="dim">{t('Last')}</span> {cue.last}</div>
          <div><span className="dim">{t('Today')}</span> <b>{cue.today}</b></div>
          {nextHint && <div className="next"><span className="dim">{t('Next')}</span> {nextHint}</div>}
        </div>
      )}
      {!cue && last && (
        <div className="wo-prev">
          {t('Last time')} ({fmtDate(last.d)}): {last.sets.map(x => setLabel(entry.id, x, last.target)).join(' · ')}
        </div>
      )}

      {plan && plan.why && plan.kind !== 'off' && (
        <div className={'progline' + (plan.kind === 'deload' ? ' warn' : '')}>
          <Icon name={plan.kind === 'up' ? 'arrowUp' : plan.kind === 'deload' ? 'arrowDown' : 'lightbulb'} />
          <span>{t(...plan.why)}</span>
        </div>
      )}

      <div className="wo-sets">
        {entry.sets.map((set, i) => (
          <button
            key={i}
            className={'wo-pill' + (set.done ? ' done' : '') + (i === focusIdx ? ' cur' : '')}
            onClick={() => { if (set.done) onToggle(i) }}
            aria-label={t('Set {0}', i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {s && (
        <div className={'wo-setcard' + (justDone ? ' flash' : '')}>
          <div className="wo-setlabel">
            {allDone ? t('All sets done') : t('Set {0} of {1}', focusIdx + 1, entry.sets.length)}
          </div>

          <div className="wo-controls">
            <Field col={col1} />
            <Field col={col2} />
          </div>

          {mode === 'reps' && eff && (
            <div className="row between" style={{ marginBottom: 16 }}>
              <span className="small muted">{t(eff.hd)}</span>
              <div className="wo-bump">
                <button aria-label="Decrease" onClick={() => onField(focusIdx, eff.f, stepEffort(kind, s[eff.f], -1))}><Icon name="minus" /></button>
                <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>
                  <NumberField decimal nullable value={s[eff.f] ?? ''} onChange={v => onField(focusIdx, eff.f, capEffort(kind, v))} style={{ width: 40, textAlign: 'center', background: 'transparent', border: 0, padding: 0, fontWeight: 600 }} />
                </span>
                <button aria-label="Increase" onClick={() => onField(focusIdx, eff.f, stepEffort(kind, s[eff.f], 1))}><Icon name="plus" /></button>
              </div>
            </div>
          )}

          {timed && !s.done && (
            <Button
              className="wo-complete"
              variant="tinted"
              icon="play"
              disabled={!!working}
              onClick={() => onStartTimed(focusIdx)}
              style={{ marginBottom: 10 }}
            >
              {t('Start set')}
            </Button>
          )}

          {!s.done ? (
            <Button className="wo-complete" variant="primary" icon="check" onClick={() => onToggle(focusIdx)}>
              {t('Complete set')}
            </Button>
          ) : (
            <Button className="wo-complete" variant="tinted" icon="reset" onClick={() => onToggle(focusIdx)}>
              {t('Undo set')}
            </Button>
          )}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" icon="plus" onClick={onAddSet}>{t('Add set')}</Button>
        {!allDone && s && !s.done && (
          <Button size="sm" variant="ghost" onClick={() => onSkipSet(focusIdx)}>{t('Skip set')}</Button>
        )}
        <Button size="sm" icon="minus" disabled={entry.sets.length <= 1} onClick={onRemoveSet}>{t('Remove set')}</Button>
      </div>
    </div>
  )
}

function ActiveWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { startRest, stopRest } = useUI()
  const [justDone, setJustDone] = useState(false)
  const A = S.active
  const units = supersetUnits(A.entries)
  const cur = Math.min(A.cur, Math.max(0, A.entries.length - 1))
  const unit = A.entries.length ? unitOf(units, cur) : []
  const unitIdx = units.findIndex(u => u === unit)
  const isSuperset = unit.length > 1

  const total = A.entries.reduce((n, e) => n + e.sets.length, 0)
  const done = setsDoneActive(A)

  const mutEntry = (idx, fn) => update(s => { fn(s.active.entries[idx]) }, true)
  const setField = (idx, i, field, v) => mutEntry(idx, e => {
    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v
  })
  const modeAt = idx => modeOf({ ...(A.entries[idx].target || {}), id: A.entries[idx].id })
  const addSet = idx => mutEntry(idx, e => {
    const l = e.sets[e.sets.length - 1]
    const m = modeOf({ ...(e.target || {}), id: e.id })
    if (m === 'cardio') e.sets.push({ min: l ? l.min : (e.target.min || 20), speed: l ? l.speed : (e.target.speed || 8), done: false })
    else if (m === 'time') e.sets.push({ sec: l ? l.sec : (e.target.sec || 45), w: l ? (l.w || 0) : (e.target.weight || 0), done: false })
    else e.sets.push({ w: l ? l.w : 0, r: l ? l.r : e.target.reps, done: false })
  })
  const removeSet = idx => mutEntry(idx, e => { if (e.sets.length > 1) e.sets.pop() })

  const startTimed = (idx, i) => {
    const e = A.entries[idx]
    useUI.getState().startWork(e.sets[i].sec || 45, exOr(e.id).n, elapsed => {
      mutEntry(idx, en => { en.sets[i].sec = elapsed })
      if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)
    })
  }

  const skipSet = (idx, i) => {
    // Drop this set from the prescription so focus advances without logging volume.
    mutEntry(idx, e => {
      if (e.sets.length <= 1) return
      e.sets.splice(i, 1)
    })
    useUI.getState().toast(t('Set skipped'))
  }

  const toggle = (idx, i) => {
    const m = modeAt(idx)
    const cardioEntry = m === 'cardio'
    const isLastUnit = unitIdx >= units.length - 1
    let askTop = false, exJustDone = false, workoutDone = false
    mutEntry(idx, e => {
      e.sets[i].done = !e.sets[i].done
      if (e.sets[i].done) {
        beep(S.sound, 1040, 0.12); vibrate(30)
        setJustDone(true)
        setTimeout(() => setJustDone(false), 450)
        const isLastExInUnit = idx === unit[unit.length - 1]
        const unitDone = unit.every(ui => (ui === idx ? e : A.entries[ui]).sets.every(x => x.done))
        // Rest after every completed set while more work remains (supersets: rest after the unit partner finishes this round).
        if (unitDone && isLastUnit) { workoutDone = true; stopRest() }
        else if (isSuperset) {
          if (isLastExInUnit) startRest(S.restSec)
        } else {
          startRest(S.restSec)
        }
        if (e.sets.every(x => x.done)) { exJustDone = true; if (m === 'reps' && !e.asked) { e.asked = true; askTop = true } }
      } else {
        stopRest()
      }
    })
    if (askTop) topWeightSheet(idx)
    else if (workoutDone) workoutCompleteSheet()
    else if (exJustDone && cardioEntry) useUI.getState().toast(t('Cardio logged'))
    else if (exJustDone && m === 'time') useUI.getState().toast(t('Hold logged'))
  }

  useEffect(() => {
    if (!useStore.getState().user) return
    let stopped = false
    const ping = active => {
      const A2 = useStore.getState().S.active
      if (!A2) return
      const u = supersetUnits(A2.entries)
      const c = Math.min(A2.cur, Math.max(0, A2.entries.length - 1))
      const ui = u.findIndex(x => x.includes(c))
      const tot = A2.entries.reduce((n, e) => n + e.sets.length, 0)
      api('/api/activity', {
        method: 'POST',
        body: JSON.stringify({
          active, name: A2.name, exIdx: ui + 1, exTotal: u.length,
          setsDone: setsDoneActive(A2), setsTotal: tot, startedAt: A2.start
        })
      }).catch(() => {})
    }
    ping(true)
    const iv = setInterval(() => { if (!stopped) ping(true) }, 20000)
    return () => {
      stopped = true; clearInterval(iv)
      try { navigator.sendBeacon?.('/api/activity', new Blob([JSON.stringify({ active: false })], { type: 'application/json' })) } catch { /* */ }
      api('/api/activity', { method: 'POST', body: JSON.stringify({ active: false }) }).catch(() => {})
    }
  }, [])

  const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
  const allDone = A.entries.length > 0 && exDone === A.entries.length

  return (
    <div className="narrow">
      <div className="wo-top">
        <button
          className="iconbtn"
          aria-label={t('Discard')}
          onClick={() => confirmSheet({
            title: t('Discard workout?'),
            message: t('The sets you logged in this session will be lost.'),
            confirmText: t('Discard'),
            danger: true,
            onConfirm: () => { update(s => { s.active = null }); stopRest(); nav('/home') }
          })}
        >
          <Icon name="xmark" />
        </button>
        <div className="mid">
          <div className="name">{A.name}</div>
          <div className="meta"><Elapsed start={A.start} /> · {done}/{total}</div>
        </div>
        <button className="iconbtn" style={{ color: 'var(--acc)' }} aria-label={t('Finish')} onClick={finishWorkout}>
          <Icon name="check" />
        </button>
      </div>

      <div className="wprog"><i style={{ width: (total ? done / total * 100 : 0) + '%' }} /></div>

      {A.entries.length ? (
        <>
          <div className="t-cap" style={{ marginBottom: 10 }}>
            {isSuperset ? t('Superset {0} / {1}', unitIdx + 1, units.length) : t('Exercise {0} / {1}', unitIdx + 1, units.length)}
          </div>

          {isSuperset ? (
            <div className="ss-card">
              <div className="ss-hd"><Icon name="link" />{t('Superset · do these back-to-back, rest after both')}</div>
              {unit.map((idx, k) => (
                <div key={idx} className="ss-ex">
                  {k > 0 && <div className="ss-amp">+</div>}
                  <FocusExercise
                    entryIdx={idx}
                    justDone={justDone}
                    onToggle={i => toggle(idx, i)}
                    onField={(i, f, v) => setField(idx, i, f, v)}
                    onAddSet={() => addSet(idx)}
                    onRemoveSet={() => removeSet(idx)}
                    onSkipSet={i => skipSet(idx, i)}
                    onStartTimed={i => startTimed(idx, i)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <FocusExercise
              entryIdx={cur}
              justDone={justDone}
              onToggle={i => toggle(cur, i)}
              onField={(i, f, v) => setField(cur, i, f, v)}
              onAddSet={() => addSet(cur)}
              onRemoveSet={() => removeSet(cur)}
              onSkipSet={i => skipSet(cur, i)}
              onStartTimed={i => startTimed(cur, i)}
            />
          )}
        </>
      ) : (
        <div className="empty"><div className="ico"><Icon name="shuffle" /></div>{t('Freestyle workout — add your first exercise.')}</div>
      )}

      <div className="wo-nav">
        <Button icon="chevronLeft" disabled={unitIdx <= 0} onClick={() => update(s => { s.active.cur = units[unitIdx - 1][0] })}>{t('Prev')}</Button>
        <Button trailingIcon="chevronRight" disabled={unitIdx < 0 || unitIdx >= units.length - 1} onClick={() => update(s => { s.active.cur = units[unitIdx + 1][0] })}>{t('Next')}</Button>
      </div>

      <Button
        onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => update(s => {
          const full = { ...cfg, id: ex.id }
          const plan = nextPrescription(s, full, s.routines.find(r => r.id === s.active.routineId))
          s.active.entries.push({ id: ex.id, target: { ...cfg }, plan, sets: applyPrescription(buildSets(s, full), plan) })
          s.active.cur = s.active.entries.length - 1
        }), null, S.routines.find(r => r.id === A.routineId)))}
        icon="plus"
      >
        {t('Add exercise')}
      </Button>

      <div style={{ height: 10 }} />
      <button className={allDone ? 'btn primary' : 'btn ghost dim'} onClick={finishWorkout}>
        {allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
      </button>
      <div style={{ height: 40 }} />
    </div>
  )
}

export default function Workout() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}
