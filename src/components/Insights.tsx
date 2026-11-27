import { useMemo, useState } from 'react'
import { bottlePriceBands, buildInsightHero } from '../lib/insightHero'
import { compositeScore } from '../lib/ranking'
import { formatScore } from '../lib/scoreScale'
import { formatInsightWinePrice, topInsightWines, type InsightsLeaderKind } from '../lib/insightsLeaders'
import { InsightsLeadersModal } from './InsightsLeadersModal'
import {
  BottlePriceBands,
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
    const topValue = topInsightWines(wines, 'value', rankingPreference, 1)[0]
    const topSplurge = topInsightWines(wines, 'splurge', rankingPreference, 1)[0]

    const histogram: { label: string; value: number; display: string }[] = []
    for (let band = 10; band >= 1; band -= 1) {
      const count = wines.filter(
        (w) => Math.round(compositeScore(w, rankingPreference)) === band,
      ).length
      histogram.push({ label: String(band), value: count, display: `${count}` })
    }

    return {
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

  const hero = useMemo(() => buildInsightHero(wines), [wines])
  const priceBands = useMemo(() => bottlePriceBands(wines), [wines])

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
      <p className="insights-lead">{wines.length} wines in your cellar.</p>

      <section className="stats">
        <div className="stat">
          <span className="stat-value">{hero.usual.value}</span>
          <span className="stat-label">{hero.usual.label}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{hero.secondary.value}</span>
          <span className="stat-label">{hero.secondary.label}</span>
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
              `(${formatScore(compositeScore(insights.bestValue, rankingPreference))}/10 at ${formatInsightWinePrice(insights.bestValue, 'value')})`}
          </span>
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
              `(${formatInsightWinePrice(insights.splurge, 'splurge')} · ${formatScore(compositeScore(insights.splurge, rankingPreference))}/10)`}
          </span>
        </button>
      </section>

      <div className="insight-hero">
        <section className="insight-card insight-card-ratings">
          <h3>Your ratings</h3>
          <RatingColumnChart histogram={insights.histogram} maxValue={maxHist} />
        </section>

        <section className="insight-card insight-card-type">
          <h3>Cellar mix</h3>
          <TypeMixDonut data={insights.byType} total={typeTotal} />
        </section>
      </div>

      <section className="insight-card">
        <h3>By bottle price</h3>
        <p className="insight-card-lead">Average enjoyment in each range, even from a single bottle.</p>
        <BottlePriceBands bands={priceBands} />
      </section>

      <div className="insight-grid insight-grid-breakdowns">
        <section className="insight-card">
          <h3>Places</h3>
          <RankedBreakdown
            title="Top regions"
            data={insights.byRegion}
            emptyHint="Add regions when you log wines."
          />
        </section>
        <section className="insight-card">
          <h3>Grapes</h3>
          <RankedBreakdown
            title="Top varietals"
            data={insights.byVarietal}
            emptyHint="Add varietals when you log wines."
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
