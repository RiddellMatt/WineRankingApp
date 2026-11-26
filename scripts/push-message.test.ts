import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPushMessage, shouldSendPushForType } from '../supabase/functions/_shared/pushMessage.ts'

const enabled = {
  enabled: true,
  friend_requests: true,
  friend_accepted: true,
  reactions: true,
  friend_milestones: true,
}

test('tagging a friend pushes unless that toggle is off', () => {
  assert.equal(shouldSendPushForType('wine_with_friend', enabled), true)
  assert.equal(shouldSendPushForType('wine_with_friend', { ...enabled, tagged_with_you: true }), true)
  assert.equal(shouldSendPushForType('wine_with_friend', { ...enabled, tagged_with_you: false }), false)
  assert.equal(shouldSendPushForType('wine_with_friend', { ...enabled, enabled: false }), false)
  assert.equal(shouldSendPushForType('wine_with_friend', null), false)

  const message = buildPushMessage({
    type: 'wine_with_friend',
    payload: { wine_name: 'Gavi' },
    actorName: 'Alex',
  })
  assert.match(message.body, /Alex tried Gavi with you/)
  assert.match(message.deepLink, /friends\?tab=feed/)
})
