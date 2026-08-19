/**
 * Split combined menu text into winery vs wine/cuvée name.
 * Used when AI/OCR returns a single "name" field with producer prefixed.
 */
export function normalizeMenuWineFields(
  winery: string | undefined,
  name: string,
): { winery: string; name: string } {
  const providedWinery = winery?.trim() ?? ''
  let wineName = name.trim()

  if (providedWinery && wineName) {
    return { winery: providedWinery, name: wineName }
  }

  if (!wineName) {
    return { winery: providedWinery, name: '' }
  }

  const comma = wineName.match(/^(.+?),\s*(.+)$/)
  if (comma && comma[1]!.length >= 3 && comma[2]!.length >= 2) {
    return { winery: comma[1]!.trim(), name: comma[2]!.trim() }
  }

  const dash = wineName.match(/^(.+?)\s+[–—-]\s+(.+)$/)
  if (dash && dash[1]!.length >= 3 && dash[2]!.length >= 2) {
    return { winery: dash[1]!.trim(), name: dash[2]!.trim() }
  }

  const pipe = wineName.match(/^(.+?)\s*\|\s*(.+)$/)
  if (pipe && pipe[1]!.length >= 3 && pipe[2]!.length >= 2) {
    return { winery: pipe[1]!.trim(), name: pipe[2]!.trim() }
  }

  const by = wineName.match(/^(.+?)\s+by\s+(.+)$/i)
  if (by && by[1]!.length >= 2 && by[2]!.length >= 3) {
    return { winery: by[2]!.trim(), name: by[1]!.trim() }
  }

  // "Winery WineName" when the cuvée repeats the producer token at the end of the prefix.
  // e.g. "Marchesi di Barolo Barolo Riserva" → winery / riserva split at second "Barolo".
  const words = wineName.split(/\s+/)
  if (words.length >= 4) {
    for (let i = 2; i < words.length - 1; i++) {
      const left = words.slice(0, i).join(' ')
      const right = words.slice(i).join(' ')
      if (left.length >= 8 && right.length >= 4 && !left.toLowerCase().includes(right.toLowerCase())) {
        const lastLeft = words[i - 1]!.toLowerCase()
        const firstRight = words[i]!.toLowerCase()
        if (lastLeft === firstRight || right.toLowerCase().startsWith(lastLeft)) {
          return { winery: left, name: right }
        }
      }
    }
  }

  return { winery: providedWinery, name: wineName }
}

export function formatMenuWineLine(
  vintage: string,
  winery: string,
  name: string,
): string {
  const label = [winery, name].filter(Boolean).join(' ').trim()
  const v = vintage.trim()
  if (!v || v.toUpperCase() === 'NV') return label
  return `${v} ${label}`.trim()
}
