// npx tsx --test scripts/xp-feedback.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decideXpCellarFeedback } from '../src/lib/playerXpFeedback.ts'

const saved = [{ id: 'bottle' }]
const withNewBottle = [...saved, { id: 'new' }]

test('opening the app records the saved cellar and does not award it', () => {
  let baseline = null
  let feedbackArmed = false
  let progressSynced = false
  let badgeReady = false
  let wines = []
  const awards = []

  function tick() {
    const action = decideXpCellarFeedback({
      badgeReady,
      progressSynced,
      feedbackArmed,
      baseline,
      wines,
    })
    if (action === 'wait' || action === 'ignore') return action
    if (action === 'arm') {
      baseline = wines
      feedbackArmed = true
      return action
    }
    awards.push(wines)
    baseline = wines
    return action
  }

  badgeReady = true
  progressSynced = true
  assert.equal(tick(), 'arm')
  assert.equal(awards.length, 0)

  // Sign-in clears sync before the saved cellar replaces the empty list.
  // badgeReady state is still true for this commit.
  progressSynced = false
  feedbackArmed = false
  baseline = null
  assert.equal(tick(), 'wait')
  assert.equal(baseline, null)

  progressSynced = true
  wines = saved
  assert.equal(tick(), 'arm')
  assert.equal(awards.length, 0)
  assert.equal(baseline, saved)

  wines = saved
  assert.equal(tick(), 'ignore')
  assert.equal(awards.length, 0)
})

test('a bottle added after the opening cellar awards once', () => {
  const action = decideXpCellarFeedback({
    badgeReady: true,
    progressSynced: true,
    feedbackArmed: true,
    baseline: saved,
    wines: withNewBottle,
  })
  assert.equal(action, 'award')

  assert.equal(
    decideXpCellarFeedback({
      badgeReady: true,
      progressSynced: true,
      feedbackArmed: true,
      baseline: withNewBottle,
      wines: withNewBottle,
    }),
    'ignore',
  )
})
