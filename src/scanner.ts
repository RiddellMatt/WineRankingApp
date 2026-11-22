import { WINE_TYPES, type WineType } from './types'
import { containsPhrase, findRegion } from './textMatch'
import { resizeImageFile } from './lib/imageResize'

export interface ScanResult {
  name?: string
  winery?: string
  vintage?: number
  varietal?: string
  region?: string
  type?: WineType
  rawText: string
}

/** Known varietals → inferred wine type. Order matters: longest match wins. */
export const VARIETALS: [string, WineType][] = [
  ['cabernet sauvignon', 'Red'],
  ['cabernet franc', 'Red'],
  ['sauvignon blanc', 'White'],
  ['pinot noir', 'Red'],
  ['pinot grigio', 'White'],
  ['pinot gris', 'White'],
  ['pinot blanc', 'White'],
  ['chenin blanc', 'White'],
  ['petite sirah', 'Red'],
  ['petit verdot', 'Red'],
  ['nero d\u2019avola', 'Red'],
  ['grüner veltliner', 'White'],
  ['gruner veltliner', 'White'],
  ['gewürztraminer', 'White'],
  ['gewurztraminer', 'White'],
  ['chardonnay', 'White'],
  ['merlot', 'Red'],
  ['malbec', 'Red'],
  ['red blend', 'Red'],
  ['white blend', 'White'],
  ['syrah', 'Red'],
  ['shiraz', 'Red'],
  ['zinfandel', 'Red'],
  ['sangiovese', 'Red'],
  ['nebbiolo', 'Red'],
  ['barbera', 'Red'],
  ['tempranillo', 'Red'],
  ['garnacha', 'Red'],
  ['grenache', 'Red'],
  ['mourvèdre', 'Red'],
  ['mourvedre', 'Red'],
  ['carmenere', 'Red'],
  ['carménère', 'Red'],
  ['primitivo', 'Red'],
  ['montepulciano', 'Red'],
  ['riesling', 'White'],
  ['viognier', 'White'],
  ['albariño', 'White'],
  ['albarino', 'White'],
  ['verdejo', 'White'],
  ['vermentino', 'White'],
  ['moscato', 'White'],
  ['muscat', 'White'],
  ['semillon', 'White'],
  ['furmint', 'White'],
  ['prosecco', 'Sparkling'],
  ['champagne', 'Sparkling'],
  ['cava', 'Sparkling'],
  ['lambrusco', 'Sparkling'],
  ['rosé', 'Rosé'],
  ['rosado', 'Rosé'],
  ['rosato', 'Rosé'],
  ['port', 'Fortified'],
  ['sherry', 'Fortified'],
  ['madeira', 'Fortified'],
  ['tokaji', 'Dessert'],
  ['sauternes', 'Dessert'],
  ['ice wine', 'Dessert'],
  ['eiswein', 'Dessert'],
  ['bordeaux blanc', 'White'],
  ['white bordeaux', 'White'],
  ['bordeaux blend', 'Red'],
  ['red bordeaux', 'Red'],
  ['meritage', 'Red'],
  ['grenache blanc', 'White'],
  ['marsanne', 'White'],
  ['roussanne', 'White'],
  ['picpoul', 'White'],
  ['melon de bourgogne', 'White'],
  ['muscadet', 'White'],
  ['torrontés', 'White'],
  ['torrontes', 'White'],
  ['assyrtiko', 'White'],
  ['falanghina', 'White'],
  ['greco di tufo', 'White'],
  ['fiano', 'White'],
  ['garganega', 'White'],
  ['cortese', 'White'],
  ['arneis', 'White'],
  ['trebbiano', 'White'],
  ['ugni blanc', 'White'],
  ['pecorino', 'White'],
  ['grillo', 'White'],
  ['godello', 'White'],
  ['aligoté', 'White'],
  ['aligote', 'White'],
  ['muscadelle', 'White'],
  ['colombard', 'White'],
  ['silvaner', 'White'],
  ['müller-thurgau', 'White'],
  ['muller-thurgau', 'White'],
  ['muller thurgau', 'White'],
  ['carricante', 'White'],
  ['verdicchio', 'White'],
  ['pinot meunier', 'Red'],
  ['aglianico', 'Red'],
  ['dolcetto', 'Red'],
  ['corvina', 'Red'],
  ['nerello mascalese', 'Red'],
  ['negroamaro', 'Red'],
  ['carignan', 'Red'],
  ['carignane', 'Red'],
  ['cinsault', 'Red'],
  ['tannat', 'Red'],
  ['touriga nacional', 'Red'],
  ['mencía', 'Red'],
  ['mencia', 'Red'],
  ['gamay', 'Red'],
  ['pinotage', 'Red'],
  ['monastrell', 'Red'],
  ['bobal', 'Red'],
  ['bonarda', 'Red'],
  ['sagrantino', 'Red'],
  ['lagrein', 'Red'],
  ['blaufränkisch', 'Red'],
  ['blaufrankisch', 'Red'],
  ['zweigelt', 'Red'],
  ['gsm', 'Red'],
  ['rhône blend', 'Red'],
  ['rhone blend', 'Red'],
  ['super tuscan', 'Red'],
  ['blanc de blancs', 'Sparkling'],
  ['blanc de noirs', 'Sparkling'],
  ['crémant', 'Sparkling'],
  ['cremant', 'Sparkling'],
]

export const REGIONS = [
  'napa valley', 'sonoma', 'willamette valley', 'columbia valley', 'paso robles',
  'russian river', 'santa barbara', 'finger lakes',
  'bordeaux', 'burgundy', 'bourgogne', 'champagne', 'loire', 'rhône', 'rhone',
  'alsace', 'provence', 'languedoc', 'beaujolais', 'chablis', 'sancerre',
  'médoc', 'medoc', 'saint-émilion', 'saint-emilion', 'pauillac', 'margaux',
  'tuscany', 'toscana', 'piedmont', 'piemonte', 'veneto', 'sicily', 'sicilia',
  'chianti', 'barolo', 'brunello', 'valpolicella', 'abruzzo', 'puglia',
  'rioja', 'ribera del duero', 'priorat', 'rías baixas', 'rias baixas', 'jerez',
  'douro', 'alentejo', 'vinho verde', 'portugal', 'penedès', 'penedes', 'carinena', 'cariñena',
  'valencia', 'swartland', 'mendocino', 'abruzzo', 'campania', 'friuli', 'cotes du marmandais',
  'mosel', 'rheingau', 'pfalz', 'nahe',
  'marlborough', 'central otago', 'hawkes bay',
  'barossa', 'mclaren vale', 'yarra valley', 'margaret river', 'hunter valley',
  'mendoza', 'maipo', 'colchagua', 'casablanca',
  'stellenbosch', 'swartland', 'okanagan', 'tokaj',
]

/** Lines that are label boilerplate, not the wine's identity. */
const NOISE = /\b(alc|alcohol|vol|abv|ml|cl|contains|sulfites|sulphites|product of|produced|bottled|estate bottled|imported|net contents|government warning|www\.|http)\b/i

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'’])\p{L}/gu, (c) => c.toUpperCase())
}

export function parseLabelText(rawText: string): ScanResult {
  const result: ScanResult = { rawText }
  const lower = rawText.toLowerCase()

  const currentYear = new Date().getFullYear()
  const years = [...rawText.matchAll(/\b(19[5-9]\d|20\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y <= currentYear)
  if (years.length) result.vintage = Math.max(...years)

  for (const [varietal, type] of VARIETALS) {
    if (containsPhrase(lower, varietal)) {
      result.varietal = titleCase(varietal)
      result.type = type
      break
    }
  }

  const region = findRegion(lower, REGIONS)
  if (region) result.region = titleCase(region)

  // Identity lines: alphabetic, not boilerplate, not just the matched keywords.
  const candidates = rawText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => {
      if (l.length < 3 || l.length > 60) return false
      const letters = (l.match(/\p{L}/gu) ?? []).length
      if (letters / l.length < 0.6) return false
      if (NOISE.test(l)) return false
      const lLower = l.toLowerCase()
      if (result.varietal && lLower === result.varietal.toLowerCase()) return false
      if (result.region && lLower === result.region.toLowerCase()) return false
      if (WINE_TYPES.some((t) => lLower === t.toLowerCase())) return false
      return true
    })

  // Typical label layout: producer near the top, cuvée/wine name below it.
  if (candidates.length >= 2) {
    result.winery = titleCase(candidates[0])
    result.name = titleCase(candidates[1])
  } else if (candidates.length === 1) {
    result.name = titleCase(candidates[0])
  }

  return result
}

export async function ocrImage(
  image: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return data.text ?? ''
  } finally {
    await worker.terminate()
  }
}

export async function scanLabel(
  image: File,
  onProgress?: (pct: number) => void,
): Promise<ScanResult> {
  const prepared = await resizeImageFile(image)
  return parseLabelText(await ocrImage(prepared, onProgress))
}
