const DEFAULT_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const

/** When GEMINI_MODEL is set, use at most one emergency fallback to limit latency and cost. */
const PINNED_EMERGENCY_FALLBACK = 'gemini-flash-latest'

export function geminiModelsToTry(): string[] {
  const configured = Deno.env.get('GEMINI_MODEL')?.trim()
  if (configured) {
    if (configured === PINNED_EMERGENCY_FALLBACK) {
      return [configured]
    }
    return [configured, PINNED_EMERGENCY_FALLBACK]
  }
  return [...DEFAULT_FALLBACKS]
}

export interface GeminiVisionResult {
  text: string
  model: string
  attempts: number
  durationMs: number
}

export async function callGeminiVision(
  apiKey: string,
  mimeType: string,
  imageBase64: string,
  prompt: string,
): Promise<GeminiVisionResult> {
  const models = geminiModelsToTry()
  let lastDetail = 'No models responded.'
  let attempts = 0
  const started = Date.now()

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      attempts += 1
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        },
      )

      if (res.ok) {
        const json = await res.json()
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          console.log(`Gemini success via ${model} after ${attempts} attempt(s)`)
          return {
            text,
            model,
            attempts,
            durationMs: Date.now() - started,
          }
        }
        lastDetail = 'No response from vision model.'
        continue
      }

      lastDetail = await res.text()
      console.error(`Gemini ${model} attempt ${attempt + 1}:`, res.status, lastDetail.slice(0, 300))

      if (res.status === 401 || res.status === 403) {
        throw new Error(`Vision API auth failed: ${lastDetail.slice(0, 200)}`)
      }

      if (res.status === 404 || res.status === 503) {
        break
      }

      if (attempt === 1) break
    }
  }

  throw new Error(`Vision API failed: ${lastDetail.slice(0, 200)}`)
}