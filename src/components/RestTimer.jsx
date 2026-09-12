import { useEffect } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

export default function RestTimer() {
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const { addRest, stopRest, finishWorkEarly, stopWork } = useUI()
  const on = work || timer
  useEffect(() => {
    document.body.classList.toggle('resting', !!on)
    return () => document.body.classList.remove('resting')
  }, [!!on])
  if (!on) return null
  const pct = (on.left / on.total) * 100

  if (work) {
    return (
      <div id="timer" className="working">
        <div className="t">{clock(work.left)}</div>
        <div className="grow">
          {work.label && <div className="lbl">{work.label}</div>}
          <div className="bar"><i style={{ width: pct + '%' }} /></div>
        </div>
        <Button size="sm" onClick={stopWork}>{t('Cancel')}</Button>
        <Button size="sm" variant="primary" icon="check" onClick={finishWorkEarly}>{t('Done')}</Button>
      </div>
    )
  }

  return (
    <div id="timer" className="rest">
      <div className="head">
        <div>
          <div className="t-cap" style={{ color: 'var(--acc)', marginBottom: 2 }}>{t('Rest')}</div>
          <div className="t">{clock(timer.left)}</div>
        </div>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
      </div>
      <div className="acts">
        <Button size="sm" icon="minus" onClick={() => addRest(-15)}>15s</Button>
        <Button size="sm" icon="plus" onClick={() => addRest(15)}>15s</Button>
        <Button size="sm" variant="primary" className="skip" onClick={stopRest}>{t('Skip')}</Button>
      </div>
    </div>
  )
}
