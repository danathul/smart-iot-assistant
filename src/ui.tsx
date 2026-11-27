import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { formatTime, readingSeverity, sensors } from './model'
import type { HistoryPoint, Sensor, Severity } from './model'
import { icons } from './icons'

export function Icon({ name, scope = 'dashboard', mobile = false }: { name: string; scope?: string; mobile?: boolean }) {
  const desktop = icons[scope]?.[name] ?? icons.dashboard[name]
  const compact = mobile ? icons.mobile[name] : undefined
  if (!desktop) return null
  return <picture className="icon">
    {compact && <source media="(max-width: 760px)" srcSet={`./icons/${compact}`} />}
    <img src={`./icons/${desktop}`} alt="" />
  </picture>
}
export function Orb({ icon, scope, mobile, className = '' }: { icon: string; scope?: string; mobile?: boolean; className?: string }) {
  return <span className={`orb ${className}`} aria-hidden="true"><Icon name={icon} scope={scope} mobile={mobile} /></span>
}
export function Brand() {
  return <a className="brand" href="#overview">
    <span className="brand-mark"><Icon name="HomeIcon" mobile /><i /></span>
    <span><strong>SENSEORA</strong><small>Intelligence That Watches Over</small></span>
  </a>
}
export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>
}
export function Notice({ children, error = false, retry }: { children: ReactNode; error?: boolean; retry?: () => void }) {
  return <div className={`notice ${error ? 'danger' : ''}`} role={error ? 'alert' : 'status'}>
    <span>{children}</span>{retry && <button onClick={retry}>Retry</button>}
  </div>
}
export const tone = (severity?: Severity) => severity === 'Critical' ? 'danger' : severity === 'Warning' ? 'warning' : severity === 'Info' ? 'accent' : 'safe'
export const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)

export function SensorCard({ sensor, value }: { sensor: Sensor; value: number }) {
  const info = sensors[sensor]
  const severity = readingSeverity(sensor, value)
  return <article className="panel sensor">
    <div className="sensor-top"><Orb icon={info.icon} mobile /><Badge tone={tone(severity)}>{severity ? 'Elevated' : 'Normal'}</Badge></div>
    <h3>{info.label}</h3>
    <div className="reading"><motion.strong key={value} initial={{ opacity: .55 }} animate={{ opacity: 1 }}>{number(value)}</motion.strong><span>{info.unit}</span></div>
    <small className={tone(severity)}>{severity ? 'Above threshold' : '● Normal'}</small>
  </article>
}
export function Trend({ sensor, points, compact = false }: { sensor: Sensor; points: HistoryPoint[]; compact?: boolean }) {
  const id = useId()
  const info = sensors[sensor]
  const [active, setActive] = useState<number | null>(null)
  useEffect(() => { setActive(null) }, [sensor, points])
  const selected = active === null ? undefined : points[active]
  const values = points.map(p => p.value)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const range = max - min
  const step = Math.max(info.unit === '°C' ? 1 : 2, Math.ceil((range || 4) / 3))
  const low = Math.floor(min / step) * step - step
  const high = Math.max(low + step * 3, max + step / 2)
  const x = (i: number) => points.length === 1 ? 50 : i / (points.length - 1) * 100
  const y = (value: number) => 100 - (value - low) / (high - low) * 100
  const chartPoints = points.map((p, i) => [x(i), y(p.value)])
  const line = chartPoints.map(([px, py], i) => {
    if (!i) return 'M ' + px + ' ' + py
    const [prevX, prevY] = chartPoints[i - 1]
    const middle = (prevX + px) / 2
    return ' C ' + middle + ' ' + prevY + ', ' + middle + ' ' + py + ', ' + px + ' ' + py
  }).join('')
  const ticks = [...new Set([0, Math.floor(points.length / 3), Math.floor(points.length * 2 / 3), points.length - 1])]
  return <section className={`panel trend ${compact ? 'compact' : ''}`}>
    <h2>{sensor === 'energy' ? 'Energy usage' : info.label + ' trend'}</h2>
    <p className="muted">{selected ? formatTime(selected.timestamp) + ' · ' + number(selected.value) + ' ' + info.unit : 'Last 24 hours · ' + info.unit}</p>
    {points.length === 0 ? <p className="empty">No readings to chart yet.</p> : <>
      <div className="chart">
        <div className="chart-axis" aria-hidden="true">{[1, 2 / 3, 1 / 3, 0].map(f => <span key={f}>{number(low + f * (high - low))}</span>)}</div>
        <div className="chart-content" onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          setActive(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - bounds.left) / bounds.width * (points.length - 1)))))
        }} onPointerLeave={() => setActive(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={info.label + ' history chart'}>
            <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#6baf8a" stopOpacity=".48" /><stop offset="1" stopColor="#6baf8a" stopOpacity=".04" /></linearGradient></defs>
            {[0, 33.33, 66.66, 100].map(tick => <path key={tick} d={`M 0 ${tick} H 100`} stroke="#dce5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            {points.length > 1 && <path d={line + ' L 100 100 L 0 100 Z'} fill={`url(#${id})`} />}
            <path d={line} fill="none" stroke="#2f7a73" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            {selected && active !== null && <path d={`M ${x(active)} 0 V 100`} stroke="#6baf8a" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
            {points.length === 1 && <path d={`M 48 ${y(points[0].value)} H 52`} stroke="#2f7a73" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
      </div>
      <div className="chart-times">{ticks.map(i => <span key={i}>{formatTime(points[i].timestamp)}</span>)}</div>
    </>}
  </section>
}


