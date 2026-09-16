import { useEffect, useRef, useState } from 'react'

const ITEM_H = 44
const VISIBLE = 5
const PAD = Math.floor(VISIBLE / 2)

/**
 * Vertical scroll-snap style number wheel. Drag / wheel to pick; no typing.
 */
export default function NumberWheel({ value, onChange, min = 14, max = 80, ariaLabel = 'Value' }) {
  const values = []
  for (let i = min; i <= max; i++) values.push(i)
  const idxOf = v => Math.max(0, Math.min(values.length - 1, values.indexOf(v) === -1
    ? values.findIndex(x => x >= v)
    : values.indexOf(v)))

  const trackRef = useRef(null)
  const startY = useRef(0)
  const startOff = useRef(0)
  const offset = useRef(0)
  const dragging = useRef(false)
  const [, bump] = useState(0)

  const setOffset = (y, snap) => {
    const maxOff = 0
    const minOff = -(values.length - 1) * ITEM_H
    let next = Math.min(maxOff, Math.max(minOff, y))
    if (snap) {
      const i = Math.round(-next / ITEM_H)
      next = -i * ITEM_H
      const v = values[i]
      if (v != null && v !== value) onChange(v)
    }
    offset.current = next
    if (trackRef.current) trackRef.current.style.transform = `translateY(${PAD * ITEM_H + next}px)`
    bump(n => n + 1)
  }

  useEffect(() => {
    const i = idxOf(value)
    offset.current = -i * ITEM_H
    if (trackRef.current) trackRef.current.style.transform = `translateY(${PAD * ITEM_H + offset.current}px)`
  }, [value, min, max])

  const onPointerDown = e => {
    dragging.current = true
    startY.current = e.clientY
    startOff.current = offset.current
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = e => {
    if (!dragging.current) return
    setOffset(startOff.current + (e.clientY - startY.current), false)
  }
  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    setOffset(offset.current, true)
  }

  const onWheel = e => {
    e.preventDefault()
    const i = idxOf(value)
    const next = e.deltaY > 0 ? Math.min(max, values[i] + 1) : Math.max(min, values[i] - 1)
    if (next !== value) onChange(next)
  }

  const active = idxOf(value)

  return (
    <div
      className="ob-wheel"
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="ob-wheel-mark" aria-hidden />
      <div className="ob-wheel-track" ref={trackRef}>
        {values.map((v, i) => (
          <div key={v} className={'ob-wheel-item' + (i === active ? ' on' : '')}>{v}</div>
        ))}
      </div>
    </div>
  )
}
