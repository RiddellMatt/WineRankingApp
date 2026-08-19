import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { OAUTH_ERROR_EVENT, OAUTH_SUCCESS_EVENT } from '../lib/mobileOAuth'
import { isNativeApp } from '../lib/platform'

export function AuthScreen() {
  const { signIn, signUp, signInWithOAuth, continueOffline, user, configError } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) setBusy(false)
  }, [user])

  useEffect(() => {
    function onOAuthSuccess() {
      setBusy(false)
    }
    function onOAuthError(event: Event) {
      setBusy(false)
      setError(String((event as CustomEvent<string>).detail ?? 'Sign in failed.'))
    }
    window.addEventListener(OAUTH_SUCCESS_EVENT, onOAuthSuccess)
    window.addEventListener(OAUTH_ERROR_EVENT, onOAuthError)
    return () => {
      window.removeEventListener(OAUTH_SUCCESS_EVENT, onOAuthSuccess)
      window.removeEventListener(OAUTH_ERROR_EVENT, onOAuthError)
    }
  }, [])

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('')
    setInfo('')
    setBusy(true)
    const err = await signInWithOAuth(provider)
    if (err) {
      setBusy(false)
      setError(err)
      return
    }
    if (!isNativeApp()) {
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    const err =
      mode === 'signup'
        ? await signUp(email.trim(), password, displayName.trim())
        : await signIn(email.trim(), password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    if (mode === 'signup') {
      setInfo('Check your email to confirm your account, then sign in.')
      setMode('signin')
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <span className="brand-icon auth-icon" aria-hidden="true">
          🍷
        </span>
        <h1>Cellar Rank</h1>
        <p className="auth-tagline">
          Sign in to sync your cellar across devices and share ratings with friends.
        </p>

        {configError && <p className="form-error auth-config-error">{configError}</p>}

        <div className="auth-oauth">
          <button
            type="button"
            className="btn oauth google"
            disabled={busy}
            onClick={() => handleOAuth('google')}
          >
            Continue with Google
          </button>
          <button
            type="button"
            className="btn oauth apple"
            disabled={busy}
            onClick={() => handleOAuth('apple')}
          >
            Continue with Apple
          </button>
        </div>

        <div className="auth-divider" aria-hidden="true">
          <span>or use email</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="field">
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                placeholder="How friends will see you"
                minLength={2}
                maxLength={40}
                required
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}
          <button type="submit" className="btn primary auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          className="link-btn auth-toggle"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError('')
            setInfo('')
          }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>

        <button type="button" className="btn ghost auth-offline" onClick={continueOffline}>
          Continue without an account
        </button>
        <p className="auth-offline-note">Offline mode keeps data on this device only — no friends sync.</p>
      </div>
    </div>
  )
}
