/** Match a phrase as a whole word/phrase, not as a substring (e.g. "port" ≠ "portugal"). */
export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, 'iu').test(text)
}

/** Longest keyword match wins. */
export function findPhrase<T extends string>(
  text: string,
  entries: readonly (readonly [string, T])[],
): readonly [string, T] | undefined {
  return entries.find(([keyword]) => containsPhrase(text, keyword))
}

export function findRegion(text: string, regions: readonly string[]): string | undefined {
  // Longest region name first so "vinho verde" beats "verde".
  const sorted = [...regions].sort((a, b) => b.length - a.length)
  return sorted.find((region) => containsPhrase(text, region))
}
