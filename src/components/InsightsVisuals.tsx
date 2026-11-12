export interface GroupDatum {
  label: string
  count: number
  avg: number
}

const TYPE_CHART_COLORS: Record<string, string> = {
  Red: '#c44d66',
  White: '#d4c48a',
  'Rosé': '#e89ab0',
  Sparkling: '#9ec4e8',
  Orange: '#e8a86a',
  Dessert: '#c9a0dc',
  Fortified: '#8b7355',
}

const FALLBACK_SLICE_COLOR = '#6a4a52'

function sliceColor(label: string): string {
  return TYPE_CHART_COLORS[label] ?? FALLBACK_SLICE_COLOR
}

export function TypeMixDonut({ data, total }: { data: GroupDatum[]; total: number }) {
  if (total === 0) {
    return <p className="insight-empty-copy">Log wines with a type to see your mix.</p>
  }

  let cursor = 0
  const stops = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const pct = (d.count / total) * 100
      const start = cursor
      cursor += pct
      return `${sliceColor(d.label)} ${start}% ${cursor}%`
    })

  const gradient = stops.length > 0 ? `conic-gradient(from -90deg, ${stops.join(', ')})` : undefined

  return (
    <div className="type-mix-chart">
      <div
        className="type-mix-donut"
        style={gradient ? { background: gradient } : undefined}
        role="img"
        aria-label={`Wine types: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}
      >
        <div className="type-mix-donut-hole">
          <span className="type-mix-total">{total}</span>
          <span className="type-mix-total-label">bottles</span>
        </div>
      </div>
      <ul className="type-mix-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="type-mix-swatch" style={{ background: sliceColor(d.label) }} aria-hidden />
            <span className="type-mix-legend-label">{d.label}</span>
            <span className="type-mix-legend-value">
              {d.count}
              <span className="type-mix-legend-avg">{d.avg.toFixed(1)}★ avg</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RatingColumnChart({
  histogram,
  maxValue,
}: {
  histogram: { label: string; value: number; display: string }[]
  maxValue: number
}) {
  return (
    <div className="rating-column-chart" role="img" aria-label="Rating distribution">
      {histogram.map((d) => {
        const height = maxValue > 0 ? Math.max((d.value / maxValue) * 100, d.value > 0 ? 8 : 2) : 2
        return (
          <div className="rating-column" key={d.label}>
            <span className="rating-column-count">{d.value > 0 ? d.display : ''}</span>
            <div className="rating-column-track">
              <div
                className="rating-column-fill"
                style={{ height: `${height}%` }}
                title={`${d.label}: ${d.value} wines`}
              />
            </div>
            <span className="rating-column-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RankedBreakdown({
  title,
  data,
  emptyHint,
}: {
  title: string
  data: GroupDatum[]
  emptyHint: string
}) {
  if (data.length === 0) {
    return <p className="insight-empty-copy">{emptyHint}</p>
  }

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <ol className="insight-ranked-list" aria-label={title}>
      {data.map((d, index) => (
        <li className="insight-ranked-row" key={d.label}>
          <span className="insight-ranked-rank">{index + 1}</span>
          <div className="insight-ranked-main">
            <span className="insight-ranked-label" title={d.label}>
              {d.label}
            </span>
            <div className="insight-ranked-track">
              <div
                className="insight-ranked-fill"
                style={{ width: `${Math.max((d.count / max) * 100, 6)}%` }}
              />
            </div>
          </div>
          <span className="insight-ranked-meta">
            {d.count}
            <span className="insight-ranked-avg">{d.avg.toFixed(1)}★</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
