import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

interface Body {
  token?: string
  platform?: 'ios' | 'android'
  remove?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    if (req.method === 'DELETE') {
      const body = (await req.json().catch(() => ({}))) as Body
      if (body.token) {
        await admin.from('push_device_tokens').delete().eq('token', body.token).eq('user_id', user.id)
      } else {
        await admin.from('push_device_tokens').delete().eq('user_id', user.id)
      }
      return jsonResponse({ ok: true })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const body = (await req.json()) as Body
    if (body.remove) {
      const token = body.token?.trim()
      if (token) {
        await admin.from('push_device_tokens').delete().eq('token', token).eq('user_id', user.id)
      } else {
        await admin.from('push_device_tokens').delete().eq('user_id', user.id)
      }
      return jsonResponse({ ok: true })
    }

    const token = body.token?.trim()
    const platform = body.platform
    if (!token || (platform !== 'ios' && platform !== 'android')) {
      return jsonResponse({ error: 'token and platform (ios|android) required' }, 400)
    }

    const { error } = await admin.from('push_device_tokens').upsert(
      {
        user_id: user.id,
        platform,
        token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    )

    if (error) {
      console.error(error)
      return jsonResponse({ error: 'Could not save device token.' }, 500)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Unexpected error.' }, 500)
  }
})
