import { FunctionsHttpError } from '@supabase/supabase-js'
import { clearLocalAccountData } from './clearLocalAccount'
import { invokeEdgeFunction } from './invokeEdgeFunction'

interface DeleteAccountPayload {
  ok?: boolean
  error?: string
}

async function messageFromFunctionError(error: Error): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    const status = error.context.status
    try {
      const body = (await error.context.json()) as DeleteAccountPayload
      if (body?.error) return body.error
    } catch {
      // Body was empty or already read.
    }
    if (status === 404) return 'Account deletion is not available on this server yet.'
  }
  return error.message || 'Could not delete the account.'
}

/** Deletes the signed-in account on the server, then drops the on-device cellar copy. */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await invokeEdgeFunction<DeleteAccountPayload>('delete-account', {
    confirm: 'DELETE',
  })

  if (error) {
    throw new Error(await messageFromFunctionError(error))
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.ok) throw new Error('Could not delete the account.')

  clearLocalAccountData()
}
