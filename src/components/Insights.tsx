import { useMemo } from 'react'
import type { Wine } from '../types'

interface Props {
  wines: Wine[]
}

interface BarDatum {
  label: string
  value: number
  display: string
  sub?: string
}

function BarChart({ data, max }: { data: BarDatum[]; max: number }) {
  return (
    <div className="bar-chart">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-label" title={d.label}>
            {d.label}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${max > 0 ? Math.max((d.value / max) * 100, 2) : 0}%` }}
            />
          </div>
          <span className="bar-value">
            {d.display}
            {d.sub && <em> {d.sub}</em>}
          </span>
        </div>
      ))}
    </div>
  )
}

function groupBy(wines: Wine[], key: (w: Wine) => string): BarDatum[] {
  const groups = new Map<string, Wine[]>()
  for (const w of wines) {
    const k = key(w).trim()
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), w])
  }
  return [...groups.entries()]
    .map(([label, ws]) => ({
      label,
      value: ws.length,
      display: `${ws.length}`,
      sub: `· avg ${(ws.reduce((s, w) => s + w.rating, 0) / ws.length).toFixed(1)}★`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
}

export function Insights({ wines }: Props) {
  const insights = useMemo(() => {
    const priced = wines.filter((w) => w.price != null && w.price > 0)
    const totalSpend = priced.reduce((s, w) => s + (w.price ?? 0), 0)
    const avgPrice = priced.length ? totalSpend / priced.length : 0

    const bestValue = [...priced].sort(
      (a, b) => b.rating / (b.price ?? 1) - a.rating / (a.price ?? 1),
    )[0]
    const splurge = [...priced].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0]

    const histogram: BarDatum[] = []
    for (let r = 5; r >= 0.5; r -= 0.5) {
      const count = wines.filter((w) => w.rating === r).length
      if (count > 0 || r >= 3) {
        histogram.push({ label: `${r.toFixed(1)}★`, value: count, display: `${count}` })
      }
    }

    return {
      totalSpend,
      avgPrice,
      pricedCount: priced.length,
      bestValue,
      splurge,
      histogram,
      byType: groupBy(wines, (w) => w.type),
      byRegion: groupBy(wines, (w) => w.region),
      byVarietal: groupBy(wines, (w) => w.varietal),
    }
  }, [wines])

  if (wines.length === 0) {
    return (
      <section className="empty">
        <h2>No data yet</h2>
        <p>Add some wines and your insights will appear here.</p>
      </section>
    )
  }

  const maxHist = Math.max(...insights.histogram.map((d) => d.value), 1)

  return (
    <div className="insights">
      <section className="stats">
        <div className="stat">
          <span className="stat-value">${insights.totalSpend.toFixed(0)}</span>
          <span className="stat-label">total spend ({insights.pricedCount} priced)</span>
        </div>
        <div className="stat">
          <span className="stat-value">${insights.avgPrice.toFixed(0)}</span>
          <span className="stat-label">average bottle</span>
        </div>
        <div className="stat">
          <span className="stat-value stat-best" title={insights.bestValue?.name}>
            {insights.bestValue?.name ?? '—'}
          </span>
          <span className="stat-label">
            best value{' '}
            {insights.bestValue &&
              `(${insights.bestValue.rating.toFixed(1)}★ at $${insights.bestValue.price?.toFixed(0)})`}
          </span>
        </div>
        <div className="stat">
          <span className="stat-value stat-best" title={insights.splurge?.name}>
            {insights.splurge?.name ?? '—'}
          </span>
          <span className="stat-label">
            biggest splurge{' '}
            {insights.splurge &&
              `($${insights.splurge.price?.toFixed(0)} · ${insights.splurge.rating.toFixed(1)}★)`}
          </span>
        </div>
      </section>

      <section className="insight-card">
        <h3>Rating distribution</h3>
        <BarChart data={insights.histogram} max={maxHist} />
      </section>

      <div className="insight-grid">
        <section className="insight-card">
          <h3>By type</h3>
          <BarChart
            data={insights.byType}
            max={Math.max(...insights.byType.map((d) => d.value), 1)}
          />
        </section>
        {insights.byRegion.length > 0 && (
          <section className="insight-card">
            <h3>Top regions</h3>
            <BarChart
              data={insights.byRegion}
              max={Math.max(...insights.byRegion.map((d) => d.value), 1)}
            />
          </section>
        )}
        {insights.byVarietal.length > 0 && (
          <section className="insight-card">
            <h3>Top varietals</h3>
            <BarChart
              data={insights.byVarietal}
              max={Math.max(...insights.byVarietal.map((d) => d.value), 1)}
            />
          </section>
        )}
      </div>
    </div>
  )
}
