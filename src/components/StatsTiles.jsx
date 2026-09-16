import { useStore } from '../store/useStore.js'
import { lastBW, streakWeeks } from '../lib/history.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwDeltaColor } from '../sheets.jsx'
import Icon from './Icon.jsx'

export default function StatsTiles({ className = '' }) {
  const S = useStore(s => s.S)
  const now = Date.now()
  const monthW = S.workouts.filter(w => w.d.slice(0, 7) === todayISO().slice(0, 7)).length
  const bw30 = S.bodyweight.filter(b => (b.t || new Date(b.d).getTime()) > now - 30 * 86400000)
  const bwDelta30 = bw30.length > 1 ? bw30[bw30.length - 1].w - bw30[0].w : null
  const streak = streakWeeks(S)

  return (
    <div className={'tiles' + (className ? ' ' + className : '')}>
      <div className="tile">
        <div className="l"><Icon name="dumbbell" />{t('Workouts')}</div>
        <div className="v">{S.workouts.length}</div>
      </div>
      <div className="tile">
        <div className="l"><Icon name="calendar" />{t('This month')}</div>
        <div className="v">{monthW}</div>
      </div>
      <div className="tile">
        <div className="l"><Icon name="flame" />{t('Week streak')}</div>
        <div className="v">{streak}</div>
      </div>
      <div className="tile">
        <div className="l"><Icon name="scale" />{t('Weight 30d')}</div>
        <div
          className="v"
          style={{
            fontSize: 22,
            color: bwDelta30 === null ? 'inherit' : bwDeltaColor(bwDelta30, (lastBW(S) || {}).w || 0)
          }}
        >
          {bwDelta30 === null ? '—' : (bwDelta30 > 0 ? '+' : '') + fmtNum(bwDelta30) + ' ' + S.unit}
        </div>
      </div>
    </div>
  )
}
