export const MOBILE_APP_SCHEME = 'com.northline.decanti'

export function mobileCheckoutUrls(): { successUrl: string; cancelUrl: string } {
  const scheme = Deno.env.get('MOBILE_APP_SCHEME') ?? MOBILE_APP_SCHEME
  return {
    successUrl: Deno.env.get('MOBILE_STRIPE_SUCCESS_URL') ?? `${scheme}://checkout-success`,
    cancelUrl: Deno.env.get('MOBILE_STRIPE_CANCEL_URL') ?? `${scheme}://checkout-cancel`,
  }
}

export function mobilePortalReturnUrl(): string {
  const scheme = Deno.env.get('MOBILE_APP_SCHEME') ?? MOBILE_APP_SCHEME
  return Deno.env.get('MOBILE_STRIPE_PORTAL_RETURN_URL') ?? `${scheme}://account`
}

export function webCheckoutUrls(): { successUrl: string; cancelUrl: string } {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://riddellmatt.github.io/WineRankingApp/'
  const base = appUrl.endsWith('/') ? appUrl : `${appUrl}/`
  return {
    successUrl: Deno.env.get('STRIPE_SUCCESS_URL') ?? `${base}?checkout=success`,
    cancelUrl: Deno.env.get('STRIPE_CANCEL_URL') ?? `${base}?checkout=cancel`,
  }
}

export function webPortalReturnUrl(): string {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://riddellmatt.github.io/WineRankingApp/'
  const base = appUrl.endsWith('/') ? appUrl : `${appUrl}/`
  return Deno.env.get('STRIPE_PORTAL_RETURN_URL') ?? `${base}?view=account`
}

export async function readRequestPlatform(req: Request): Promise<'mobile' | 'web'> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return 'web'
  try {
    const body = await req.json()
    return body?.platform === 'mobile' ? 'mobile' : 'web'
  } catch {
    return 'web'
  }
}
