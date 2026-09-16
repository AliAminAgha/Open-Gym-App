import { useEffect, useRef } from 'react'

const TICK_W = 10

/**
 * Horizontal ruler / scale. Drag to change value; center indicator locks value.
 * step defaults to 0.1 for weight, 1 for height.
 */
export default function RulerSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  majorEvery = 10,
  formatTick,
  ariaLabel = 'Value'
}) {
  const rootRef = useRef(null)
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startVal = useRef(value)

  const count = Math.round((max - min) / step) + 1
  const indexOf = v => Math.round((v - min) / step)
  const valueAt = i => {
    const raw = min + i * step
    const snapped = Math.round(raw / step) * step
    return Math.min(max, Math.max(min, Math.round(snapped * 1000) / 1000))
  }

  const paint = v => {
    const el = rootRef.current
    const track = trackRef.current
    if (!el || !track) return
    const mid = el.clientWidth / 2
    const x = mid - indexOf(v) * TICK_W - TICK_W / 2
    track.style.transform = `translateX(${x}px)`
  }

  useEffect(() => { paint(value) }, [value, min, max, step])

  useEffect(() => {
    const onResize = () => paint(value)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [value])

  const fromDelta = (dx) => {
    const di = Math.round(-dx / TICK_W)
    return valueAt(indexOf(startVal.current) + di)
  }

  const onPointerDown = e => {
    dragging.current = true
    startX.current = e.clientX
    startVal.current = value
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = e => {
    if (!dragging.current) return
    const next = fromDelta(e.clientX - startX.current)
    paint(next)
    if (next !== value) onChange(next)
  }
  const onPointerUp = e => {
    if (!dragging.current) return
    dragging.current = false
    const next = fromDelta(e.clientX - startX.current)
    onChange(next)
    paint(next)
  }

  const ticks = []
  for (let i = 0; i < count; i++) {
    const v = valueAt(i)
    const n = Math.round(v / step)
    const majorStep = Math.round(majorEvery / step)
    const isMajor = n % majorStep === 0
    const isMid = !isMajor && n % Math.max(1, Math.round(majorStep / 2)) === 0
    ticks.push(
      <div key={i} className={'ob-ruler-tick' + (isMajor ? ' major' : isMid ? ' mid' : ' minor')}>
        <i />
        {isMajor && <span>{formatTick ? formatTick(v) : v}</span>}
      </div>
    )
  }

  return (
    <div
      className="ob-ruler"
      ref={rootRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="ob-ruler-center" aria-hidden />
      <div className="ob-ruler-track" ref={trackRef}>{ticks}</div>
    </div>
  )
}
