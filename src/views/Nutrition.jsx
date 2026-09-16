// Optional daily nutrition log — never required for core training.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { lastBW } from '../lib/history.js'
import { emptyProfile, hasProfile, currentWeightKg } from '../lib/profile.js'
import { calorieSuggestion, proteinSuggestion, formatKcalRange } from '../lib/calories.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField } from '../components/ui.jsx'

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const profile = S.profile || emptyProfile()
  const nut = profile.nutrition || { enabled: false, calorieTarget: null, proteinTarget: null, log: [] }
  const today = todayISO()
  const entry = (nut.log || []).find(x => x.d === today) || { d: today, kcal: null, protein: null }

  const [kcal, setKcal] = useState(entry.kcal ?? '')
  const [protein, setProtein] = useState(entry.protein ?? '')

  const kg = currentWeightKg(S)
  const cals = calorieSuggestion(profile, kg, S.unit)
  const protSug = proteinSuggestion(profile, kg)
  const targetK = nut.calorieTarget || (cals ? Math.round((cals.low + cals.high) / 2) : null)
  const targetP = nut.proteinTarget || protSug
  const bw = lastBW(S)

  const enable = () => {
    update(s => {
      const p = (s.profile = s.profile || emptyProfile())
      p.nutrition = {
        enabled: true,
        calorieTarget: targetK,
        proteinTarget: targetP,
        log: p.nutrition?.log || []
      }
    })
    toast(t('Nutrition tracking on'))
  }

  const save = () => {
    update(s => {
      const p = (s.profile = s.profile || emptyProfile())
      const n = (p.nutrition = p.nutrition || { enabled: true, calorieTarget: targetK, proteinTarget: targetP, log: [] })
      n.enabled = true
      const log = n.log || []
      const i = log.findIndex(x => x.d === today)
      const row = { d: today, kcal: Number(kcal) || 0, protein: Number(protein) || 0 }
      if (i >= 0) log[i] = row
      else log.push(row)
      n.log = log.slice(-60)
    })
    toast(t('Saved'))
  }

  if (!hasProfile(S)) {
    return (
      <div className="narrow">
        <div className="hdr">
          <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
          <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Nutrition')}</h1></div>
        </div>
        <div className="card">
          <div className="muted small" style={{ marginBottom: 12 }}>{t('Complete Training Setup first to get calorie estimates.')}</div>
          <Button variant="primary" onClick={() => nav('/onboarding')}>{t('Get started')}</Button>
        </div>
      </div>
    )
  }

  if (!nut.enabled) {
    return (
      <div className="narrow">
        <div className="hdr">
          <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
          <div style={{ flex: 1, marginLeft: 10 }}>
            <h1>{t('Nutrition')}</h1>
            <div className="sub">{t('Optional — estimates only')}</div>
          </div>
        </div>
        <div className="card">
          <p className="muted small">{t('Track calories and protein if you want. Training works fine without this.')}</p>
          {cals && (
            <div className="calorie-card" style={{ margin: '14px 0' }}>
              <div className="t-cap">{t('Suggested range')}</div>
              <div className="big" style={{ fontSize: 26, marginTop: 6 }}>{formatKcalRange(cals.low, cals.high)}</div>
              <div className="small dim">{t('Protein')}: ~{protSug} g · {t('Estimates only')}</div>
            </div>
          )}
          <Button variant="primary" onClick={enable}>{t('Enable nutrition tracking')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
        <div style={{ flex: 1, marginLeft: 10 }}>
          <h1>{t('Nutrition')}</h1>
          <div className="sub">{t('Estimates only — not medical advice')}</div>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="l">{t('Calories')}</div>
          <div className="v" style={{ fontSize: 22 }}>{Number(kcal) || 0}<span className="dim" style={{ fontSize: 14 }}> / {targetK || '—'}</span></div>
        </div>
        <div className="tile">
          <div className="l">{t('Protein')}</div>
          <div className="v" style={{ fontSize: 22 }}>{Number(protein) || 0}<span className="dim" style={{ fontSize: 14 }}> / {targetP || '—'} g</span></div>
        </div>
        <div className="tile">
          <div className="l">{t('Weight')}</div>
          <div className="v" style={{ fontSize: 22 }}>{bw ? fmtNum(bw.w) : '—'}{bw ? <span className="dim" style={{ fontSize: 14 }}> {S.unit}</span> : null}</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t('Today')}</h2>
        <label className="field-block">
          <span className="lbl">{t('Calories (kcal)')}</span>
          <NumberField decimal={false} value={kcal} onChange={setKcal} />
        </label>
        <label className="field-block">
          <span className="lbl">{t('Protein (g)')}</span>
          <NumberField decimal={false} value={protein} onChange={setProtein} />
        </label>
        <Button variant="primary" onClick={save}>{t('Save today')}</Button>
        <div style={{ height: 8 }} />
        <Button variant="ghost" onClick={() => update(s => { if (s.profile?.nutrition) s.profile.nutrition.enabled = false })}>{t('Turn off tracking')}</Button>
      </div>
    </div>
  )
}
