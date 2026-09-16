import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { fmtNum } from '../../lib/format.js'
import {
  emptyProfile, GOALS, EXPERIENCE, SESSION_OPTS, LOSS_PACE, weightToKg
} from '../../lib/profile.js'
import {
  calorieSuggestion, macroSuggestion, suggestedTargetWeight
} from '../../lib/calories.js'
import { generatePlan, applyGeneratedPlanToState, formatDayPlan } from '../../lib/plan-gen.js'
import { lastBW } from '../../lib/history.js'
import Icon from '../../components/Icon.jsx'
import NumberWheel from '../../components/onboarding/NumberWheel.jsx'
import RulerSlider from '../../components/onboarding/RulerSlider.jsx'
import ChoiceCards from '../../components/onboarding/ChoiceCards.jsx'
import BuildingChecklist from '../../components/onboarding/BuildingChecklist.jsx'
import PlanReveal from '../../components/onboarding/PlanReveal.jsx'
import '../../lib/onboarding.css'

const BASE_STEPS = [
  'welcome', 'sex', 'age', 'height', 'weight',
  'goal', 'target', 'days', 'session', 'experience', 'place',
  'building', 'reveal'
]

const DEFAULT_DAYS = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6]
}

const GOAL_COPY = {
  fatloss: { label: 'Lose fat', sub: 'Dial in a leaner look' },
  muscle: { label: 'Build muscle', sub: 'Add size the smart way' },
  recomp: { label: 'Recomp', sub: 'Build + lean at once' },
  strength: { label: 'Get stronger', sub: 'Move bigger weights' },
  maintain: { label: 'Stay where you are', sub: 'Keep the wins rolling' },
  fitness: { label: 'Feel fitter', sub: 'Energy, mood, consistency' }
}

function bmiOf(kg, heightCm) {
  if (!(kg > 0) || !(heightCm > 0)) return null
  const m = heightCm / 100
  return Math.round((kg / (m * m)) * 10) / 10
}

function bmiLabel(bmi) {
  if (bmi == null) return null
  if (bmi < 18.5) return { text: t('Underweight'), ok: false }
  if (bmi < 25) return { text: t('Healthy range'), ok: true }
  if (bmi < 30) return { text: t('Overweight'), ok: false }
  return { text: t('Obese range'), ok: false }
}

function cmToFtIn(cm) {
  const total = Math.round(cm / 2.54)
  return { ft: Math.floor(total / 12), inch: total % 12 }
}

function AnimatedNum({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { fromRef.current = to; setDisplay(to); return }
    const t0 = performance.now()
    const dur = 180
    let raf
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * eased
      const shown = decimals ? Math.round(v * 10) / 10 : Math.round(v)
      setDisplay(shown)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, decimals])
  return <>{decimals ? fmtNum(display) : display}</>
}

export default function Onboarding() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const restarting = params.get('restart') === '1'
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)

  const [stepId, setStepId] = useState('welcome')
  const [heightUnit, setHeightUnit] = useState('cm')
  const [p, setP] = useState(() => {
    const defaults = {
      ...emptyProfile(),
      age: 28,
      sex: null,
      heightCm: 170,
      experience: null,
      goal: null,
      targetW: null,
      lossPace: 'moderate',
      daysPerWeek: 3,
      sessionMin: 45,
      preferredDays: [1, 3, 5],
      activity: 'moderate',
      location: 'gym',
      style: 'custom'
    }
    if (restarting && S.profile?.completedAt) {
      return {
        ...defaults,
        ...S.profile,
        style: 'custom',
        nutrition: S.profile.nutrition || defaults.nutrition
      }
    }
    return defaults
  })
  const [weight, setWeight] = useState(() => {
    const bw = lastBW(S)?.w
    if (bw > 0) return bw
    return S.unit === 'lb' ? 165 : 75
  })

  const set = patch => setP(v => ({ ...v, ...patch }))

  const steps = useMemo(() => {
    const g = GOALS.find(x => x.id === p.goal)
    return BASE_STEPS.filter(id => id !== 'target' || g?.needsTarget)
  }, [p.goal])

  const stepIndex = Math.max(0, steps.indexOf(stepId))
  const progressCount = steps.filter(s => s !== 'welcome' && s !== 'building' && s !== 'reveal').length
  const progressDone = steps.slice(0, stepIndex + 1).filter(s => s !== 'welcome' && s !== 'building' && s !== 'reveal').length

  useEffect(() => {
    document.documentElement.setAttribute('data-onboarding', '1')
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.content
    if (meta) meta.content = '#F7F7F5'
    return () => {
      document.documentElement.removeAttribute('data-onboarding')
      if (meta && prev) meta.content = prev
    }
  }, [])

  // Preselect an ideal / goal-aware target when landing on the target step
  useEffect(() => {
    if (stepId !== 'target' || p.targetW != null) return
    const next = suggestedTargetWeight(p.heightCm, weight, S.unit, p.goal)
    if (next != null) set({ targetW: next })
  }, [stepId, p.targetW, p.goal, p.heightCm, weight, S.unit])

  const kg = weightToKg(weight, S.unit) || weight
  const bmi = bmiOf(kg, p.heightCm)
  const bmiInfo = bmiLabel(bmi)

  const profileForCalc = useMemo(() => ({ ...p }), [p])

  const cals = useMemo(
    () => calorieSuggestion(profileForCalc, kg, S.unit),
    [profileForCalc, kg, S.unit]
  )
  const intakeKcal = cals ? Math.round((cals.low + cals.high) / 2) : null
  const macros = useMemo(
    () => (intakeKcal ? macroSuggestion(profileForCalc, kg, intakeKcal) : null),
    [profileForCalc, kg, intakeKcal]
  )
  const plan = useMemo(() => generatePlan(profileForCalc, S), [profileForCalc, S])
  const dayRows = useMemo(() => formatDayPlan(plan), [plan])

  const canContinue = () => {
    switch (stepId) {
      case 'welcome': return true
      case 'sex': return !!p.sex
      case 'age': return p.age >= 14
      case 'height': return p.heightCm >= 120
      case 'weight': return weight > 0
      case 'goal': return !!p.goal
      case 'target': {
        if (!(p.targetW > 0)) return false
        if (p.goal === 'fatloss') return p.targetW < weight
        if (p.goal === 'muscle') return p.targetW > weight
        return true
      }
      case 'days': return p.daysPerWeek >= 2
      case 'session': return true // optional — skip allowed
      case 'experience': return !!p.experience
      case 'place': return !!p.location
      default: return true
    }
  }

  const goNext = () => {
    const i = steps.indexOf(stepId)
    if (i < 0 || i >= steps.length - 1) return
    setStepId(steps[i + 1])
  }

  const goBack = () => {
    const i = steps.indexOf(stepId)
    if (i <= 0) return
    setStepId(steps[i - 1])
  }

  const setDaysPerWeek = n => {
    set({ daysPerWeek: n, preferredDays: DEFAULT_DAYS[n] || DEFAULT_DAYS[3] })
  }

  const skipSession = () => {
    if (!p.sessionMin) set({ sessionMin: 45 })
    goNext()
  }

  const finish = (dest) => {
    const now = Date.now()
    const prevNutrition = S.profile?.nutrition
    update(s => {
      s.profile = {
        ...emptyProfile(),
        ...p,
        completedAt: p.completedAt || now,
        updatedAt: now,
        style: 'custom',
        equipment: p.location === 'home'
          ? (p.equipment?.length ? p.equipment : ['dumbbell', 'body weight', 'band'])
          : (p.equipment || [])
      }
      if (p.targetW > 0) {
        s.targetW = p.targetW
        if (p.goal === 'fatloss' && weight > p.targetW) {
          s.profile.lossAmount = Math.round((weight - p.targetW) * 10) / 10
        }
      }
      if (weight > 0) {
        const d = new Date().toISOString().slice(0, 10)
        const last = s.bodyweight[s.bodyweight.length - 1]
        if (!last || last.d !== d) s.bodyweight.push({ d, w: weight, t: now })
        else { last.w = weight; last.t = now }
      }
      if (s.profile.nutrition) {
        s.profile.nutrition = {
          enabled: true,
          calorieTarget: macros?.kcal ?? prevNutrition?.calorieTarget ?? null,
          proteinTarget: macros?.protein ?? prevNutrition?.proteinTarget ?? null,
          log: prevNutrition?.log || []
        }
      }
      applyGeneratedPlanToState(s, plan)
    })
    toast(restarting ? t('Plan updated') : t('Your plan is ready'))
    nav(dest)
  }

  const onBuilt = useCallback(() => setStepId('reveal'), [])

  const heightDisplay = heightUnit === 'cm'
    ? p.heightCm
    : (() => { const { ft, inch } = cmToFtIn(p.heightCm); return `${ft}'${inch}"` })()

  const goalOpts = GOALS.map(g => {
    const copy = GOAL_COPY[g.id] || { label: g.label, sub: null }
    return {
      id: g.id,
      label: t(copy.label),
      icon: g.id === 'fatloss' ? 'flame' : g.id === 'muscle' ? 'dumbbell' : g.id === 'strength' ? 'bolt' : g.id === 'recomp' ? 'sparkles' : 'target',
      sub: copy.sub ? t(copy.sub) : null
    }
  })

  const sessionOpts = SESSION_OPTS.map(m => ({
    id: String(m),
    label: `${m} ${t('min')}`,
    sub: m <= 30 ? t('Quick hit') : m <= 45 ? t('Sweet spot') : m <= 60 ? t('Solid session') : t('Go deep'),
    icon: 'timer'
  }))

  const xpOpts = EXPERIENCE.map(e => ({
    id: e.id,
    label: t(e.label),
    icon: e.id === 'beginner' ? 'sparkles' : e.id === 'intermediate' ? 'flame' : 'bolt',
    sub: e.id === 'beginner'
      ? t('Just getting started — we’ll keep it simple')
      : e.id === 'intermediate'
        ? t('You know your way around the gym')
        : t('You train with a plan already')
  }))

  const renderStep = () => {
    switch (stepId) {
      case 'welcome':
        return (
          <div className="ob-welcome-hero">
            <div className="ob-brand">openGym</div>
            <h1 className="ob-title" style={{ fontSize: 36 }}>
              {restarting ? t('Let’s refresh your plan') : t('Ready when you are')}
            </h1>
            <p className="ob-sub">
              {restarting
                ? t('We’ll keep what you already told us — tweak anything, then update your plan.')
                : t('A few quick taps and we’ll build a plan that fits you — no forms, no homework.')}
            </p>
          </div>
        )
      case 'sex':
        return (
          <>
            <div className="ob-kicker">{t('About you')}</div>
            <h2 className="ob-title">{t('First up — who are we planning for?')}</h2>
            <p className="ob-sub">{t('Helps us estimate calories accurately. Easy to change later.')}</p>
            <ChoiceCards
              grid
              value={p.sex}
              onChange={v => set({ sex: v })}
              options={[
                { id: 'male', label: t('Male'), icon: 'personMale' },
                { id: 'female', label: t('Female'), icon: 'personFemale' }
              ]}
            />
          </>
        )
      case 'age':
        return (
          <>
            <div className="ob-kicker">{t('About you')}</div>
            <h2 className="ob-title">{t('How old are you?')}</h2>
            <p className="ob-sub">{t('Spin the wheel — no typing.')}</p>
            <div className="ob-num-wrap">
              <div className="ob-num"><AnimatedNum value={p.age} /></div>
              <NumberWheel value={p.age} min={14} max={80} onChange={v => set({ age: v })} ariaLabel={t('Age')} />
            </div>
          </>
        )
      case 'height':
        return (
          <>
            <div className="ob-kicker">{t('About you')}</div>
            <h2 className="ob-title">{t('How tall are you?')}</h2>
            <p className="ob-sub">{t('Slide until it feels right.')}</p>
            <div className="ob-num-wrap">
              <div className="ob-unit-toggle">
                <button type="button" className={heightUnit === 'cm' ? 'on' : ''} onClick={() => setHeightUnit('cm')}>cm</button>
                <button type="button" className={heightUnit === 'ft' ? 'on' : ''} onClick={() => setHeightUnit('ft')}>ft</button>
              </div>
              <div className="ob-num">
                {heightUnit === 'cm'
                  ? <><AnimatedNum value={p.heightCm} /><span className="ob-num-unit">cm</span></>
                  : <span>{heightDisplay}</span>}
              </div>
            </div>
            <RulerSlider
              value={p.heightCm}
              onChange={v => set({ heightCm: v })}
              min={140}
              max={210}
              step={1}
              majorEvery={10}
              ariaLabel={t('Height')}
            />
          </>
        )
      case 'weight': {
        const wMin = S.unit === 'lb' ? 90 : 40
        const wMax = S.unit === 'lb' ? 330 : 150
        const wStep = S.unit === 'lb' ? 0.5 : 0.1
        return (
          <>
            <div className="ob-kicker">{t('About you')}</div>
            <h2 className="ob-title">{t('What’s your weight?')}</h2>
            <p className="ob-sub">{t('Be honest — this stays private.')}</p>
            <div className="ob-num-wrap">
              <div className="ob-num">
                <AnimatedNum value={weight} decimals={1} />
                <span className="ob-num-unit">{S.unit}</span>
              </div>
              {bmiInfo && (
                <span className={'ob-chip' + (bmiInfo.ok ? ' ok' : '')}>
                  BMI {bmi} · {bmiInfo.text}
                </span>
              )}
            </div>
            <RulerSlider
              value={weight}
              onChange={setWeight}
              min={wMin}
              max={wMax}
              step={wStep}
              majorEvery={S.unit === 'lb' ? 10 : 5}
              ariaLabel={t('Weight')}
            />
          </>
        )
      }
      case 'goal':
        return (
          <>
            <div className="ob-kicker">{t('Goal')}</div>
            <h2 className="ob-title">{t('What’s the main mission?')}</h2>
            <p className="ob-sub">{t('Pick one focus — you can switch later.')}</p>
            <ChoiceCards value={p.goal} onChange={v => set({ goal: v, targetW: null })} options={goalOpts} />
          </>
        )
      case 'target': {
        const wMin = S.unit === 'lb' ? 90 : 40
        const wMax = S.unit === 'lb' ? 330 : 150
        const wStep = S.unit === 'lb' ? 0.5 : 0.1
        const target = p.targetW ?? weight
        return (
          <>
            <div className="ob-kicker">{t('Goal')}</div>
            <h2 className="ob-title">{t('Where do you want to land?')}</h2>
            <p className="ob-sub">{t('We pre-filled a solid target — nudge it if you want.')}</p>
            <div className="ob-num-wrap">
              <div className="ob-num">
                <AnimatedNum value={target} decimals={1} />
                <span className="ob-num-unit">{S.unit}</span>
              </div>
              <span className="ob-chip">
                {fmtNum(weight)} → {fmtNum(target)} {S.unit}
              </span>
            </div>
            <RulerSlider
              value={target}
              onChange={v => set({ targetW: v })}
              min={wMin}
              max={wMax}
              step={wStep}
              majorEvery={S.unit === 'lb' ? 10 : 5}
              ariaLabel={t('Target weight')}
            />
            {p.goal === 'fatloss' && (
              <div className="ob-pace">
                {LOSS_PACE.map(x => (
                  <button
                    key={x.id}
                    type="button"
                    className={p.lossPace === x.id ? 'on' : ''}
                    onClick={() => set({ lossPace: x.id })}
                  >
                    {t(x.label)}
                  </button>
                ))}
              </div>
            )}
          </>
        )
      }
      case 'days':
        return (
          <>
            <div className="ob-kicker">{t('Training')}</div>
            <h2 className="ob-title">{t('How many days a week?')}</h2>
            <p className="ob-sub">{t('Just the number — we’ll fill the week for you.')}</p>
            <ChoiceCards
              grid
              value={String(p.daysPerWeek)}
              onChange={v => setDaysPerWeek(Number(v))}
              options={[2, 3, 4, 5, 6].map(n => ({
                id: String(n),
                label: String(n),
                sub: t('days / week')
              }))}
            />
          </>
        )
      case 'session':
        return (
          <>
            <div className="ob-kicker">{t('Training')}</div>
            <h2 className="ob-title">{t('How long per session?')}</h2>
            <p className="ob-sub">{t('Optional — skip if you’re not sure yet.')}</p>
            <ChoiceCards
              grid
              value={String(p.sessionMin)}
              onChange={v => set({ sessionMin: Number(v) })}
              options={sessionOpts}
            />
          </>
        )
      case 'experience':
        return (
          <>
            <div className="ob-kicker">{t('Training')}</div>
            <h2 className="ob-title">{t('Where are you at?')}</h2>
            <p className="ob-sub">{t('No judgment — this sizes the workouts.')}</p>
            <ChoiceCards value={p.experience} onChange={v => set({ experience: v })} options={xpOpts} />
          </>
        )
      case 'place':
        return (
          <>
            <div className="ob-kicker">{t('Training')}</div>
            <h2 className="ob-title">{t('Where do you train?')}</h2>
            <p className="ob-sub">{t('We’ll match the equipment.')}</p>
            <ChoiceCards
              grid
              value={p.location}
              onChange={v => set({ location: v })}
              options={[
                { id: 'gym', label: t('Gym'), icon: 'dumbbell', sub: t('Machines & free weights') },
                { id: 'home', label: t('Home'), icon: 'house', sub: t('Dumbbells, bands, bodyweight') }
              ]}
            />
          </>
        )
      case 'building':
        return <BuildingChecklist onDone={onBuilt} />
      case 'reveal':
        return <PlanReveal kcal={intakeKcal} macros={macros} dayRows={dayRows} />
      default:
        return null
    }
  }

  const showBack = stepId !== 'building' && (stepId !== 'welcome' || restarting)
  const showFooter = stepId !== 'building'
  const isReveal = stepId === 'reveal'
  const isWelcome = stepId === 'welcome'
  const isSession = stepId === 'session'

  const onBack = () => {
    if (stepId === 'welcome' && restarting) {
      nav('/settings')
      return
    }
    goBack()
  }

  return (
    <div data-onboarding className="ob-shell">
      <div className="ob-top">
        <button type="button" className="ob-back" onClick={onBack} disabled={!showBack} aria-label={t('Back')}>
          <Icon name="chevronLeft" />
        </button>
        <div className="ob-progress" aria-hidden>
          {Array.from({ length: Math.max(progressCount, 1) }).map((_, i) => (
            <span key={i} className={i < progressDone ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="ob-body">
        <div className="ob-step" key={stepId}>
          {renderStep()}
        </div>
      </div>

      {showFooter && (
        <div className="ob-footer">
          {isReveal ? (
            <>
              <button type="button" className="ob-cta" onClick={() => finish('/home')}>
                {restarting ? t('Update plan') : t('Use this plan')}
              </button>
              <button type="button" className="ob-cta-ghost" onClick={() => finish('/plan')}>
                {t('I’ll customize')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ob-cta"
                disabled={!canContinue()}
                onClick={goNext}
              >
                {isWelcome ? (restarting ? t('Continue') : t('Let’s go')) : t('Continue')}
              </button>
              {isSession && (
                <button type="button" className="ob-cta-ghost" onClick={skipSession}>
                  {t('Skip for now')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
