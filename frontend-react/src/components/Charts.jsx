import { money, number } from '../lib/format'

export function BarChart({ data = [], height = 220, color = '#0f8b8d', valueFormatter = number }) {
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1)
  if (!data.length) return <div className="chart-empty">Belum ada data</div>
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((item) => {
        const percent = Math.max((Number(item.value) / max) * 100, 2)
        return (
          <div className="bar-item" key={item.label}>
            <div className="bar-value">{valueFormatter(item.value)}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ height: `${percent}%`, background: item.color || color }}
                title={`${item.label}: ${valueFormatter(item.value)}`}
              />
            </div>
            <div className="bar-label" title={item.label}>{item.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export function TrendChart({ data = [], height = 240, valueFormatter = money }) {
  if (!data.length) return <div className="chart-empty">Belum ada data</div>
  const width = 640
  const padX = 26
  const padTop = 18
  const padBottom = 34
  const innerHeight = height - padTop - padBottom
  const values = data.map((item) => Number(item.value) || 0)
  const max = Math.max(...values, 1)
  const min = 0
  const points = data.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(data.length - 1, 1)
    const y = padTop + innerHeight - ((Number(item.value) - min) / (max - min || 1)) * innerHeight
    return { x, y, ...item }
  })
  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${padX},${padTop + innerHeight} ${line} ${points[points.length - 1].x},${padTop + innerHeight}`
  const grid = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik tren">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f8b8d" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f8b8d" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        {grid.map((g) => {
          const y = padTop + innerHeight * g
          return <line key={g} x1={padX} x2={width - padX} y1={y} y2={y} className="trend-grid" />
        })}
        <polygon points={area} fill="url(#trendFill)" />
        <polyline points={line} fill="none" stroke="url(#trendLine)" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, index) => (
          <g key={`${p.label}-${index}`}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#0f8b8d" strokeWidth="3">
              <title>{`${p.label}: ${valueFormatter(p.value)}`}</title>
            </circle>
            {(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0) && (
              <text x={p.x} y={height - 10} textAnchor="middle" className="trend-label">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

export function DonutChart({ data = [], totalLabel = 'Total', size = 176 }) {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  if (!total) return <div className="chart-empty">Belum ada data</div>
  let cursor = 0
  const segments = data.map((item) => {
    const start = cursor
    const share = (Number(item.value) / total) * 100
    cursor += share
    return { ...item, start, share }
  })
  const gradient = segments
    .map((item) => `${item.color} ${item.start}% ${item.start + item.share}%`)
    .join(', ')

  return (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{ width: size, height: size, background: `conic-gradient(${gradient})` }}
      >
        <div className="donut-hole">
          <strong>{totalLabel}</strong>
          <span>{number(total)}</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((item) => (
          <div className="legend-row" key={item.label}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
            <strong>{number(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
