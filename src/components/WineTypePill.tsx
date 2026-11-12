import { wineTypePillClass } from '../lib/wineTypePill'

export function WineTypePill({ type }: { type: string }) {
  return (
    <span className={`type-pill ${wineTypePillClass(type)}`}>{type}</span>
  )
}
