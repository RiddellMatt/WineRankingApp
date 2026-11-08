import { useMemo, useState } from 'react'
import { compositeScore } from '../lib/ranking'
import { topInsightWines, type InsightsLeaderKind } from '../lib/insightsLeaders'
import { InsightsLeadersModal } from './InsightsLeadersModal'
import {
  RankedBreakdown,
  RatingColumnChart,
  TypeMixDonut,
  type GroupDatum,
} from './InsightsVisuals'
import type { RankingPreference, Wine } from '../types'

interface Props {
  wines: Wine[]
  rankingPreference: RankingPreference
}

function groupBy(
  wines: Wine[],
  key: (w: Wine) => string,
  rankingPreference: RankingPreference,
): GroupDatum[] {
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
  const [leadersOpen, setLeadersOpen] = useState<InsightsLeaderKind | null>(null)

  const insights = useMemo(() => {
    const priced = wines.filter((w) => w.price != null && w.price > 0)
    const totalSpend = priced.reduce((s, w) => s + (w.price ?? 0), 0)
    const avgPrice = priced.length ? totalSpend / priced.length : 0

    const topValue = topInsightWines(wines, 'value', rankingPreference, 1)[0]
    const topSplurge = topInsightWines(wines, 'splurge', rankingPreference, 1)[0]

    const histogram: { label: string; value: number; display: string }[] = []
    for (let r = 5; r >= 0.5; r -= 0.5) {
      const count = wines.filter((w) => compositeScore(w, rankingPreference) === r).length
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

  const typeTotal = useMemo(
    () => insights.byType.reduce((s, d) => s + d.count, 0),
    [insights.byType],
  )

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
      <p className="insights-lead">Based on {wines.length} wines in your cellar.</p>

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

      <div className="insight-hero">
        <section className="insight-card insight-card-ratings">
          <h3>Your ratings</h3>
          <p className="insight-card-hint">How your bottles spread across scores.</p>
          <RatingColumnChart histogram={insights.histogram} maxValue={maxHist} />
        </section>

        <section className="insight-card insight-card-type">
          <h3>Cellar mix</h3>
          <p className="insight-card-hint">By wine type — count and average score.</p>
          <TypeMixDonut data={insights.byType} total={typeTotal} />
        </section>
      </div>

      <div className="insight-grid insight-grid-breakdowns">
        <section className="insight-card">
          <h3>Places</h3>
          <p className="insight-card-hint">Top regions by bottles logged.</p>
          <RankedBreakdown
            title="Top regions"
            data={insights.byRegion}
            emptyHint="Add regions when you log wines to see where you drink."
          />
        </section>
        <section className="insight-card">
          <h3>Grapes</h3>
          <p className="insight-card-hint">Most tried varietals.</p>
          <RankedBreakdown
            title="Top varietals"
            data={insights.byVarietal}
            emptyHint="Varietals appear as you fill them in on each wine."
          />
        </section>
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
