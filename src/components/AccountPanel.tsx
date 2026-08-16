import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FREE_WINE_LIMIT, PRO_CONFIG } from '../config'
import { redeemUnlockCode } from '../pro'
import { updateDisplayName, type UserProfile } from '../lib/profileDb'

const PRO_FEATURES = [
  'Unlimited wines',
  'Insights dashboard',
  'Export & import your cellar',
] as const

interface Props {
  profile: UserProfile | null
  email?: string
  signedIn: boolean
  offlineMode: boolean
  cloudConfigured: boolean
  pro: boolean
  wineCount: number
  highlightSubscription?: boolean
  onProfileSaved: (profile: UserProfile) => void
  onProUnlocked: () => void
  onSignOut: () => void
  onSignIn: () => void
}

function avatarInitial(name: string, email?: string): string {
  const source = name.trim() || email?.split('@')[0] || '?'
  return source.charAt(0).toUpperCase()
}

export function AccountPanel({
  profile,
  email,
  signedIn,
  offlineMode,
  cloudConfigured,
  pro,
  wineCount,
  highlightSubscription = false,
  onProfileSaved,
  onProUnlocked,
  onSignOut,
  onSignIn,
}: Props) {
  const subscriptionRef = useRef<HTMLElement>(null)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [profileError, setProfileError] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileInfo, setProfileInfo] = useState('')

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [showCode, setShowCode] = useState(false)

  const resolvedEmail = profile?.email || email || ''
  const resolvedName =
    profile?.displayName || email?.split('@')[0] || 'Wine lover'

  useEffect(() => {
    setDisplayName(profile?.displayName ?? email?.split('@')[0] ?? '')
  }, [profile?.displayName, email])

  useEffect(() => {
    if (!highlightSubscription || !subscriptionRef.current) return
    subscriptionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [highlightSubscription])

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!signedIn) return
    setProfileError('')
    setProfileInfo('')
    setProfileBusy(true)
    try {
      const next = await updateDisplayName(displayName)
      onProfileSaved(next)
      setProfileInfo('Display name saved.')
    } catch (err) {
      setProfileError(String((err as Error).message ?? err))
    } finally {
      setProfileBusy(false)
    }
  }

  function handleRedeem(e: FormEvent) {
    e.preventDefault()
    setCodeError('')
    if (redeemUnlockCode(code)) {
      onProUnlocked()
      setCode('')
      setShowCode(false)
    } else {
      setCodeError('That code is not valid.')
    }
  }

  return (
    <div className="account-panel">
      {signedIn && (
        <section className="account-hero">
          <div className="account-avatar" aria-hidden="true">
            {avatarInitial(resolvedName, resolvedEmail)}
          </div>
          <div className="account-hero-text">
            <h2 className="account-hero-name">{resolvedName}</h2>
            <p className="account-hero-email">{resolvedEmail}</p>
          </div>
        </section>
      )}

      {signedIn && (
        <section className="account-section">
          <h3>Profile</h3>
          <form className="account-profile-form" onSubmit={handleSaveProfile}>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How friends see you"
                minLength={2}
                maxLength={40}
                required
              />
            </label>
            <p className="account-hint">Shown on friend requests and shared cellars.</p>
            {profileInfo && <p className="auth-info">{profileInfo}</p>}
            {profileError && <p className="form-error">{profileError}</p>}
            <button type="submit" className="btn primary small" disabled={profileBusy}>
              {profileBusy ? 'Saving…' : 'Save name'}
            </button>
          </form>
          <label className="field account-readonly">
            <span>Email</span>
            <input value={resolvedEmail} readOnly />
          </label>
          <p className="account-hint">Used for sign-in and finding friends.</p>
        </section>
      )}

      {!signedIn && cloudConfigured && offlineMode && (
        <section className="account-section account-cloud-cta">
          <h3>Cloud sync</h3>
          <p>Sign in to sync your cellar across devices and share ratings with friends.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            Sign in or create account
          </button>
        </section>
      )}

      {!cloudConfigured && (
        <section className="account-section account-cloud-cta">
          <h3>Cloud sync</h3>
          <p>Accounts and friends require Supabase configuration on this deployment.</p>
        </section>
      )}

      <section
        ref={subscriptionRef}
        className={`account-section ${highlightSubscription ? 'account-section-highlight' : ''}`}
        id="subscription"
      >
        <h3>Subscription</h3>
        <div className={`account-plan ${pro ? 'pro' : 'free'}`}>
          <div className="account-plan-header">
            <span className="account-plan-name">{pro ? 'Cellar Rank Pro' : 'Free plan'}</span>
            {pro && <span className="pro-badge">PRO</span>}
          </div>
          <p className="account-plan-detail">
            {pro
              ? 'Unlimited wines, Insights, and export on this device.'
              : `${wineCount} / ${FREE_WINE_LIMIT} wines · Insights and export locked`}
          </p>
          {!pro && (
            <p className="account-hint">Pro status is saved on this device only.</p>
          )}
        </div>

        {!pro && (
          <>
            <ul className="account-pro-features">
              {PRO_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            {PRO_CONFIG.paymentUrl ? (
              <a
                className="btn primary account-upgrade"
                href={PRO_CONFIG.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Upgrade — {PRO_CONFIG.priceLabel}
              </a>
            ) : (
              <p className="account-hint">
                Paid checkout isn&apos;t connected yet. Use an unlock code below.
              </p>
            )}

            {showCode ? (
              <form className="account-code-row" onSubmit={handleRedeem}>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setCodeError('')
                  }}
                  placeholder="Unlock code"
                />
                <button type="submit" className="btn ghost">
                  Redeem
                </button>
              </form>
            ) : (
              <button type="button" className="link-btn" onClick={() => setShowCode(true)}>
                Have an unlock code?
              </button>
            )}
            {codeError && <p className="form-error">{codeError}</p>}
          </>
        )}
      </section>

      {signedIn && (
        <section className="account-section account-signout">
          <button type="button" className="btn ghost account-signout-btn" onClick={onSignOut}>
            Sign out
          </button>
        </section>
      )}
    </div>
  )
}
