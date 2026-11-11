export type BannerAdDebugState = {
  phase: string
  detail?: string
}

let state: BannerAdDebugState = { phase: 'idle' }
const subscribers = new Set<() => void>()

export function getBannerAdDebugState(): BannerAdDebugState {
  return state
}

export function subscribeBannerAdDebug(listener: () => void): () => void {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

export function setBannerAdDebug(phase: string, detail?: string): void {
  state = { phase, detail }
  for (const listener of subscribers) listener()
}
