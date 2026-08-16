import type { TasteProfile, WineType } from './types'

/**
 * Reference taste profiles (0–100 per axis) for common varietals, curated
 * from standard wine references. Used to auto-populate a wine's taste
 * characteristics so users look up stats instead of inventing them.
 * Later this can be replaced/blended with aggregated community ratings.
 *
 * Tannin is omitted for most whites/sparkling where the axis is meaningless.
 */
const VARIETAL_PROFILES: [string[], TasteProfile][] = [
  [['cabernet sauvignon'], { body: 85, tannin: 80, sweetness: 10, acidity: 60 }],
  [['cabernet franc'], { body: 65, tannin: 60, sweetness: 10, acidity: 70 }],
  [['merlot'], { body: 70, tannin: 55, sweetness: 15, acidity: 55 }],
  [['pinot noir'], { body: 40, tannin: 35, sweetness: 12, acidity: 75 }],
  [['syrah', 'shiraz'], { body: 85, tannin: 75, sweetness: 12, acidity: 60 }],
  [['malbec'], { body: 80, tannin: 65, sweetness: 12, acidity: 55 }],
  [['zinfandel'], { body: 75, tannin: 55, sweetness: 20, acidity: 55 }],
  [['sangiovese', 'chianti'], { body: 65, tannin: 70, sweetness: 10, acidity: 80 }],
  [['nebbiolo', 'barolo', 'barbaresco'], { body: 80, tannin: 90, sweetness: 8, acidity: 85 }],
  [['barbera'], { body: 60, tannin: 45, sweetness: 10, acidity: 85 }],
  [['tempranillo', 'rioja'], { body: 70, tannin: 65, sweetness: 10, acidity: 60 }],
  [['grenache', 'garnacha'], { body: 65, tannin: 50, sweetness: 15, acidity: 55 }],
  [['mourvèdre', 'mourvedre'], { body: 80, tannin: 75, sweetness: 10, acidity: 55 }],
  [['carmenere', 'carménère'], { body: 70, tannin: 60, sweetness: 12, acidity: 50 }],
  [['montepulciano'], { body: 70, tannin: 60, sweetness: 10, acidity: 65 }],
  [['primitivo'], { body: 75, tannin: 55, sweetness: 20, acidity: 55 }],
  [['petite sirah'], { body: 90, tannin: 85, sweetness: 10, acidity: 55 }],
  [['petit verdot'], { body: 85, tannin: 80, sweetness: 8, acidity: 60 }],
  [['pinotage'], { body: 75, tannin: 65, sweetness: 12, acidity: 55 }],
  [['gamay', 'beaujolais'], { body: 35, tannin: 25, sweetness: 12, acidity: 80 }],
  [['chardonnay'], { body: 60, sweetness: 15, acidity: 55 }],
  [['sauvignon blanc'], { body: 30, sweetness: 8, acidity: 90 }],
  [['riesling'], { body: 30, sweetness: 45, acidity: 90 }],
  [['pinot grigio', 'pinot gris'], { body: 30, sweetness: 10, acidity: 70 }],
  [['gewürztraminer', 'gewurztraminer'], { body: 55, sweetness: 40, acidity: 45 }],
  [['viognier'], { body: 60, sweetness: 20, acidity: 45 }],
  [['chenin blanc'], { body: 45, sweetness: 30, acidity: 80 }],
  [['albariño', 'albarino'], { body: 40, sweetness: 10, acidity: 85 }],
  [['verdejo'], { body: 40, sweetness: 10, acidity: 80 }],
  [['vermentino'], { body: 40, sweetness: 10, acidity: 75 }],
  [['grüner veltliner', 'gruner veltliner'], { body: 45, sweetness: 10, acidity: 85 }],
  [['semillon'], { body: 55, sweetness: 20, acidity: 60 }],
  [['moscato'], { body: 30, sweetness: 80, acidity: 60 }],
  [['muscat'], { body: 35, sweetness: 75, acidity: 55 }],
  [['tokaji'], { body: 60, sweetness: 95, acidity: 85 }],
  [['furmint'], { body: 50, sweetness: 55, acidity: 90 }],
  [['sauternes'], { body: 65, sweetness: 95, acidity: 75 }],
  [['champagne'], { body: 45, sweetness: 15, acidity: 85, fizz: 90 }],
  [['prosecco', 'glera'], { body: 35, sweetness: 30, acidity: 75, fizz: 75 }],
  [['cava'], { body: 40, sweetness: 15, acidity: 80, fizz: 80 }],
  [['lambrusco'], { body: 45, tannin: 25, sweetness: 45, acidity: 70, fizz: 65 }],
  [['port', 'porto'], { body: 90, tannin: 70, sweetness: 90, acidity: 50 }],
  [['sherry'], { body: 60, sweetness: 40, acidity: 70 }],
  [['madeira'], { body: 70, tannin: 20, sweetness: 70, acidity: 90 }],
]

const TYPE_PROFILES: Record<WineType, TasteProfile> = {
  Red: { body: 65, tannin: 60, sweetness: 12, acidity: 60 },
  White: { body: 45, sweetness: 15, acidity: 70 },
  'Rosé': { body: 35, tannin: 10, sweetness: 15, acidity: 70 },
  Sparkling: { body: 40, sweetness: 20, acidity: 80, fizz: 80 },
  Orange: { body: 60, tannin: 40, sweetness: 10, acidity: 75 },
  Dessert: { body: 55, sweetness: 85, acidity: 70 },
  Fortified: { body: 80, tannin: 50, sweetness: 70, acidity: 60 },
}

export interface TasteLookup {
  taste: TasteProfile
  /** Human label of what the profile is based on, e.g. "Nebbiolo". */
  basedOn: string
}

export function lookupTaste(
  varietal: string,
  name: string,
  type: WineType,
): TasteLookup {
  const haystack = `${varietal} ${name}`.toLowerCase()
  for (const [keywords, taste] of VARIETAL_PROFILES) {
    const hit = keywords.find((k) => haystack.includes(k))
    if (hit) {
      return { taste: { ...taste }, basedOn: hit.replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }
    }
  }
  return { taste: { ...TYPE_PROFILES[type] }, basedOn: `${type} wines` }
}

export function hasTaste(taste: TasteProfile | undefined): boolean {
  return !!taste && Object.values(taste).some((v) => v != null)
}
