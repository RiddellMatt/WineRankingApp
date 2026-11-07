import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  buildPushMessage,
  type PushNotificationType,
  shouldSendPushForType,
} from '../_shared/pushMessage.ts'
import { sendNativePush } from '../_shared/pushSend.ts'

const WEBHOOK_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET')?.trim()

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    id: string
    recipient_id: string
    actor_id: string | null
    type: PushNotificationType
    payload: Record<string, unknown>
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  if (WEBHOOK_SECRET) {
    const provided = req.headers.get('x-push-dispatch-secret')
    if (provided !== WEBHOOK_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
  }

  try {
    const body = (await req.json()) as WebhookPayload | { notification_id?: string }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    let record: WebhookPayload['record'] | null = null

    if ('record' in body && body.record?.id) {
      record = body.record as WebhookPayload['record']
    } else if ('notification_id' in body && body.notification_id) {
      const { data } = await admin
        .from('notifications')
        .select('id, recipient_id, actor_id, type, payload')
        .eq('id', body.notification_id)
        .maybeSingle()
      record = data as WebhookPayload['record'] | null
    }

    if (!record) {
      return jsonResponse({ skipped: true, reason: 'no record' })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('push_notification_prefs')
      .eq('id', record.recipient_id)
      .maybeSingle()

    const prefs = (profile?.push_notification_prefs ?? null) as Record<string, unknown> | null
    if (!shouldSendPushForType(record.type, prefs)) {
      return jsonResponse({ skipped: true, reason: 'prefs' })
    }

    let actorName = 'Someone'
    if (record.actor_id) {
      const { data: actor } = await admin
        .from('profiles')
        .select('display_name, email')
        .eq('id', record.actor_id)
        .maybeSingle()
      if (actor?.display_name?.trim()) actorName = actor.display_name.trim()
      else if (actor?.email) actorName = actor.email.split('@')[0] ?? actorName
    }

    const message = buildPushMessage({
      type: record.type,
      payload: record.payload ?? {},
      actorName,
    })

    const { data: tokens, error: tokenErr } = await admin
      .from('push_device_tokens')
      .select('platform, token')
      .eq('user_id', record.recipient_id)

    if (tokenErr) {
      console.error(tokenErr)
      return jsonResponse({ error: 'Token lookup failed' }, 500)
    }

    if (!tokens?.length) {
      return jsonResponse({ skipped: true, reason: 'no tokens' })
    }

    const results: { platform: string; ok: boolean; error?: string }[] = []
    for (const row of tokens) {
      const platform = row.platform as 'ios' | 'android'
      const sent = await sendNativePush(
        platform,
        row.token,
        message.title,
        message.body,
        message.deepLink,
      )
      results.push({ platform, ...sent })
      if (!sent.ok && /not registered|Unregistered|410|404/i.test(sent.error ?? '')) {
        await admin.from('push_device_tokens').delete().eq('token', row.token)
      }
    }

    const anyOk = results.some((r) => r.ok)
    const allUnconfigured = results.every((r) => r.error?.includes('not configured'))

    return jsonResponse({
      sent: anyOk,
      skipped: !anyOk && allUnconfigured,
      results,
    })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Dispatch failed' }, 500)
  }
})
