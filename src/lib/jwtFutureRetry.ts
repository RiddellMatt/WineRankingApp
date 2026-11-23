/**
 * PostgREST sometimes answers the first request on a new connection with
 * 401 PGRST303 "JWT issued at future". The same token succeeds on the next
 * try. Refreshing the session mints a newer `iat` and does not help.
 *
 * https://github.com/PostgREST/postgrest/issues/5196
 */

/** Waits before each retry after the first rejection. The first is immediate. */
export const JWT_FUTURE_RETRY_DELAYS_MS = [0, 400, 1600] as const

export function isJwtIssuedAtFuturePayload(status: number, body: string): boolean {
  if (status !== 401) return false
  return body.includes('PGRST303') || /jwt issued at future/i.test(body)
}

export function isJwtIssuedAtFutureError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; code?: unknown }
    if (record.code === 'PGRST303') return true
    if (typeof record.message === 'string' && /jwt issued at future/i.test(record.message)) {
      return true
    }
  }
  return typeof error === 'string' && /jwt issued at future/i.test(error)
}

/** Expired access tokens. PGRST303 is retried in place, so it is not a refresh signal. */
export function isSupabaseJwtTimingError(error: unknown): boolean {
  if (isJwtIssuedAtFutureError(error)) return false
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  return /jwt expired|token.*expired|clock skew/i.test(message)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function requestSignal(input: RequestInfo | URL, init?: RequestInit): AbortSignal | null {
  if (init?.signal) return init.signal
  if (typeof Request !== 'undefined' && input instanceof Request) return input.signal
  return null
}

async function responseIsJwtIssuedAtFuture(response: Response): Promise<boolean> {
  if (response.status !== 401) return false
  try {
    const body = await response.clone().text()
    return isJwtIssuedAtFuturePayload(response.status, body)
  } catch {
    return false
  }
}

function replayInput(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof Request !== 'undefined' && input instanceof Request) return input.clone()
  return input
}

/** String, blob, and form bodies can be sent again. A raw stream cannot. */
function bodyCanReplay(body: BodyInit | null | undefined): boolean {
  if (body == null || typeof body === 'string') return true
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true
  if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
    return true
  }
  return false
}

/**
 * Fetch wrapper that replays a request when PostgREST rejects it as PGRST303.
 * Other statuses, including other 401s, are returned as-is.
 */
export function createJwtFutureRetryFetch(
  baseFetch: typeof fetch = (input, init) => globalThis.fetch(input, init),
  options?: {
    sleep?: (ms: number) => Promise<void>
    delaysMs?: readonly number[]
  },
): typeof fetch {
  const sleep = options?.sleep ?? delay
  const delaysMs = options?.delaysMs ?? JWT_FUTURE_RETRY_DELAYS_MS

  return async (input, init) => {
    let last: Response | null = null
    for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
      if (attempt > 0) {
        const signal = requestSignal(input, init)
        if (signal?.aborted) return last as Response
        await sleep(delaysMs[attempt - 1] ?? 0)
        if (signal?.aborted) return last as Response
      }
      const response = await baseFetch(replayInput(input), init)
      if (!(await responseIsJwtIssuedAtFuture(response))) return response
      if (init && !bodyCanReplay(init.body)) return response
      last = response
    }
    return last as Response
  }
}
