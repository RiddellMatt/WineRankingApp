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
  /** Some API responses use display identifier here. */
  display_name?: string | null
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
    if (lookups.includes(row.id)) ids.add(row.id)
  }
  return ids
}

function v2ActiveItemIsPro(
  item: V2ActiveEntitlement,
  lookups: string[],
  proIds: Set<string>,
): boolean {
  if (!v2EntitlementActive(item.expires_at)) return false
  if (lookups.includes(item.entitlement_id)) return true
  return proIds.has(item.entitlement_id)
}

async function v2HasPro(
  projectId: string,
  userId: string,
  secret: string,
  lookups: string[],
): Promise<boolean> {
  const proIds = await fetchV2ProEntitlementIds(projectId, secret, lookups)

  const url = `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(userId)}/active_entitlements`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } })
  if (res.status === 404) return false
  if (!res.ok) {
    const text = await res.text()
    console.error('RevenueCat v2 active_entitlements failed:', res.status, text)
    throw new Error(`RevenueCat API error (${res.status})`)
  }

  const body = (await res.json()) as { items?: V2ActiveEntitlement[] }
  const items = body.items ?? []
  if (items.some((item) => v2ActiveItemIsPro(item, lookups, proIds))) return true
  // Decanti ships one paid entitlement; any active RC entitlement counts as Pro.
  if (items.some((item) => v2EntitlementActive(item.expires_at))) return true

  // Catalog list failed or IDs differ — try v2 customer (includes subscription entitlements).
  const customerUrl = `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(userId)}`
  const customerRes = await fetch(customerUrl, { headers: { Authorization: `Bearer ${secret}` } })
  if (customerRes.ok) {
    const customer = (await customerRes.json()) as {
      active_entitlements?: { items?: V2ActiveEntitlement[] }
    }
    const extra = customer.active_entitlements?.items ?? []
    if (extra.some((item) => v2ActiveItemIsPro(item, lookups, proIds))) return true
  }

  return false
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

  if (v1Res.ok) {
    const body = (await v1Res.json()) as RcSubscriberResponse
    return v1HasPro(body, lookups)
  }

  const tryV2 =
    projectId &&
    (v1Res.status === 404 || v1Res.status === 401 || v1Res.status === 403)

  if (!tryV2) {
    if (v1Res.status === 404) return false
    const text = await v1Res.text()
    console.error('RevenueCat v1 subscriber fetch failed:', v1Res.status, text)
    throw new Error(`RevenueCat API error (${v1Res.status})`)
  }

  return v2HasProWithProjectCandidates(userId, secret, lookups)
}

async function v2HasProWithProjectCandidates(
  userId: string,
  secret: string,
  lookups: string[],
): Promise<boolean> {
  const raw = Deno.env.get('REVENUECAT_PROJECT_ID')?.trim()
  if (!raw) {
    throw new Error(
      'REVENUECAT_PROJECT_ID is required when using a RevenueCat secret API key v2. Set it in Supabase Edge Function secrets (Project settings → General in RevenueCat).',
    )
  }
  const candidates = Array.from(
    new Set([raw, raw.startsWith('proj') ? raw : `proj${raw}`].filter(Boolean)),
  )
  let last404 = true
  for (const projectId of candidates) {
    const has = await v2HasPro(projectId, userId, secret, lookups)
    if (has) return true
    const probe = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    )
    if (probe.status !== 404) last404 = false
  }
  if (last404) {
    console.warn(`RevenueCat: no customer for app_user_id ${userId} (check Purchases.logIn matches Supabase uuid)`)
  }
  return false
}
