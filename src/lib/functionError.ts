import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'

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
    if (error.context.status === 404) {
      return {
        message:
          'Scan service is not deployed. In Supabase, run the ai-scan-uploads migration and deploy scan-label.',
        code: 'not_configured',
      }
    }
  }

  if (error instanceof FunctionsFetchError) {
    const cause = error.context instanceof Error ? error.context.message : ''
    const detail = cause && cause !== error.message ? ` (${cause})` : ''
    return {
      message:
        `Could not reach the scan service${detail}. Check your connection and try again. ` +
        'If this keeps happening, apply the ai-scan-uploads storage migration and redeploy scan-label.',
      code: 'network_error',
    }
  }

  if (/failed to send a request to the edge function/i.test(error.message)) {
    return {
      message:
        'Could not reach the scan service. Check your connection and try again. ' +
        'If this keeps happening, apply the ai-scan-uploads storage migration and redeploy scan-label.',
      code: 'network_error',
    }
  }

  return { message: error.message }
}
