import { VARIETALS } from '../scanner'

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'''])\p{L}/gu, (c) => c.toUpperCase())
}

/** Sorted unique grape / style names for form pickers. */
export const WINE_VARIETAL_OPTIONS: string[] = [
  ...new Set(VARIETALS.map(([name]) => titleCase(name))),
].sort((a, b) => a.localeCompare(b))

export const VARIETAL_CUSTOM = '__custom__'
