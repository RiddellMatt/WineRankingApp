export const WINE_TYPE_PILL_CLASS: Record<string, string> = {
  Red: 'type-red',
  White: 'type-white',
  'Rosé': 'type-rose',
  Sparkling: 'type-sparkling',
  Orange: 'type-orange',
  Dessert: 'type-dessert',
  Fortified: 'type-fortified',
}

export function wineTypePillClass(type: string): string {
  return WINE_TYPE_PILL_CLASS[type] ?? ''
}
