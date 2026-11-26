import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const places = await server.ssrLoadModule('/src/lib/placeSearch.ts')
const geo = await server.ssrLoadModule('/src/lib/wineGeo.ts')

test.after(async () => {
  await server.close()
})

function feature(properties: Record<string, unknown>, coordinates: [number, number] = [-79.94, 32.79]) {
  return { type: 'Feature', properties, geometry: { type: 'Point', coordinates } }
}

const ordinary = feature({
  osm_type: 'N',
  osm_id: 5497704533,
  osm_key: 'amenity',
  osm_value: 'restaurant',
  name: 'The Ordinary',
  housenumber: '544',
  street: 'King Street',
  city: 'Charleston',
  county: 'Charleston',
  state: 'South Carolina',
  country: 'United States',
  countrycode: 'US',
})

const charleston = feature(
  {
    osm_type: 'R',
    osm_id: 194466,
    osm_key: 'place',
    osm_value: 'city',
    name: 'Charleston',
    state: 'South Carolina',
    country: 'United States',
    countrycode: 'US',
  },
  [-79.93, 32.78],
)

const charlestonCounty = feature(
  {
    osm_type: 'R',
    osm_id: 194467,
    osm_key: 'boundary',
    osm_value: 'county',
    name: 'Charleston',
    county: 'Charleston',
    state: 'South Carolina',
    country: 'United States',
    countrycode: 'US',
  },
  [-80.0, 32.8],
)

test('a venue tag names the place, city, and state', () => {
  const place = places.mapPlaceFromPhotonFeature(ordinary)
  assert.equal(place.label, 'The Ordinary, Charleston, South Carolina')
  assert.equal(place.title, 'The Ordinary')
  assert.equal(place.subtitle, '544 King Street, Charleston, South Carolina')
  assert.equal(place.id, 'N:5497704533')
  assert.equal(geo.parseDrinkLocation(place.label), 'South Carolina')
})

test('a city tag does not repeat the country for a US place', () => {
  const place = places.mapPlaceFromPhotonFeature(charleston)
  assert.equal(place.label, 'Charleston, South Carolina')
  assert.equal(geo.parseDrinkLocation(place.label), 'South Carolina')
})

test('an international venue ends in the country', () => {
  const place = places.mapPlaceFromPhotonFeature(
    feature(
      {
        osm_type: 'N',
        osm_id: 42,
        osm_key: 'amenity',
        osm_value: 'restaurant',
        name: 'Enoteca Rossi',
        city: 'Rome',
        state: 'Lazio',
        country: 'Italy',
        countrycode: 'IT',
      },
      [12.48, 41.89],
    ),
  )
  assert.equal(place.label, 'Enoteca Rossi, Rome, Italy')
  assert.equal(place.subtitle, 'Rome, Lazio, Italy')
  assert.equal(geo.parseDrinkLocation(place.label), 'Italy')
})

test('a city outside the US is tagged as city and country', () => {
  const place = places.mapPlaceFromPhotonFeature(
    feature(
      {
        osm_type: 'R',
        osm_id: 7,
        osm_key: 'place',
        osm_value: 'city',
        name: 'Rome',
        state: 'Lazio',
        country: 'Italy',
        countrycode: 'it',
      },
      [12.5, 41.9],
    ),
  )
  assert.equal(place.label, 'Rome, Italy')
  assert.equal(geo.parseDrinkLocation(place.label), 'Italy')
})

test('search results keep the best match for each label and skip blank features', () => {
  const found = places.placesFromPhoton({
    features: [charleston, charleston, charlestonCounty, { type: 'Feature' }, ordinary],
  })
  assert.deepEqual(
    found.map((place: { label: string }) => place.label),
    ['Charleston, South Carolina', 'Charleston County, South Carolina', 'The Ordinary, Charleston, South Carolina'],
  )
})

test('a feature without coordinates is not a place you can tag', () => {
  assert.equal(
    places.mapPlaceFromPhotonFeature({
      properties: { name: 'Nowhere', country: 'France', countrycode: 'FR', osm_key: 'place', osm_value: 'city' },
    }),
    null,
  )
})
