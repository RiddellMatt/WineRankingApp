import { useMemo, useState } from 'react'
import { compositeScore } from '../lib/ranking'
import { topInsightWines, type InsightsLeaderKind } from '../lib/insightsLeaders'
import { InsightsLeadersModal } from './InsightsLeadersModal'
import type { RankingPreference, Wine } from '../types'

interface Props {
  wines: Wine[]
  rankingPreference: RankingPreference
}

type GroupMetric = 'count' | 'avg'

interface BarDatum {
  label: string
  count: number
  avg: number
}

function BarChart({ data, metric }: { data: BarDatum[]; metric: GroupMetric }) {
  const max =
    metric === 'count'
      ? Math.max(...data.map((d) => d.count), 1)
      : Math.max(...data.map((d) => d.avg), 1)

  return (
    <div className="bar-chart">
      {data.map((d) => {
        const value = metric === 'count' ? d.count : d.avg
        const display = metric === 'count' ? `${d.count}` : d.avg.toFixed(1)
        return (
          <div className="bar-row" key={d.label}>
            <span className="bar-label" title={d.label}>
              {d.label}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${max > 0 ? Math.max((value / max) * 100, 2) : 0}%` }}
              />
            </div>
            <span className="bar-value">{display}</span>
          </div>
        )
      })}
    </div>
  )
}

function groupBy(
  wines: Wine[],
  key: (w: Wine) => string,
  rankingPreference: RankingPreference,
): BarDatum[] {
  const groups = new Map<string, Wine[]>()
  for (const w of wines) {
    const k = key(w).trim()
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), w])
  }
  return [...groups.entries()]
    .map(([label, ws]) => ({
      label,
      count: ws.length,
      avg: ws.reduce((s, w) => s + compositeScore(w, rankingPreference), 0) / ws.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
}

export function Insights({ wines, rankingPreference }: Props) {
  const [groupMetric, setGroupMetric] = useState<GroupMetric>('count')
  const [leadersOpen, setLeadersOpen] = useState<InsightsLeaderKind | null>(null)

  const insights = useMemo(() => {
    const priced = wines.filter((w) => w.price != null && w.price > 0)
    const totalSpend = priced.reduce((s, w) => s + (w.price ?? 0), 0)
    const avgPrice = priced.length ? totalSpend / priced.length : 0

    const topValue = topInsightWines(wines, 'value', rankingPreference, 1)[0]
    const topSplurge = topInsightWines(wines, 'splurge', rankingPreference, 1)[0]

    const histogram: { label: string; value: number; display: string }[] = []
    for (let r = 5; r >= 0.5; r -= 0.5) {
      const count = wines.filter(
        (w) => compositeScore(w, rankingPreference) === r,
      ).length
      if (count > 0 || r >= 3) {
        histogram.push({ label: `${r.toFixed(1)}★`, value: count, display: `${count}` })
      }
    }

    return {
      totalSpend,
      avgPrice,
      pricedCount: priced.length,
      bestValue: topValue,
      splurge: topSplurge,
      histogram,
      byType: groupBy(wines, (w) => w.type, rankingPreference),
      byRegion: groupBy(wines, (w) => w.region, rankingPreference),
      byVarietal: groupBy(wines, (w) => w.varietal, rankingPreference),
    }
  }, [wines, rankingPreference])

  const leadersWines = useMemo(
    () => (leadersOpen ? topInsightWines(wines, leadersOpen, rankingPreference, 3) : []),
    [leadersOpen, wines, rankingPreference],
  )

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
        <button
          type="button"
          className="stat stat-link stat-feature"
          onClick={() => setLeadersOpen('value')}
        >
          <span className="stat-value stat-best">{insights.bestValue?.name ?? '—'}</span>
          <span className="stat-label">
            best value{' '}
            {insights.bestValue &&
              `(${compositeScore(insights.bestValue, rankingPreference).toFixed(1)}★ at $${insights.bestValue.price?.toFixed(0)})`}
          </span>
          <span className="stat-tap-hint">Top 3</span>
        </button>
        <button
          type="button"
          className="stat stat-link stat-feature"
          onClick={() => setLeadersOpen('splurge')}
        >
          <span className="stat-value stat-best">{insights.splurge?.name ?? '—'}</span>
          <span className="stat-label">
            biggest splurge{' '}
            {insights.splurge &&
              `($${insights.splurge.price?.toFixed(0)} · ${compositeScore(insights.splurge, rankingPreference).toFixed(1)}★)`}
          </span>
          <span className="stat-tap-hint">Top 3</span>
        </button>
      </section>

      <section className="insight-card">
        <h3>Rating distribution</h3>
        <div className="bar-chart">
          {insights.histogram.map((d) => (
            <div className="bar-row bar-row-histogram" key={d.label}>
              <span className="bar-label">{d.label}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${maxHist > 0 ? Math.max((d.value / maxHist) * 100, 2) : 0}%` }}
                />
              </div>
              <span className="bar-value">{d.display}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="insight-group-toolbar">
        <span className="insight-group-toolbar-label">Breakdown bars show</span>
        <div className="insight-metric-toggle" role="group" aria-label="Breakdown metric">
          <button
            type="button"
            className={`chip ${groupMetric === 'count' ? 'active' : ''}`}
            onClick={() => setGroupMetric('count')}
          >
            Count
          </button>
          <button
            type="button"
            className={`chip ${groupMetric === 'avg' ? 'active' : ''}`}
            onClick={() => setGroupMetric('avg')}
          >
            Avg rating
          </button>
        </div>
      </div>

      <div className="insight-grid">
        <section className="insight-card">
          <h3>By type</h3>
          <BarChart data={insights.byType} metric={groupMetric} />
        </section>
        {insights.byRegion.length > 0 && (
          <section className="insight-card">
            <h3>Top regions</h3>
            <BarChart data={insights.byRegion} metric={groupMetric} />
          </section>
        )}
        {insights.byVarietal.length > 0 && (
          <section className="insight-card">
            <h3>Top varietals</h3>
            <BarChart data={insights.byVarietal} metric={groupMetric} />
          </section>
        )}
      </div>

      {leadersOpen && (
        <InsightsLeadersModal
          kind={leadersOpen}
          wines={leadersWines}
          rankingPreference={rankingPreference}
          onClose={() => setLeadersOpen(null)}
        />
      )}
    </div>
  )
}
