import { useEffect, useRef } from 'react'

export default function StatCard({ icon, label, value, hint, tone = 'teal', trend, suffix }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.animationDelay = `${STAT_ANIMATION_DELAY}s`
    }
  }, [])

  return (
    <div className={`stat-card tone-${tone} stat-card-enter`}>
      <div className="stat-top">
        <div className="stat-icon">{icon}</div>
        {trend && <span className={`stat-trend ${trend.down ? 'down' : ''}`}>{trend.text}</span>}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}
