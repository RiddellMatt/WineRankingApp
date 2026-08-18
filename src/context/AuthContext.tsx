import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Provider, Session, User } from '@supabase/supabase-js'
import { authRedirectUrl, cleanAuthParamsFromUrl } from '../lib/authRedirect'
import { startNativeOAuth } from '../lib/mobileOAuth'
import { isNativeApp } from '../lib/platform'
import {
  completeWebOAuthFromUrl,
  emitWebOAuthError,
  isWebOAuthCallback,
} from '../lib/webOAuth'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

interface AuthState {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  offlineMode: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithOAuth: (provider: Provider) => Promise<string | null>
  signOut: () => Promise<void>
  continueOffline: () => void
  exitOffline: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const OFFLINE_KEY = 'cellar-rank.offline-mode'

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)
  const [offlineMode, setOfflineMode] = useState(() => {
    if (!configured) return true
    return localStorage.getItem(OFFLINE_KEY) === 'true'
  })

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }

    const supabase = getSupabase()

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) cleanAuthParamsFromUrl()
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (next) {
        setOfflineMode(false)
        localStorage.removeItem(OFFLINE_KEY)
        if (event === 'SIGNED_IN') cleanAuthParamsFromUrl()
      }
      setLoading(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [configured])

  // Safari / GitHub Pages: finish OAuth when Google redirects back with ?code=
  useEffect(() => {
    if (!configured || !isWebOAuthCallback()) return

    let cancelled = false
    setLoading(true)

    void completeWebOAuthFromUrl(window.location.href).then((err) => {
      if (cancelled) return
      if (err) emitWebOAuthError(err)
      cleanAuthParamsFromUrl()
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [configured])

  async function signUp(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<string | null> {
    const trimmedName = displayName?.trim()
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: trimmedName
        ? { data: { display_name: trimmedName } }
        : undefined,
    })
    return error?.message ?? null
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signInWithOAuth(provider: Provider): Promise<string | null> {
    if (isNativeApp()) {
      return startNativeOAuth(provider)
    }

    const options: { redirectTo: string; scopes?: string } = {
      redirectTo: authRedirectUrl(),
    }
    if (provider === 'apple') {
      options.scopes = 'name email'
    }

    const { error } = await getSupabase().auth.signInWithOAuth({ provider, options })
    return error?.message ?? null
  }

  async function signOut(): Promise<void> {
    await getSupabase().auth.signOut()
    setSession(null)
  }

  function continueOffline(): void {
    setOfflineMode(true)
    localStorage.setItem(OFFLINE_KEY, 'true')
  }

  function exitOffline(): void {
    setOfflineMode(false)
    localStorage.removeItem(OFFLINE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        configured,
        loading,
        session,
        user: session?.user ?? null,
        offlineMode: !configured || offlineMode,
        signUp,
        signIn,
        signInWithOAuth,
        signOut,
        continueOffline,
        exitOffline,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
