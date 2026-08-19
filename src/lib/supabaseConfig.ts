const PLACEHOLDER_KEY = 'your-anon-key-here'
const PLACEHOLDER_URL = 'YOUR_PROJECT_REF'

export function getSupabaseEnv(): { url?: string; anonKey?: string } {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  }
}

export function looksLikePlaceholderConfig(url?: string, anonKey?: string): boolean {
  const trimmedUrl = url?.trim() ?? ''
  const trimmedKey = anonKey?.trim() ?? ''
  if (!trimmedUrl || !trimmedKey) return true
  if (trimmedUrl.includes(PLACEHOLDER_URL)) return true
  if (trimmedKey === PLACEHOLDER_KEY) return true
  if (!trimmedUrl.includes('.supabase.co')) return true
  if (!trimmedKey.startsWith('eyJ')) return true
  return false
}

/** Ping Supabase Auth to catch wrong/expired anon keys before OAuth. */
export async function verifySupabaseConnection(
  url: string,
  anonKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    })
    if (res.ok) return null
    if (res.status === 401 || res.status === 403) {
      return 'invalid_api_key'
    }
    return `http_${res.status}`
  } catch {
    return 'network_error'
  }
}

export function friendlySupabaseConfigError(code: string | null): string | null {
  if (!code) return null
  switch (code) {
    case 'missing':
      return (
        'Cloud sign-in is not configured on this build. Add VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY to .env.local, then run npm run cap:sync and rebuild the app.'
      )
    case 'placeholder':
      return (
        'This build still has placeholder Supabase settings. Copy .env.example to .env.local, ' +
        'paste your real anon key from Supabase → Project Settings → API, then rebuild.'
      )
    case 'invalid_api_key':
      return (
        'Invalid Supabase API key in this build. In Supabase → Project Settings → API, copy the ' +
        'anon public key into .env.local (and GitHub Pages secrets if using web), then rebuild.'
      )
    case 'network_error':
      return 'Could not reach Supabase. Check your network connection and try again.'
    default:
      return 'Cloud sign-in is unavailable on this build. Rebuild after updating Supabase env vars.'
  }
}

export function friendlyAuthError(message: string): string {
  if (/invalid api key/i.test(message)) {
    return (
      friendlySupabaseConfigError('invalid_api_key') ??
      'Invalid Supabase API key. Update VITE_SUPABASE_ANON_KEY and rebuild the app.'
    )
  }
  return message
}
