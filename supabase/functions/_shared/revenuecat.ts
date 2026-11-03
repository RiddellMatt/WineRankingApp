const ENTITLEMENT_LOOKUPS = (primary: string) =>
  Array.from(new Set([primary, 'pro', 'decanti_pro'].filter(Boolean)))

function revenueCatSecretKey(): string {
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY')
  if (!key) throw new Error('RevenueCat server API is not configured.')
  return key
}

interface RcEntitlement {
  expires_date: string | null
  grace_period_expires_date?: string | null
}

interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RcEntitlement>
  }
}

function v1EntitlementActive(ent: RcEntitlement | undefined): boolean {
  if (!ent) return false
  const expires = ent.expires_date
  if (!expires) return true
  return Date.parse(expires) > Date.now()
}

function v1HasPro(body: RcSubscriberResponse, lookups: string[]): boolean {
  const ents = body.subscriber?.entitlements
  if (!ents) return false
  return lookups.some((key) => v1EntitlementActive(ents[key]))
}

interface V2ActiveEntitlement {
  entitlement_id: string
  expires_at: number | null
}

interface V2EntitlementRow {
  id: string
  lookup_key?: string | null
}

function v2EntitlementActive(expiresAt: number | null): boolean {
  if (expiresAt == null) return true
  return expiresAt > Date.now()
}

async function fetchV2ProEntitlementIds(
  projectId: string,
  secret: string,
  lookups: string[],
): Promise<Set<string>> {
  const res = await fetch(`https://api.revenuecat.com/v2/projects/${projectId}/entitlements`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  if (!res.ok) return new Set()
  const body = (await res.json()) as { items?: V2EntitlementRow[] }
  const ids = new Set<string>()
  for (const row of body.items ?? []) {
    const key = row.lookup_key?.trim()
    if (key && lookups.includes(key)) ids.add(row.id)
  }
  return ids
}

async function v2HasPro(
  projectId: string,
  userId: string,
  secret: string,
  lookups: string[],
): Promise<boolean> {
  const proIds = await fetchV2ProEntitlementIds(projectId, secret, lookups)
  if (proIds.size === 0) return false

  const url = `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(userId)}/active_entitlements`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } })
  if (res.status === 404) return false
  if (!res.ok) {
    const text = await res.text()
    console.error('RevenueCat v2 active_entitlements failed:', res.status, text)
    throw new Error(`RevenueCat API error (${res.status})`)
  }

  const body = (await res.json()) as { items?: V2ActiveEntitlement[] }
  return (body.items ?? []).some(
    (item) => proIds.has(item.entitlement_id) && v2EntitlementActive(item.expires_at),
  )
}

/** Returns whether the Supabase user has active Pro in RevenueCat. */
export async function revenueCatUserHasPro(
  userId: string,
  entitlementId: string,
): Promise<boolean> {
  const secret = revenueCatSecretKey()
  const lookups = ENTITLEMENT_LOOKUPS(entitlementId)
  const projectId = Deno.env.get('REVENUECAT_PROJECT_ID')?.trim()

  const v1Res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  )

  if (v1Res.status === 404) return false
  if (v1Res.ok) {
    const body = (await v1Res.json()) as RcSubscriberResponse
    return v1HasPro(body, lookups)
  }

  if (v1Res.status !== 401 && v1Res.status !== 403) {
    const text = await v1Res.text()
    console.error('RevenueCat v1 subscriber fetch failed:', v1Res.status, text)
    throw new Error(`RevenueCat API error (${v1Res.status})`)
  }

  if (!projectId) {
    throw new Error(
      'REVENUECAT_PROJECT_ID is required when using a RevenueCat secret API key v2. Set it in Supabase Edge Function secrets (Project settings → General in RevenueCat).',
    )
  }

  return v2HasPro(projectId, userId, secret, lookups)
}
