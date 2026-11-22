import { STORAGE_PREFIX } from '../brand'

export type GuideTab = 'cellar' | 'friends' | 'scan' | 'more'

export interface GuideStep {
  id: string
  tab: GuideTab
  /** Which cellar list to show behind this step. */
  segment?: 'tried' | 'wishlist'
  title: string
  body: string
  /** The last step asks them to scan into a list instead of pressing Next. */
  final?: boolean
}

/**
 * First-run walk through the screens a new account can use.
 * Stats stays out: it is a Pro screen.
 */
export const USER_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'cellar',
    tab: 'cellar',
    segment: 'tried',
    title: 'Your cellar',
    body: "Wines you've tasted stay here, ranked by how much you liked them.",
  },
  {
    id: 'wishlist',
    tab: 'cellar',
    segment: 'wishlist',
    title: 'Want to try',
    body: "Bottles you haven't opened yet stay on this list, separate from the ones you've rated.",
  },
  {
    id: 'social',
    tab: 'friends',
    title: 'Social',
    body: 'See what friends are drinking, and save a bottle from their cellar onto your want-to-try list.',
  },
  {
    id: 'add',
    tab: 'scan',
    title: 'Add a bottle',
    body: 'Scan a label or type the details. A restaurant menu can be scanned from this screen too.',
  },
  {
    id: 'more',
    tab: 'more',
    title: 'More',
    body: 'Set how rankings work, change the look, and manage your account.',
  },
  {
    id: 'scan',
    tab: 'scan',
    title: 'Scan your first wine',
    body: "Put it on the list you've tried, or the one you want to try.",
    final: true,
  },
]

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.user-guide.v1.${userId}`
}

export function hasSeenUserGuide(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markUserGuideSeen(userId: string): void {
  try {
    localStorage.setItem(storageKey(userId), '1')
  } catch {
    // Private mode or a blocked storage API. The tour can show again next launch.
  }
}
