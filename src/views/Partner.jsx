import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { partnerDetailStats } from '../components/PartnerCard.jsx'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { partnerSheet } from '../sheets.jsx'
import { decodePartnerLink } from '../lib/partner.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

function CompareRow({ label, you, them, unit }) {
  return (
    <div className="partner-row">
      <div className="partner-row-l">{label}</div>
      <div className="partner-row-v you">{you ?? '—'}{unit ? ' ' + unit : ''}</div>
      <div className="partner-row-v them">{them ?? '—'}{unit ? ' ' + unit : ''}</div>
    </div>
  )
}

function ActivityStrip({ activity, label, side }) {
  return (
    <div className={'partner-detail-week' + (side ? ' ' + side : '')}>
      <div className="partner-detail-week-l">{label}</div>
      <div className="partner-week">
        {activity.map((done, i) => (
          <div key={i} className={'partner-dot' + (done ? ' done' : '')} title={String(i + 1)} />
        ))}
      </div>
    </div>
  )
}

export default function Partner() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const S = useStore(s => s.S)
  const partner = useStore(s => s.partner)
  const importPartner = useStore(s => s.importPartner)

  useEffect(() => {
    const d = params.get('d')
    if (!d) return
    try {
      const summary = decodePartnerLink(decodeURIComponent(d))
      importPartner(summary)
      nav('/partner', { replace: true })
    } catch (e) { /* invalid deeplink — ignore */ }
  }, [params, importPartner, nav])

  if (!partner?.summary) {
    return (
      <div className="narrow">
        <div className="hdr">
          <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
          <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Partner')}</h1></div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="muted">{t('No partner linked yet.')}</p>
          <Button variant="primary" onClick={partnerSheet}>{t('Link your partner')}</Button>
        </div>
      </div>
    )
  }

  const { mine, theirs } = partnerDetailStats(S, partner.summary)
  const unit = S.unit || 'kg'

  const partnerAccent = partner.summary?.accent || '#ff2d9a'

  return (
    <div className="narrow partner-view" style={{ '--partner-acc': partnerAccent }}>
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
        <div style={{ flex: 1, marginLeft: 10 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="partner-accent-dot" aria-hidden />
            {partner.name || t('Partner')}
          </h1>
        </div>
        <button className="iconbtn" onClick={partnerSheet} aria-label={t('Partner settings')}><Icon name="gear" /></button>
      </div>

      <div className="partner-detail-head">
        <div className="partner-detail-col-label you">{t('You')}</div>
        <div />
        <div className="partner-detail-col-label them">{partner.name || t('Partner')}</div>
      </div>

      <div className="card partner-detail-card">
        <CompareRow label={t('Week streak')} you={mine.streakWeeks} them={theirs.streakWeeks} />
        <CompareRow label={t('This month')} you={mine.workoutsThisMonth} them={theirs.workoutsThisMonth} />
        <CompareRow label={t('Total workouts')} you={mine.totalWorkouts} them={theirs.totalWorkouts} />
        <CompareRow
          label={t('Today')}
          you={mine.trainedToday ? t('Yes') : t('No')}
          them={theirs.trainedToday ? t('Yes') : t('No')}
        />
      </div>

      <ActivityStrip activity={mine.weekActivity} label={t('Your week')} side="you" />
      <ActivityStrip activity={theirs.weekActivity} label={t('{0}’s week', partner.name || t('Partner'))} side="them" />

      {(mine.goal || theirs.goal) && (
        <div className="card partner-detail-card" style={{ marginTop: 14 }}>
          <h4 className="sec" style={{ marginTop: 0 }}>{t('Goals')}</h4>
          {mine.goal && (
            <div className="partner-goal-block">
              <div className="small dim">{t('You')}</div>
              <div>{mine.goal.typeLabel} · {fmtNum(mine.goal.currentW)} → {fmtNum(mine.goal.targetW)} {unit}</div>
            </div>
          )}
          {theirs.goal && (
            <div className="partner-goal-block">
              <div className="small dim">{partner.name || t('Partner')}</div>
              <div>{theirs.goal.typeLabel} · {fmtNum(theirs.goal.currentW)} → {fmtNum(theirs.goal.targetW)} {theirs.goal.unit || unit}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 12 }} />
      <Button variant="tinted" icon="reset" onClick={partnerSheet}>{t('Refresh or manage partner')}</Button>
    </div>
  )
}
