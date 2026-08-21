import {
  countDrinkLocations,
  countOriginCombos,
  countOriginCountries,
  countRegions,
  type CountEntry,
  wineOriginCountry,
} from './wineGeo'
import { friendDisplayLabel, type FriendProfile } from './friendsDb'
import { triedWines } from './wishlist'
import type { Wine } from '../types'

export interface PersonalPassport {
  totalTried: number
  countries: CountEntry[]
  originCombos: CountEntry[]
  regions: CountEntry[]
  drinkLocations: CountEntry[]
  highlight: string | null
}

export interface FriendStandingRow {
  category: string
  you: number
  leaderName: string
  leaderCount: number
  youLead: boolean
}

export interface FriendCellarSnapshot {
  id: string
  name: string
  avatarUrl?: string
  tried: Wine[]
}

const LEADERBOARD_CATEGORIES = [
  { key: 'total', label: 'Wines logged' },
  { key: 'countries', label: 'Origin countries' },
  { key: 'locations', label: "Places you've drank" },
] as const

function uniqueCountries(wines: Wine[]): number {
  return new Set(wines.map(wineOriginCountry).filter(Boolean)).size
}

function uniqueDrinkLocations(wines: Wine[]): number {
  return countDrinkLocations(wines).length
}

export function buildPersonalPassport(wines: Wine[]): PersonalPassport {
  const tried = triedWines(wines)
  const countries = countOriginCountries(tried)
  const originCombos = countOriginCombos(tried)
  const regions = countRegions(tried)
  const drinkLocations = countDrinkLocations(tried)

  let highlight: string | null = null
  if (originCombos.length > 0) {
    const top = originCombos[0]!
    highlight = `You've tried the most ${top.label} wines (${top.count})`
  } else if (countries.length > 0) {
    const top = countries[0]!
    highlight = `Most logged from ${top.label} (${top.count} wines)`
  } else if (drinkLocations.length > 0) {
    const top = drinkLocations[0]!
    highlight = `Most wines enjoyed in ${top.label} (${top.count})`
  }

  return {
    totalTried: tried.length,
    countries,
    originCombos,
    regions,
    drinkLocations,
    highlight,
  }
}

export function buildFriendStandings(
  yourWines: Wine[],
  friends: FriendCellarSnapshot[],
): FriendStandingRow[] {
  if (friends.length === 0) return []

  const yourTried = triedWines(yourWines)
  const rows: FriendStandingRow[] = []

  for (const { key, label } of LEADERBOARD_CATEGORIES) {
    const scores: { name: string; count: number; isYou: boolean }[] = [
      {
        name: 'You',
        count:
          key === 'total'
            ? yourTried.length
            : key === 'countries'
              ? uniqueCountries(yourTried)
              : uniqueDrinkLocations(yourTried),
        isYou: true,
      },
      ...friends.map((f) => ({
        name: f.name,
        count:
          key === 'total'
            ? f.tried.length
            : key === 'countries'
              ? uniqueCountries(f.tried)
              : uniqueDrinkLocations(f.tried),
        isYou: false,
      })),
    ]

    scores.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const leader = scores[0]!
    const you = scores.find((s) => s.isYou)!

    rows.push({
      category: label,
      you: you.count,
      leaderName: leader.isYou ? 'You' : leader.name,
      leaderCount: leader.count,
      youLead: leader.isYou,
    })
  }

  const yourTopCombo = countOriginCombos(yourTried)[0]
  if (yourTopCombo) {
    const comboScores = [
      {
        name: 'You',
        count: yourTopCombo.count,
        isYou: true,
      },
      ...friends.map((f) => ({
        name: f.name,
        count: countOriginCombos(f.tried).find((c) => c.label === yourTopCombo.label)?.count ?? 0,
        isYou: false,
      })),
    ]
    comboScores.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const leader = comboScores[0]!
    const you = comboScores.find((s) => s.isYou)!
    rows.push({
      category: `Most ${yourTopCombo.label}`,
      you: you.count,
      leaderName: leader.isYou ? 'You' : leader.name,
      leaderCount: leader.count,
      youLead: leader.isYou,
    })
  }

  return rows
}

export function friendSnapshotFromWines(
  profile: FriendProfile,
  wines: Wine[],
  fallbackLabel = 'Friend',
): FriendCellarSnapshot {
  return {
    id: profile.id,
    name: friendDisplayLabel(profile, fallbackLabel),
    avatarUrl: profile.avatarUrl,
    tried: triedWines(wines),
  }
}
