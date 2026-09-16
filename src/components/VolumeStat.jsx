import { useMemo } from 'react'
import { sessionVolumeFact } from '../lib/volume-facts.js'
import { t } from '../lib/i18n.js'

export default function VolumeStat({ totalVol, unit, fmtVol, onClick }) {
  const fact = useMemo(() => sessionVolumeFact(totalVol, unit), [totalVol, unit])

  return (
    <button type="button" className="home-big-stat" onClick={onClick}>
      <div className="v">{totalVol ? fmtVol(totalVol, unit) : '—'}</div>
      <div className="k">{t('Lifted volume')}</div>
      {fact && <div className="k-fact">{fact}</div>}
    </button>
  )
}
