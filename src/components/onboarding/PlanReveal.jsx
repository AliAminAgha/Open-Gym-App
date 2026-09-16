import { fmtNum, DAYN, exCount } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'

export default function PlanReveal({ kcal, macros, dayRows }) {
  return (
    <div>
      <div className="ob-kicker">{t('Your plan')}</div>
      <h2 className="ob-title" style={{ fontSize: 24 }}>{t('We curated this for you')}</h2>
      <p className="ob-sub">{t('Estimates only — tweak anytime. Ready when you are.')}</p>

      <div className="ob-reveal-card ob-kcal-hero">
        <div className="ob-kicker">{t('Calories to eat')}</div>
        <div className="ob-kcal-big">
          {kcal != null ? fmtNum(kcal) : '—'}
          <span className="ob-kcal-unit">kcal</span>
        </div>
        <div className="ob-macros">
          <div className="ob-macro">
            <div className="ob-macro-v">{macros?.protein ?? '—'}</div>
            <div className="ob-macro-k">{t('Protein')}</div>
            <div className="ob-macro-u">g</div>
          </div>
          <div className="ob-macro">
            <div className="ob-macro-v">{macros?.carbs ?? '—'}</div>
            <div className="ob-macro-k">{t('Carbs')}</div>
            <div className="ob-macro-u">g</div>
          </div>
          <div className="ob-macro">
            <div className="ob-macro-v">{macros?.fat ?? '—'}</div>
            <div className="ob-macro-k">{t('Fat')}</div>
            <div className="ob-macro-u">g</div>
          </div>
        </div>
      </div>

      <div className="ob-reveal-card">
        <div className="ob-kicker" style={{ marginBottom: 4 }}>{t('Your week')}</div>
        {(dayRows || []).map(row => (
          <div key={row.day} className="ob-day-row">
            <div className="ob-day-badge">{(DAYN[row.day] || '').slice(0, 3)}</div>
            <div>
              <div className="ob-day-name">{t('Workout')}</div>
              {row.routine && (
                <div className="ob-day-meta">{exCount(row.routine.ex?.length || 0)}</div>
              )}
            </div>
          </div>
        ))}
        {!dayRows?.length && (
          <div className="ob-day-meta">{t('No days scheduled yet')}</div>
        )}
      </div>
    </div>
  )
}
