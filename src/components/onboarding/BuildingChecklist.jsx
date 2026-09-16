import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'

const ITEMS = [
  'Crunching your numbers',
  'Setting daily calories',
  'Dialing in protein, carbs & fat',
  'Building your week',
  'Picking starter exercises'
]

export default function BuildingChecklist({ onDone, duration = 2200 }) {
  const [done, setDone] = useState(0)

  useEffect(() => {
    const stepMs = duration / ITEMS.length
    let i = 0
    const t = setInterval(() => {
      i++
      setDone(i)
      if (i >= ITEMS.length) {
        clearInterval(t)
        setTimeout(() => onDone?.(), 280)
      }
    }, stepMs)
    return () => clearInterval(t)
  }, [duration, onDone])

  return (
    <div className="ob-build">
      <h2 className="ob-build-title">Building your plan</h2>
      {ITEMS.map((label, i) => {
        const state = i < done ? 'done' : i === done ? 'active' : ''
        return (
          <div key={label} className={'ob-build-item' + (state ? ' ' + state : '')}>
            <span className="ob-build-check" aria-hidden>
              {i < done ? <Icon name="check" /> : null}
            </span>
            {label}
          </div>
        )
      })}
    </div>
  )
}
