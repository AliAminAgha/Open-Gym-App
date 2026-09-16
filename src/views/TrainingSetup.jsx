// Multi-step Training Setup — rule-based personalized coach onboarding.
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { DAYN, fmtNum } from '../lib/format.js'
import { lastBW } from '../lib/history.js'
import { EXIDX, allExercises } from '../lib/exercises.js'
import {
  emptyProfile, GOALS, EXPERIENCE, ACTIVITY, SESSION_OPTS, EQUIPMENT_CHIPS, goalLabel, currentWeightKg, LOSS_PACE
} from '../lib/profile.js'
import { calorieSuggestion, proteinSuggestion, formatKcalRange } from '../lib/calories.js'
import { generatePlan, applyGeneratedPlanToState, formatDayPlan, schemeFor } from '../lib/plan-gen.js'
import { estimateMinutes, routineMuscles } from '../lib/insights.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, NumberField } from '../components/ui.jsx'
import { Thumb } from '../components/Media.jsx'

const STEPS = [
  { id: 'about', label: 'About you' },
  { id: 'goal', label: 'Goal' },
  { id: 'training', label: 'Training' },
  { id: 'prefs', label: 'Preferences' },
  { id: 'plan', label: 'Your plan' }
]

function ChoiceList({ options, value, onChange }) {
  return (
    <div className="sect-b">
      {options.map(o => (
        <button key={o.id} type="button" className="lrow tap" onClick={() => onChange(o.id)}>
          <span className="lrow-m"><span className="lrow-t">{t(o.label)}</span></span>
          {value === o.id && <Icon name="check" className="lrow-k" />}
        </button>
      ))}
    </div>
  )
}

function ExPickerMini({ label, selected, onToggle, S }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const ql = q.toLowerCase().trim()
    return allExercises(S).filter(e => !ql || e.n.toLowerCase().includes(ql)).slice(0, 12)
  }, [q, S])
  return (
    <div style={{ marginTop: 14 }}>
      <div className="muted small" style={{ marginBottom: 8 }}>{label}</div>
      <div className="search" style={{ marginBottom: 8 }}>
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input className="input" placeholder={t('Search…')} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {!!selected.length && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(id => (
            <button key={id} type="button" className="chip on" onClick={() => onToggle(id)}>
              {(EXIDX[id] || {}).n || id} ×
            </button>
          ))}
        </div>
      )}
      <div className="list" style={{ maxHeight: 180, overflow: 'auto' }}>
        {list.map(e => (
          <div key={e.id} className="item" onClick={() => onToggle(e.id)}>
            <div className="thumb"><Thumb ex={e} /></div>
            <div className="grow"><div className="tt capitalize">{e.n}</div><div className="ss">{t(e.eq)}</div></div>
            {selected.includes(e.id) && <Icon name="check" className="chev" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TrainingSetup() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const editing = params.get('edit') === '1'
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const bw = lastBW(S)

  const [step, setStep] = useState(0)
  const [p, setP] = useState(() => ({ ...emptyProfile(), ...(S.profile || {}) }))
  const [weight, setWeight] = useState(() => bw?.w ?? '')
  const [showWhy, setShowWhy] = useState(false)
  const [whyEx, setWhyEx] = useState(null)

  const set = patch => setP(v => ({ ...v, ...patch }))
  const key = STEPS[step].id

  const kgForCalc = (() => {
    const w = Number(weight)
    if (!(w > 0)) return currentWeightKg(S)
    return S.unit === 'lb' ? w * 0.453592 : w
  })()

  const cals = useMemo(() => calorieSuggestion(p, kgForCalc, S.unit), [p, kgForCalc, S.unit])
  const protein = useMemo(() => proteinSuggestion(p, kgForCalc), [p, kgForCalc])
  const plan = useMemo(() => (key === 'plan' || step === STEPS.length - 1 ? generatePlan(p, S) : null), [p, S, key, step])
  const dayRows = plan ? formatDayPlan(plan) : []

  const canNext = () => {
    if (key === 'about') return p.age > 0 && p.sex && p.heightCm > 0 && Number(weight) > 0 && p.experience
    if (key === 'goal') {
      const g = GOALS.find(x => x.id === p.goal)
      if (!g) return false
      const cur = Number(weight)
      if (g.needsTarget) {
        if (!(p.targetW > 0)) return false
        if (p.goal === 'fatloss') return p.targetW < cur
        if (p.goal === 'muscle') return p.targetW > cur
      }
      return true
    }
    if (key === 'training') return p.daysPerWeek >= 2 && p.sessionMin && p.activity
    if (key === 'prefs') return !!p.location
    return true
  }

  const finish = (applyPlan) => {
    const now = Date.now()
    update(s => {
      s.profile = {
        ...emptyProfile(),
        ...p,
        style: 'custom',
        completedAt: p.completedAt || now,
        updatedAt: now
      }
      if (p.targetW > 0) {
        s.targetW = p.targetW
        if (p.goal === 'fatloss') {
          const cur = Number(weight)
          if (cur > p.targetW) s.profile.lossAmount = Math.round((cur - p.targetW) * 10) / 10
        }
      }
      const w = Number(weight)
      if (w > 0) {
        const d = new Date().toISOString().slice(0, 10)
        const last = s.bodyweight[s.bodyweight.length - 1]
        if (!last || last.d !== d) s.bodyweight.push({ d, w, t: now })
        else { last.w = w; last.t = now }
      }
      if (cals && s.profile.nutrition) {
        s.profile.nutrition.calorieTarget = Math.round((cals.low + cals.high) / 2)
        s.profile.nutrition.proteinTarget = protein
      }
      if (applyPlan && plan) applyGeneratedPlanToState(s, plan)
    })
    toast(applyPlan ? t('Your plan is ready') : t('Profile saved'))
    nav('/home')
  }

  const toggleDay = d => set({
    preferredDays: p.preferredDays.includes(d)
      ? p.preferredDays.filter(x => x !== d)
      : [...p.preferredDays, d].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
  })
  const toggleEq = e => set({
    equipment: p.equipment.includes(e) ? p.equipment.filter(x => x !== e) : [...p.equipment, e]
  })
  const toggleFav = id => set({
    favorites: p.favorites.includes(id) ? p.favorites.filter(x => x !== id) : [...p.favorites, id].slice(0, 12)
  })
  const toggleAvoid = id => set({
    avoid: p.avoid.includes(id) ? p.avoid.filter(x => x !== id) : [...p.avoid, id].slice(0, 12)
  })

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => step ? setStep(step - 1) : nav(-1)} aria-label={t('Back')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, marginLeft: 10 }}>
          <h1>{editing ? t('Training Setup') : t('Training Setup')}</h1>
          <div className="sub">{STEPS[step].label} · {t('Step {0} of {1}', step + 1, STEPS.length)}</div>
        </div>
      </div>

      <div className="setup-rail">
        {STEPS.map((s, i) => (
          <div key={s.id} className={'setup-rail-seg' + (i <= step ? ' on' : '')} title={s.label} />
        ))}
      </div>
      <div className="setup-rail-labels">
        {STEPS.map((s, i) => (
          <span key={s.id} className={i === step ? 'on' : ''}>{s.label}</span>
        ))}
      </div>

      <div className="card setup-card">
        {key === 'about' && (
          <>
            <h2 style={{ marginTop: 0 }}>{t('About you')}</h2>
            <div className="muted small" style={{ marginBottom: 14 }}>{t('Used for calorie estimates and plan sizing. You can edit this later.')}</div>

            <div className="field-grid">
              <label className="field-block">
                <span className="lbl">{t('Age')}</span>
                <NumberField decimal={false} value={p.age ?? ''} onChange={v => set({ age: v })} />
              </label>
              <label className="field-block">
                <span className="lbl">{t('Height (cm)')}</span>
                <NumberField decimal={false} value={p.heightCm ?? ''} onChange={v => set({ heightCm: v })} />
              </label>
              <label className="field-block">
                <span className="lbl">{t('Weight')} ({S.unit})</span>
                <NumberField decimal value={weight} onChange={setWeight} />
              </label>
            </div>

            <h4 className="sec">{t('Sex')}</h4>
            <Segmented
              value={p.sex}
              onChange={v => set({ sex: v })}
              options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
            />

            <h4 className="sec">{t('Training experience')}</h4>
            <ChoiceList options={EXPERIENCE} value={p.experience} onChange={v => set({ experience: v })} />
          </>
        )}

        {key === 'goal' && (
          <>
            <h2 style={{ marginTop: 0 }}>{t('What is your primary goal?')}</h2>
            <ChoiceList options={GOALS} value={p.goal} onChange={v => set({
              goal: v,
              targetW: GOALS.find(g => g.id === v)?.needsTarget ? p.targetW : null,
              lossAmount: null
            })} />

            {GOALS.find(g => g.id === p.goal)?.needsTarget && (
              <>
                <label className="field-block" style={{ marginTop: 8 }}>
                  <span className="lbl">{t('Target weight')} ({S.unit})</span>
                  <NumberField
                    decimal
                    value={p.targetW ?? ''}
                    onChange={v => {
                      const cur = Number(weight)
                      const lossAmount = p.goal === 'fatloss' && cur > 0 && v > 0
                        ? Math.round((cur - v) * 10) / 10
                        : null
                      set({ targetW: v, lossAmount })
                    }}
                  />
                </label>
                {Number(weight) > 0 && p.targetW > 0 && (
                  <div className="small muted" style={{ marginBottom: p.goal === 'fatloss' ? 12 : 0 }}>
                    {t('Current')}: {fmtNum(Number(weight))} {S.unit} → {t('Goal')}: {fmtNum(p.targetW)} {S.unit}
                    {p.goal === 'fatloss' && p.targetW < Number(weight) && (
                      <> · {t('To lose')}: {fmtNum(Math.round((Number(weight) - p.targetW) * 10) / 10)} {S.unit}</>
                    )}
                  </div>
                )}
                {p.goal === 'fatloss' && (
                  <>
                    <h4 className="sec">{t('How fast?')}</h4>
                    <div className="muted small" style={{ marginBottom: 10 }}>{t('Pace changes your daily calorie deficit.')}</div>
                    <Segmented
                      value={p.lossPace || 'moderate'}
                      onChange={v => set({ lossPace: v })}
                      options={LOSS_PACE.map(o => ({
                        value: o.id,
                        label: t(o.label) + ` (~${S.unit === 'lb' ? Math.round(o.kgPerWeek / 0.453592 * 10) / 10 : o.kgPerWeek}/${t('wk')})`
                      }))}
                    />
                  </>
                )}
              </>
            )}

            {cals && (
              <div className="calorie-card" style={{ marginTop: 16 }}>
                <div className="t-cap">{t('Estimates only')}</div>
                <div className="row between" style={{ marginTop: 8 }}>
                  <div>
                    <div className="small muted">{t('Estimated maintenance')}</div>
                    <div className="big" style={{ fontSize: 28 }}>~{cals.maintenance}</div>
                    <div className="small dim">kcal/day</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="small muted">{t(cals.label)}</div>
                    <div className="big" style={{ fontSize: 22, color: 'var(--acc)' }}>{formatKcalRange(cals.low, cals.high).replace(' kcal/day', '')}</div>
                    <div className="small dim">kcal/day</div>
                  </div>
                </div>
                {cals.dailyDeficit != null && (p.goal === 'fatloss' || p.goal === 'recomp') && (
                  <div className="calorie-highlight">
                    <div>
                      <div className="small muted">{t('Estimated deficit')}</div>
                      <div className="big" style={{ fontSize: 28, color: 'var(--acc)' }}>~{cals.dailyDeficit}</div>
                      <div className="small dim">kcal/day</div>
                    </div>
                    {cals.weeksToGoal != null && (
                      <div style={{ textAlign: 'right' }}>
                        <div className="small muted">{t('Time to goal')}</div>
                        <div className="big" style={{ fontSize: 28 }}>~{cals.weeksToGoal}</div>
                        <div className="small dim">{t('weeks')}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {key === 'training' && (
          <>
            <h2 style={{ marginTop: 0 }}>{t('Training')}</h2>
            <h4 className="sec" style={{ marginTop: 0 }}>{t('Days per week')}</h4>
            <Segmented
              value={p.daysPerWeek}
              onChange={v => set({ daysPerWeek: v })}
              options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))}
            />

            <h4 className="sec">{t('Session duration')}</h4>
            <Segmented
              value={p.sessionMin}
              onChange={v => set({ sessionMin: v })}
              options={SESSION_OPTS.map(n => ({ value: n, label: n + ' ' + t('min') }))}
            />

            <h4 className="sec">{t('Preferred training days')}</h4>
            <div className="week">
              {[1, 2, 3, 4, 5, 6, 0].map(d => (
                <div key={d} className={'wday' + (p.preferredDays.includes(d) ? ' today' : '')} onClick={() => toggleDay(d)}>
                  <div className="lbl">{t(DAYN[d]).slice(0, 2)}</div>
                  <div className={'dot' + (p.preferredDays.includes(d) ? ' plan' : '')} />
                </div>
              ))}
            </div>

            <h4 className="sec">{t('Activity level')}</h4>
            <ChoiceList options={ACTIVITY} value={p.activity} onChange={v => set({ activity: v })} />
          </>
        )}

        {key === 'prefs' && (
          <>
            <h2 style={{ marginTop: 0 }}>{t('Preferences')}</h2>
            <h4 className="sec" style={{ marginTop: 0 }}>{t('Where do you train?')}</h4>
            <Segmented
              value={p.location}
              onChange={v => set({ location: v, equipment: v === 'home' && !p.equipment.length ? ['dumbbell', 'body weight', 'band'] : p.equipment })}
              options={[{ value: 'gym', label: t('Gym') }, { value: 'home', label: t('Home') }]}
            />

            <h4 className="sec">{t('Available equipment')}</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>{t('Leave empty to use sensible defaults for gym or home.')}</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 7 }}>
              {EQUIPMENT_CHIPS.map(e => (
                <button key={e} type="button" className={'chip' + (p.equipment.includes(e) ? ' on' : '')} onClick={() => toggleEq(e)} style={{ textTransform: 'capitalize' }}>{e}</button>
              ))}
            </div>

            <ExPickerMini label={t('Favorite exercises (optional)')} selected={p.favorites} onToggle={toggleFav} S={S} />
            <ExPickerMini label={t('Exercises to avoid (optional)')} selected={p.avoid} onToggle={toggleAvoid} S={S} />
          </>
        )}

        {key === 'plan' && plan && (
          <>
            <div className="plan-hero">
              <div className="t-cap">{t('Your plan')}</div>
              <h2 style={{ margin: '6px 0 4px' }}>{goalLabel(p.goal)}</h2>
              <div className="muted small">
                {experienceLabelSafe(p)} · {plan.summary.frequency} · {plan.summary.session}
              </div>
            </div>

            <button type="button" className="why-btn" onClick={() => setShowWhy(v => !v)}>
              <Icon name="lightbulb" /> {t('Why this plan?')}
            </button>
            {showWhy && <div className="why-box">{plan.why}</div>}

            <div className="list" style={{ marginTop: 12 }}>
              {dayRows.map(row => {
                const r = row.routine
                if (!r) return null
                const mins = estimateMinutes(r)
                const muscles = (r._meta?.muscles || routineMuscles(r)).slice(0, 4)
                return (
                  <div key={row.day} className="plan-day-card">
                    <div className="dow">{t(row.dayName)}</div>
                    <div className="body">
                      <div className="rt">{t('Workout')}</div>
                      <div className="ss">
                        {r.ex.length} {t('exercises')} · ~{mins} {t('min')}
                        {muscles.length ? ` · ${muscles.map(m => t(m)).join(', ')}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <h4 className="sec">{t('Sample session')}</h4>
            {(plan.routines[0]?.ex || []).slice(0, 4).map(e => {
              const ex = EXIDX[e.id]
              const scheme = schemeFor(p, e._meta?.role)
              return (
                <div key={e.id} className="ex-rec">
                  <div className="row between">
                    <div className="tt capitalize">{ex?.n || e.id}</div>
                    <button type="button" className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => setWhyEx(whyEx === e.id ? null : e.id)} aria-label={t('Why this?')}>
                      <Icon name="info" />
                    </button>
                  </div>
                  <div className="scheme">{e.sets} × {e.repsMin ? `${e.repsMin}–${e.reps}` : e.reps} · {t('Rest')}: {scheme.restLabel}</div>
                  {e.weight > 0 && (
                    <div className="small muted">
                      {(S.exWeights?.[e.id] || lastHas(S, e.id))
                        ? <>{t('Suggested')}: {fmtNum(e.weight)} {S.unit}</>
                        : <>{t('Starting estimate')}: ~{fmtNum(e.weight)} {S.unit}</>}
                    </div>
                  )}
                  <div className="small dim" style={{ marginTop: 4 }}>
                    {t('Target')}: {[ex?.tg, ...(ex?.sm || []).slice(0, 2)].filter(Boolean).map(x => t(x)).join(' · ')}
                  </div>
                  {e._meta?.alt && EXIDX[e._meta.alt] && (
                    <div className="small muted" style={{ marginTop: 4 }}>{t('Alternative')} → {EXIDX[e._meta.alt].n}</div>
                  )}
                  {whyEx === e.id && (
                    <div className="why-box" style={{ marginTop: 8 }}>
                      <div className="t-cap" style={{ marginBottom: 6 }}>{t('Why this?')}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {(e._meta?.why || []).map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}

            {cals && (
              <div className="calorie-card" style={{ marginTop: 14 }}>
                <div className="t-cap">{t('Nutrition estimate')}</div>
                <div className="small" style={{ marginTop: 6 }}>{t(cals.label)}: <b>{formatKcalRange(cals.low, cals.high)}</b></div>
                <div className="small dim">{t('Optional — enable tracking anytime in Nutrition.')}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="setup-actions">
        {step < STEPS.length - 1 ? (
          <Button variant="primary" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>{t('Continue')}</Button>
        ) : (
          <>
            <Button variant="primary" icon="sparkles" onClick={() => finish(true)}>{t('Use this plan')}</Button>
            <Button variant="ghost" onClick={() => finish(false)}>{t('Save profile only')}</Button>
          </>
        )}
      </div>
      <div style={{ height: 40 }} />
    </div>
  )
}

function experienceLabelSafe(p) {
  return EXPERIENCE.find(e => e.id === p.experience)?.label || ''
}

function lastHas(S, id) {
  return !!(S.exWeights?.[id]?.w || (S.workouts || []).some(w => w.entries.some(e => e.id === id)))
}
