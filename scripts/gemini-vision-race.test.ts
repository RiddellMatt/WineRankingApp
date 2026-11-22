import assert from 'node:assert/strict'
import test from 'node:test'
import { raceVisionModels, type VisionAttempt } from '../supabase/functions/_shared/geminiVision.ts'
import { WINE_FACT_COUNT, WINE_FACTS } from '../src/lib/wineFacts.ts'

function hangUntilAbort(signal: AbortSignal): Promise<VisionAttempt> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ ok: false, detail: 'cancelled' })
      return
    }
    signal.addEventListener('abort', () => resolve({ ok: false, detail: 'cancelled' }), { once: true })
  })
}

test('first model to answer wins without waiting out a hung model', async () => {
  const calls: string[] = []
  const result = await raceVisionModels({
    models: ['slow', 'fast'],
    hedgeDelayMs: 20,
    deadlineMs: 400,
    call: (model, signal) => {
      calls.push(model)
      if (model === 'slow') return hangUntilAbort(signal)
      return Promise.resolve({ ok: true, text: '{"name":"Barolo"}' })
    },
  })
  assert.equal(result.model, 'fast')
  assert.match(result.text, /Barolo/)
  assert.ok(result.attempts >= 2)
  assert.ok(result.durationMs < 300)
  assert.deepEqual(calls.slice(0, 2), ['slow', 'fast'])
})

test('a quick success does not need a backup model', async () => {
  let calls = 0
  const result = await raceVisionModels({
    models: ['primary', 'backup'],
    hedgeDelayMs: 5_000,
    deadlineMs: 5_000,
    call: () => {
      calls += 1
      return Promise.resolve({ ok: true, text: 'ok' })
    },
  })
  assert.equal(result.model, 'primary')
  assert.equal(result.attempts, 1)
  assert.equal(calls, 1)
})

test('overload on every model rejects as busy before the deadline', async () => {
  const result = await raceVisionModels({
    models: ['a', 'b'],
    hedgeDelayMs: 5_000,
    deadlineMs: 400,
    call: async (model) => ({ ok: false, detail: `${model} 503 UNAVAILABLE high demand` }),
  }).then(
    () => {
      throw new Error('expected rejection')
    },
    (error: Error) => error,
  )
  assert.match(result.message, /busy right now/)
})

test('auth failure stops the race', async () => {
  const calls: string[] = []
  const error = await raceVisionModels({
    models: ['locked', 'other'],
    hedgeDelayMs: 5_000,
    deadlineMs: 400,
    call: (model) => {
      calls.push(model)
      return Promise.resolve({ ok: false, detail: 'key rejected', fatal: true })
    },
  }).then(
    () => {
      throw new Error('expected rejection')
    },
    (err: Error) => err,
  )
  assert.match(error.message, /auth failed/)
  assert.deepEqual(calls, ['locked'])
})

test('a hard model error is surfaced when nothing else can answer', async () => {
  const error = await raceVisionModels({
    models: ['only'],
    hedgeDelayMs: 5_000,
    deadlineMs: 400,
    call: async () => ({ ok: false, detail: '400 image is invalid' }),
  }).then(
    () => {
      throw new Error('expected rejection')
    },
    (err: Error) => err,
  )
  assert.match(error.message, /400 image is invalid/)
})

test('deadline aborts hung models with a busy error', async () => {
  const started = Date.now()
  const error = await raceVisionModels({
    models: ['a', 'b', 'c'],
    hedgeDelayMs: 10,
    deadlineMs: 40,
    call: (_model, signal) => hangUntilAbort(signal),
  }).then(
    () => {
      throw new Error('expected rejection')
    },
    (err: Error) => err,
  )
  assert.match(error.message, /busy right now/)
  assert.ok(Date.now() - started < 250)
})

test('label scan rotates through 50 distinct wine facts', () => {
  assert.equal(WINE_FACT_COUNT, 50)
  assert.equal(new Set(WINE_FACTS).size, 50)
  for (const fact of WINE_FACTS) {
    assert.equal(fact.trim(), fact)
    assert.ok(fact.length >= 20, fact)
    assert.ok(fact.length <= 110, `${fact.length}: ${fact}`)
  }
})
