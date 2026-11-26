/** A real OpenStreetMap place the drink-location field can tag. */
export interface MapPlace {
  id: string
  /** Saved on the wine. US labels end in the state so cellar stats stay grouped by state. */
  label: string
  title: string
  subtitle: string
  lat: number
  lng: number
}

interface PhotonProperties {
  osm_type?: string
  osm_id?: number | string
  osm_key?: string
  osm_value?: string
  name?: string
  housenumber?: string
  street?: string
  city?: string
  locality?: string
  district?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
}

const PHOTON_ORIGIN = 'https://photon.komoot.io'
const RESULT_LIMIT = 6
const CACHE_LIMIT = 40

const LOCALITY_VALUES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'suburb',
  'neighbourhood',
  'neighborhood',
  'locality',
  'municipality',
  'borough',
  'quarter',
  'island',
])

const cache = new Map<string, MapPlace[]>()

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pushUnique(parts: string[], part: string) {
  if (!part) return
  const key = part.toLowerCase()
  if (parts.some((existing) => existing.toLowerCase() === key)) return
  parts.push(part)
}

function isUnitedStates(countryCode: string, country: string): boolean {
  return countryCode === 'US' || country === 'United States' || country === 'USA'
}

/** Turn one Photon feature into the label shown on the cellar card. */
export function mapPlaceFromPhotonFeature(feature: unknown): MapPlace | null {
  if (!feature || typeof feature !== 'object') return null
  const record = feature as { properties?: PhotonProperties; geometry?: { coordinates?: unknown } }
  const props = record.properties
  if (!props) return null

  const coordinates = record.geometry?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const lng = Number(coordinates[0])
  const lat = Number(coordinates[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const name = clean(props.name)
  const street = [clean(props.housenumber), clean(props.street)].filter(Boolean).join(' ')
  const kind = clean(props.osm_value)
  let title = name || street
  if (kind === 'county' && name && !/county$/i.test(name)) title = `${name} County`
  if (title.length < 2) return null

  const city =
    clean(props.city) ||
    clean(props.locality) ||
    clean(props.district) ||
    (kind === 'county' ? '' : clean(props.county))
  const state = clean(props.state)
  const country = clean(props.country)
  const countryCode = clean(props.countrycode).toUpperCase()
  const inUs = isUnitedStates(countryCode, country)
  const isLocality = props.osm_key === 'place' && LOCALITY_VALUES.has(kind)
  const region = inUs ? state : country || state

  const parts: string[] = []
  pushUnique(parts, title)
  if (!isLocality && kind !== 'state' && kind !== 'country') pushUnique(parts, city)
  if (kind !== 'country') pushUnique(parts, region)
  if (!inUs && region !== country) pushUnique(parts, country)
  if (parts.length === 0) return null

  const subtitle: string[] = []
  if (street && street.toLowerCase() !== title.toLowerCase()) pushUnique(subtitle, street)
  pushUnique(subtitle, city)
  pushUnique(subtitle, state)
  if (!inUs) pushUnique(subtitle, country)

  const id =
    props.osm_type && props.osm_id != null
      ? `${props.osm_type}:${props.osm_id}`
      : `${lat.toFixed(5)},${lng.toFixed(5)}`

  return {
    id,
    label: parts.join(', '),
    title,
    subtitle: subtitle.join(', '),
    lat,
    lng,
  }
}

/** Keep the first (best-ranked) feature for each label. */
export function placesFromPhoton(payload: unknown): MapPlace[] {
  if (!payload || typeof payload !== 'object') return []
  const features = (payload as { features?: unknown }).features
  if (!Array.isArray(features)) return []

  const places: MapPlace[] = []
  const seen = new Set<string>()
  for (const feature of features) {
    const place = mapPlaceFromPhotonFeature(feature)
    if (!place) continue
    const key = place.label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    places.push(place)
    if (places.length === RESULT_LIMIT) break
  }
  return places
}

function remember(key: string, places: MapPlace[]) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, places)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

async function fetchPhoton(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 8000)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error("Couldn't load map places. Check your connection.")
    return await res.json()
  } catch (err) {
    if (signal?.aborted && !timedOut) {
      throw new DOMException('Aborted', 'AbortError')
    }
    if (err instanceof Error && err.message.startsWith("Couldn't load map places")) throw err
    throw new Error("Couldn't load map places. Check your connection.")
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function searchMapPlaces(
  query: string,
  options?: { lat?: number; lng?: number; signal?: AbortSignal },
): Promise<MapPlace[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const bias =
    options?.lat != null && options?.lng != null
      ? `${options.lat.toFixed(2)},${options.lng.toFixed(2)}`
      : ''
  const key = `${q.toLowerCase()}|${bias}`
  const cached = cache.get(key)
  if (cached) return cached

  const params = new URLSearchParams({ q, limit: '8', lang: 'en' })
  if (options?.lat != null && options?.lng != null) {
    params.set('lat', String(options.lat))
    params.set('lon', String(options.lng))
  }
  const places = placesFromPhoton(await fetchPhoton(`${PHOTON_ORIGIN}/api/?${params}`, options?.signal))
  if (!options?.signal?.aborted) remember(key, places)
  return places
}

/** Nearest mapped place to a coordinate, such as the device's current location. */
export async function mapPlaceAt(lat: number, lng: number, signal?: AbortSignal): Promise<MapPlace | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    lang: 'en',
    limit: '1',
  })
  const places = placesFromPhoton(await fetchPhoton(`${PHOTON_ORIGIN}/reverse?${params}`, signal))
  return places[0] ?? null
}

export function readCurrentCoordinates(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('This device has no location services. Search for the place instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location access is off. Search for the place instead.'))
          return
        }
        reject(new Error("Couldn't find your location. Search for the place instead."))
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    )
  })
}
