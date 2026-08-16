import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

interface AuthState {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  offlineMode: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
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
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        setOfflineMode(false)
        localStorage.removeItem(OFFLINE_KEY)
      }
    })

    return () => sub.subscription.unsubscribe()
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
