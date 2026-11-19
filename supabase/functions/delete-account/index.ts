import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

/** Folders are `{userId}/{file}`. Postgres rows cascade from auth.users; these objects do not. */
const BUCKETS = ['avatars', 'ai-scan-uploads']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== 'DELETE') {
      return jsonResponse({ error: 'Type DELETE to confirm.' }, 400)
    }

    for (const bucket of BUCKETS) {
      await removeUserFolder(admin, bucket, user.id)
    }

    const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (accessToken) {
      const { error: signOutError } = await admin.auth.admin.signOut(accessToken, 'global')
      if (signOutError) {
        console.warn('delete-account: session revoke failed', signOutError.message)
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('delete-account: deleteUser failed', deleteError.message)
      return jsonResponse(
        { error: 'Account deletion did not finish. Sign in and try again.' },
        500,
      )
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('delete-account:', err)
    return jsonResponse({ error: 'Could not delete the account.' }, 500)
  }
})

async function removeUserFolder(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<void> {
  const pageSize = 100
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(userId, {
      limit: pageSize,
      offset: 0,
    })
    if (error) {
      if (error.message.toLowerCase().includes('bucket not found')) {
        console.warn(`delete-account: skip ${bucket}: ${error.message}`)
        return
      }
      throw error
    }

    const names = (data ?? [])
      .filter((entry) => entry.id && entry.name && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
    if (names.length === 0) return

    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(names.map((name) => `${userId}/${name}`))
    if (removeError) throw removeError
    if (names.length < pageSize) return
  }
}
