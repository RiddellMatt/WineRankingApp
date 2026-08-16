import type { Wine, WineType } from './types'

/**
 * Curated pairing suggestions keyed by varietal keyword, with wine-type
 * fallbacks. Intentionally rule-based for now; can be replaced by an AI
 * sommelier later without touching callers.
 */
const VARIETAL_PAIRINGS: [string[], string[]][] = [
  [['nebbiolo', 'barolo', 'barbaresco'], ['Braised short ribs', 'Truffle risotto', 'Aged Parmesan']],
  [['cabernet'], ['Ribeye steak', 'Lamb chops', 'Aged cheddar']],
  [['pinot noir'], ['Roast duck', 'Mushroom dishes', 'Grilled salmon']],
  [['merlot'], ['Roast chicken', 'Pasta Bolognese', 'Gouda']],
  [['syrah', 'shiraz'], ['BBQ brisket', 'Pepper-crusted steak', 'Venison']],
  [['malbec'], ['Grilled skirt steak', 'Empanadas', 'Blue cheese']],
  [['zinfandel'], ['BBQ ribs', 'Smash burgers', 'Chili']],
  [['sangiovese', 'chianti'], ['Margherita pizza', 'Tomato pasta', 'Cured meats']],
  [['tempranillo', 'rioja'], ['Chorizo', 'Roast lamb', 'Manchego']],
  [['grenache', 'garnacha'], ['Grilled sausages', 'Ratatouille', 'Paella']],
  [['sauvignon blanc'], ['Goat cheese', 'Grilled asparagus', 'Ceviche']],
  [['chardonnay'], ['Lobster', 'Roast chicken', 'Creamy pasta']],
  [['riesling'], ['Spicy Thai', 'Pork tenderloin', 'Apple tart']],
  [['pinot grigio', 'pinot gris'], ['Light seafood', 'Summer salads', 'Sushi']],
  [['gewürztraminer', 'gewurztraminer'], ['Spicy Sichuan', 'Duck à l\u2019orange', 'Munster']],
  [['furmint', 'tokaji'], ['Foie gras', 'Roquefort', 'Apricot desserts']],
  [['champagne'], ['Oysters', 'Fried chicken', 'Triple-cream Brie']],
  [['prosecco', 'glera'], ['Prosciutto & melon', 'Light appetizers', 'Calamari']],
  [['moscato', 'muscat'], ['Fruit tarts', 'Spicy dishes', 'Soft cheeses']],
  [['port', 'porto'], ['Dark chocolate', 'Stilton', 'Walnuts']],
  [['sherry'], ['Almonds', 'Jamón ibérico', 'Olives']],
]

const TYPE_PAIRINGS: Record<WineType, string[]> = {
  Red: ['Grilled red meat', 'Hard cheeses', 'Tomato-based pasta'],
  White: ['Seafood', 'Roast poultry', 'Fresh cheeses'],
  'Rosé': ['Charcuterie', 'Grilled salmon', 'Mediterranean mezze'],
  Sparkling: ['Oysters', 'Fried foods', 'Brie'],
  Orange: ['Fermented dishes', 'Bold curries', 'Aged cheeses'],
  Dessert: ['Blue cheese', 'Fruit tarts', 'Crème brûlée'],
  Fortified: ['Dark chocolate', 'Roasted nuts', 'Strong cheeses'],
}

export function getPairings(wine: Wine): string[] {
  const haystack = `${wine.varietal} ${wine.name}`.toLowerCase()
  for (const [keywords, dishes] of VARIETAL_PAIRINGS) {
    if (keywords.some((k) => haystack.includes(k))) return dishes
  }
  return TYPE_PAIRINGS[wine.type] ?? []
}
