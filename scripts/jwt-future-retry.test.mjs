// npx tsx --test scripts/jwt-future-retry.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  JWT_FUTURE_RETRY_DELAYS_MS,
  createJwtFutureRetryFetch,
  isJwtIssuedAtFutureError,
  isJwtIssuedAtFuturePayload,
  isSupabaseJwtTimingError,
} from '../src/lib/jwtFutureRetry.ts'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const issuedAtFuture = () =>
  jsonResponse(401, {
    code: 'PGRST303',
    message: 'JWT issued at future',
  })

test('PGRST303 is the issued-at-future payload and other 401s are not', () => {
  assert.equal(
    isJwtIssuedAtFuturePayload(401, '{"code":"PGRST303","message":"JWT issued at future"}'),
    true,
  )
  assert.equal(isJwtIssuedAtFuturePayload(401, 'JWT issued at future'), true)
  assert.equal(isJwtIssuedAtFuturePayload(401, '{"code":"PGRST301","message":"JWT expired"}'), false)
  assert.equal(isJwtIssuedAtFuturePayload(500, 'PGRST303'), false)
  assert.equal(isJwtIssuedAtFutureError({ code: 'PGRST303', message: 'nope' }), true)
  assert.equal(isJwtIssuedAtFutureError({ message: 'JWT issued at future' }), true)
  assert.equal(isJwtIssuedAtFutureError({ message: 'JWT expired' }), false)
  assert.equal(isSupabaseJwtTimingError({ code: 'PGRST303', message: 'JWT issued at future' }), false)
  assert.equal(isSupabaseJwtTimingError({ message: 'JWT expired' }), true)
})

test('a PGRST303 response is retried and the successful body stays readable', async () => {
  const sleeps = []
  let calls = 0
  const fetch = createJwtFutureRetryFetch(
    async () => {
      calls += 1
      return calls === 1 ? issuedAtFuture() : jsonResponse(200, [{ id: 'wine' }])
    },
    { sleep: async (ms) => sleeps.push(ms), delaysMs: JWT_FUTURE_RETRY_DELAYS_MS },
  )

  const response = await fetch('https://example.test/rest/v1/wines?select=*', {
    method: 'GET',
    body: undefined,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [{ id: 'wine' }])
  assert.equal(calls, 2)
  assert.deepEqual(sleeps, [0])
})

test('other 401s and successful responses are not retried', async () => {
  for (const response of [
    jsonResponse(401, { code: 'PGRST301', message: 'JWT expired' }),
    jsonResponse(200, []),
  ]) {
    let calls = 0
    const fetch = createJwtFutureRetryFetch(async () => {
      calls += 1
      return response
    })
    const result = await fetch('https://example.test/rest/v1/profiles')
    assert.equal(result.status, response.status)
    assert.equal(calls, 1)
    const text = await result.text()
    assert.match(text, response.status === 401 ? /JWT expired/ : /^\[\]$/)
  }
})

test('a lasting PGRST303 stops after the scheduled retries', async () => {
  const sleeps = []
  let calls = 0
  const fetch = createJwtFutureRetryFetch(
    async () => {
      calls += 1
      return issuedAtFuture()
    },
    {
      sleep: async (ms) => sleeps.push(ms),
      delaysMs: [0, 400, 1600],
    },
  )

  const response = await fetch('https://example.test/rest/v1/profiles?select=progress_generation')
  assert.equal(response.status, 401)
  assert.match(await response.text(), /JWT issued at future/)
  assert.equal(calls, 4)
  assert.deepEqual(sleeps, [0, 400, 1600])
})

test('a request body is sent again on retry', async () => {
  const seen = []
  let calls = 0
  const fetch = createJwtFutureRetryFetch(
    async (input) => {
      calls += 1
      seen.push(await input.text())
      return calls === 1 ? issuedAtFuture() : jsonResponse(200, { ok: true })
    },
    { sleep: async () => {}, delaysMs: [0] },
  )

  const response = await fetch(
    new Request('https://example.test/rest/v1/wines', {
      method: 'POST',
      body: '{"name":"Barolo"}',
    }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(seen, ['{"name":"Barolo"}', '{"name":"Barolo"}'])
})

test('a one-shot stream body is not sent twice', async () => {
  let calls = 0
  const fetch = createJwtFutureRetryFetch(async () => {
    calls += 1
    return issuedAtFuture()
  })
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{}'))
      controller.close()
    },
  })

  const response = await fetch('https://example.test/storage/v1/object/photos', {
    method: 'POST',
    body,
    duplex: 'half',
  })
  assert.equal(response.status, 401)
  assert.equal(calls, 1)
})

test('an aborted retry returns the last rejection without another request', async () => {
  const controller = new AbortController()
  let calls = 0
  const fetch = createJwtFutureRetryFetch(
    async () => {
      calls += 1
      controller.abort()
      return issuedAtFuture()
    },
    { sleep: async () => assert.fail('slept after abort'), delaysMs: [500] },
  )

  const response = await fetch('https://example.test/rest/v1/wines', { signal: controller.signal })
  assert.equal(response.status, 401)
  assert.equal(calls, 1)
})
