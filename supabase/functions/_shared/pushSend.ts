import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

export async function sendFcmPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')?.trim()
  if (!raw) return { ok: false, error: 'FCM not configured' }

  let sa: { project_id: string; client_email: string; private_key: string }
  try {
    sa = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Invalid FCM_SERVICE_ACCOUNT_JSON' }
  }

  const accessToken = await googleAccessToken(sa)
  if (!accessToken) return { ok: false, error: 'FCM auth failed' }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: 'HIGH' },
        },
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `FCM ${res.status}: ${text.slice(0, 200)}` }
  }
  return { ok: true }
}

async function googleAccessToken(sa: {
  client_email: string
  private_key: string
}): Promise<string | null> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: getNumericDate(60 * 55),
      iat: getNumericDate(0),
    },
    key,
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.access_token ?? null
}

function pemToBinary(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

let apnsJwtCache: { token: string; exp: number } | null = null

export async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const keyId = Deno.env.get('APNS_KEY_ID')?.trim()
  const teamId = Deno.env.get('APNS_TEAM_ID')?.trim()
  const bundleId = Deno.env.get('APNS_BUNDLE_ID')?.trim() || 'com.northline.decanti'
  const keyP8 = Deno.env.get('APNS_KEY_P8')?.trim()
  const production = Deno.env.get('APNS_PRODUCTION') !== 'false'

  if (!keyId || !teamId || !keyP8) {
    return { ok: false, error: 'APNs not configured' }
  }

  const auth = await apnsAuthToken(keyId, teamId, keyP8)
  if (!auth) return { ok: false, error: 'APNs auth failed' }

  const host = production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${auth}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
      },
      ...data,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `APNs ${res.status}: ${text.slice(0, 200)}` }
  }
  return { ok: true }
}

async function apnsAuthToken(
  keyId: string,
  teamId: string,
  keyP8: string,
): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  if (apnsJwtCache && apnsJwtCache.exp > now + 60) return apnsJwtCache.token

  const pem = keyP8.includes('BEGIN PRIVATE KEY')
    ? keyP8
    : `-----BEGIN PRIVATE KEY-----\n${keyP8}\n-----END PRIVATE KEY-----`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const jwt = await create(
    { alg: 'ES256', typ: 'JWT', kid: keyId },
    { iss: teamId, iat: now },
    key,
  )

  apnsJwtCache = { token: jwt, exp: now + 3000 }
  return jwt
}

export async function sendNativePush(
  platform: 'ios' | 'android',
  token: string,
  title: string,
  body: string,
  deepLink: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = { deepLink }
  if (platform === 'android') {
    return sendFcmPush(token, title, body, data)
  }
  return sendApnsPush(token, title, body, data)
}
