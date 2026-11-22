import assert from 'node:assert/strict'
import test from 'node:test'
import {
  blendSamplesForRanking,
  ENOUGH_VISION_SAMPLES,
  modelsForScan,
  modelsToProbe,
  raceVisionModels,
  rankVisionModels,
  type ModelSample,
  type VisionAttempt,
  type VisionAttemptSample,
} from '../supabase/functions/_shared/geminiVision.ts'
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

test('a fast overload falls through to a later model without waiting out the hedge', async () => {
  const calls: string[] = []
  const result = await raceVisionModels({
    models: ['overloaded', 'also-overloaded', 'works'],
    hedgeDelayMs: 5_000,
    deadlineMs: 400,
    call: async (model) => {
      calls.push(model)
      if (model === 'works') return { ok: true, text: '{"name":"Barolo"}' }
      return { ok: false, detail: `${model} 503 UNAVAILABLE high demand` }
    },
  })
  assert.equal(result.model, 'works')
  assert.deepEqual(calls, ['overloaded', 'also-overloaded', 'works'])
  assert.ok(result.durationMs < 200)
})

test('with no history the model that has been finishing labels goes first', () => {
  assert.deepEqual(modelsForScan(undefined), [
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
  ])
  const pinnedBusy = modelsForScan('gemini-3.7-flash')
  assert.equal(pinnedBusy[0], 'gemini-3.6-flash')
  assert.equal(pinnedBusy.includes('gemini-3.7-flash'), false)
  assert.equal(modelsForScan('gemini-flash-latest').includes('gemini-flash-latest'), false)
})

test('a preferred model can earn a backup slot without taking the lead', () => {
  const ranked = modelsForScan('gemini-2.5-pro')
  assert.equal(ranked[0], 'gemini-3.6-flash')
  assert.equal(ranked[3], 'gemini-2.5-pro')
  assert.equal(ranked.length, 4)
})

test('recent overloads drop a model behind one that is completing', () => {
  const now = 1_700_000_000_000
  const samples: ModelSample[] = [
    { model: 'gemini-3.6-flash', outcome: 'overload', durationMs: 280, atMs: now - 1_000 },
    { model: 'gemini-3.6-flash', outcome: 'overload', durationMs: 310, atMs: now - 2_000 },
    { model: 'gemini-3.8-flash', outcome: 'success', durationMs: 3_400, atMs: now - 4_000 },
  ]
  const ranked = rankVisionModels({ samples, nowMs: now })
  assert.equal(ranked[0]?.model, 'gemini-3.8-flash')
  assert.equal(ranked[0]?.exhausted, false)
  const tired = ranked.find((entry) => entry.model === 'gemini-3.6-flash')
  assert.ok(tired)
  assert.equal(tired.exhausted, true)
  assert.equal(ranked[ranked.length - 1]?.model, 'gemini-3.6-flash')
  assert.ok(tired.expectedAttemptMs <= 8_000)
})

test('hangs stay off the list while another model can still answer', () => {
  const now = 1_700_000_000_000
  const samples: ModelSample[] = [
    { model: 'gemini-3.6-flash', outcome: 'timeout', durationMs: 22_000, atMs: now - 1_000 },
    { model: 'gemini-3.6-flash', outcome: 'timeout', durationMs: 22_000, atMs: now - 3_000 },
  ]
  const ranked = rankVisionModels({ samples, nowMs: now })
  assert.equal(ranked[0]?.model, 'gemini-flash-lite-latest')
  assert.equal(
    ranked.some((entry) => entry.model === 'gemini-3.6-flash'),
    false,
  )
})

test('a retired model is left out after one 404', () => {
  const now = 1_700_000_000_000
  const samples: ModelSample[] = [
    { model: 'gemini-3.6-flash', outcome: 'unavailable', durationMs: 70, atMs: now - 1_000 },
  ]
  const ranked = rankVisionModels({ samples, nowMs: now })
  assert.equal(
    ranked.some((entry) => entry.model === 'gemini-3.6-flash'),
    false,
  )
  assert.equal(ranked[0]?.model, 'gemini-flash-lite-latest')
})

test('failures older than the window stop counting against a model', () => {
  const now = 1_700_000_000_000
  const samples: ModelSample[] = [
    { model: 'gemini-3.6-flash', outcome: 'timeout', durationMs: 22_000, atMs: now - 31 * 60 * 1000 },
    { model: 'gemini-3.6-flash', outcome: 'timeout', durationMs: 22_000, atMs: now - 40 * 60 * 1000 },
  ]
  assert.equal(modelsForScan(undefined, samples, now)[0], 'gemini-3.6-flash')
})

test('an aborted loser is not recorded as a model failure', async () => {
  const samples: VisionAttemptSample[] = []
  const result = await raceVisionModels({
    models: ['slow', 'fast'],
    hedgeDelayMs: 15,
    deadlineMs: 400,
    onSample: (sample) => samples.push(sample),
    call: (model, signal) => {
      if (model === 'slow') return hangUntilAbort(signal)
      return Promise.resolve({ ok: true, text: 'ok' })
    },
  })
  assert.equal(result.model, 'fast')
  assert.deepEqual(
    samples.map((sample) => sample.outcome),
    ['success'],
  )
})

test('a thin scan history asks the models themselves, then stops once there are enough photos', () => {
  const now = 1_700_000_000_000
  const vision: ModelSample = {
    model: 'gemini-3.6-flash',
    outcome: 'success',
    durationMs: 4_000,
    atMs: now - 1_000,
    source: 'vision',
  }
  const probe: ModelSample = {
    model: 'gemini-3.7-flash',
    outcome: 'overload',
    durationMs: 180,
    atMs: now - 30_000,
    source: 'probe',
  }
  const thin = blendSamplesForRanking([vision, probe], now)
  assert.equal(thin.needsLiveProbe, false)
  assert.equal(thin.visionCount, 1)
  assert.equal(thin.samples.some((sample) => sample.source === 'probe'), true)

  const staleProbe = { ...probe, atMs: now - 10 * 60 * 1000 }
  const stale = blendSamplesForRanking([vision, staleProbe], now)
  assert.equal(stale.needsLiveProbe, true)
  assert.equal(stale.samples.some((sample) => sample.source === 'probe'), false)

  const enough = Array.from({ length: ENOUGH_VISION_SAMPLES }, (_, index) => ({
    ...vision,
    atMs: now - index * 1_000,
  }))
  const full = blendSamplesForRanking([...enough, probe], now)
  assert.equal(full.needsLiveProbe, false)
  assert.equal(full.visionCount, ENOUGH_VISION_SAMPLES)
  assert.equal(full.samples.every((sample) => (sample.source ?? 'vision') === 'vision'), true)
})

test('a live overload is blended into the order while photo history is thin', () => {
  const now = 1_700_000_000_000
  const samples: ModelSample[] = [
    {
      model: 'gemini-3.6-flash',
      outcome: 'overload',
      durationMs: 220,
      atMs: now,
      source: 'probe',
    },
    {
      model: 'gemini-3.6-flash',
      outcome: 'overload',
      durationMs: 240,
      atMs: now,
      source: 'probe',
    },
    {
      model: 'gemini-flash-lite-latest',
      outcome: 'success',
      durationMs: 400,
      atMs: now,
      source: 'probe',
    },
  ]
  const ranked = rankVisionModels({ samples, nowMs: now })
  assert.equal(ranked[0]?.model, 'gemini-flash-lite-latest')
  const tired = ranked.find((entry) => entry.model === 'gemini-3.6-flash')
  assert.equal(tired?.exhausted, true)
})

test('retired models are not probed again', () => {
  const now = 1_700_000_000_000
  const models = modelsToProbe('gemini-3.7-flash', [
    {
      model: 'gemini-3.7-flash',
      outcome: 'unavailable',
      durationMs: 40,
      atMs: now - 1_000,
      source: 'vision',
    },
  ], now)
  assert.equal(models.includes('gemini-3.7-flash'), false)
  assert.equal(models.includes('gemini-3.6-flash'), true)
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
