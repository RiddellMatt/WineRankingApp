import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const friends = await server.ssrLoadModule('/src/lib/wineWithFriends.ts')
const feed = await server.ssrLoadModule('/src/lib/activityFeed.ts')
const activityFeed = await server.ssrLoadModule('/src/components/ActivityFeed.tsx')
const ownFeed = await server.ssrLoadModule('/src/components/OwnActivityFeed.tsx')

test.after(async () => {
  await server.close()
})

const alex = { id: 'alex', displayName: 'Alex', email: 'alex@example.com' }
const jordan = { id: 'jordan', displayName: 'Jordan', email: 'jordan@example.com' }
const sam = { id: 'sam', displayName: 'Sam', email: 'sam@example.com' }
const unnamed = { id: 'hidden', displayName: '', email: '' }

test('a friend post names the person they drank with', () => {
  assert.equal(feed.activityEventLabel('logged'), 'tried')
  assert.equal(friends.activityWithFriendsClause([jordan], 'viewer'), 'with Jordan')
  assert.equal(friends.activityWithFriendsClause([jordan, sam], 'viewer'), 'with Jordan and Sam')
  assert.equal(
    friends.activityWithFriendsClause([jordan, sam, alex], 'viewer'),
    'with Jordan, Sam, and Alex',
  )
  assert.equal(friends.activityWithFriendsClause([jordan], 'jordan'), 'with you')
  assert.equal(friends.activityWithFriendsClause([unnamed], 'viewer'), 'with a friend')
  assert.equal(
    friends.activityWithFriendsClause([unnamed, { ...unnamed, id: 'hidden-2' }], 'viewer'),
    'with 2 friends',
  )
  assert.equal(friends.activityWithFriendsClause([jordan, unnamed], 'viewer'), 'with Jordan and a friend')
  assert.equal(friends.activityWithFriendsClause(undefined, 'viewer'), null)
})

test('the social post reads as your friend tried a wine with their friend', () => {
  const wine = {
    id: 'wine-1',
    name: 'Barolo',
    winery: 'Marchesi',
    vintage: 2019,
    type: 'Red',
    varietal: 'Nebbiolo',
    region: 'Piedmont',
    price: null,
    ratingEnjoyment: 4,
    rating: 4,
    notes: '',
    purchasedAt: '',
    taste: {},
    status: 'tried',
    triedOn: '2026-11-22',
    addedAt: Date.now(),
    withFriendIds: ['jordan'],
  }
  const event = {
    id: 'event-1',
    type: 'logged',
    at: Date.now() - 60_000,
    actor: alex,
    wine,
    withFriends: [jordan],
  }
  const html = renderToStaticMarkup(
    createElement(activityFeed.ActivityFeed, {
      events: [event],
      viewerId: 'viewer',
      rankingPreference: 'balanced',
      emptyHint: 'No activity',
      onViewCellar: () => {},
    }),
  )
  assert.match(html, /Alex/)
  assert.match(html, /tried/)
  assert.match(html, /Barolo/)
  assert.match(html, /with Jordan/)
  assert.doesNotMatch(html, /logged/)

  const ownHtml = renderToStaticMarkup(
    createElement(ownFeed.OwnActivityFeed, {
      events: friends.enrichActivityWithFriends([event], new Map([[jordan.id, jordan]])),
      viewerId: alex.id,
      emptyHint: 'No activity',
    }),
  )
  assert.match(ownHtml, /Tried/)
  assert.match(ownHtml, /Barolo/)
  assert.match(ownHtml, /with Jordan/)
})

test('social activity does not claim the feed is yours before friendships load', () => {
  assert.equal(feed.socialActivityCaption(false, 0), 'Loading activity…')
  assert.equal(feed.socialActivityCaption(false, 3), 'Loading activity…')
  assert.equal(feed.socialActivityCaption(true, 0), 'Your activity until you add friends.')
  assert.equal(feed.socialActivityCaption(true, 2), 'Friend activity and saves.')
})
