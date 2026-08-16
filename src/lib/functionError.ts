import { FunctionsHttpError } from '@supabase/supabase-js'

interface FunctionErrorBody {
  error?: string
  code?: string
}

/** Pull the JSON error body from a failed Edge Function invoke. */
export async function readFunctionError(
  error: Error,
  data: unknown,
): Promise<{ message: string; code?: string }> {
  if (data && typeof data === 'object') {
    const payload = data as FunctionErrorBody
    if (payload.error) {
      return { message: payload.error, code: payload.code }
    }
  }

  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = (await error.context.json()) as FunctionErrorBody
      if (body?.error) {
        return { message: body.error, code: body.code }
      }
    } catch {
      // Response body wasn't JSON — fall through.
    }
  }

  return { message: error.message }
}
