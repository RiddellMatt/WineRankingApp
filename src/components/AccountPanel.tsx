import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FREE_WINE_LIMIT, PRO_CONFIG } from '../config'
import { activatePro } from '../pro'
import { createBillingPortal, createProCheckout } from '../lib/checkoutApi'
import { openExternalUrl } from '../lib/openUrl'
import { redeemProOnServer } from '../lib/proApi'
import { Avatar } from './Avatar'
import { removeAvatar, updateDisplayName, uploadAvatar, type UserProfile } from '../lib/profileDb'

const PRO_FEATURES = [
  'Unlimited wines',
  'Insights dashboard',
  'Export & import your cellar',
  'AI menu scan (30/month)',
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
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [profileError, setProfileError] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [profileInfo, setProfileInfo] = useState('')

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)

  const resolvedEmail = profile?.email || email || ''
  const resolvedName =
    profile?.displayName || email?.split('@')[0] || 'Wine lover'
  const canCheckout = signedIn && cloudConfigured && !offlineMode

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

  async function handleRedeem(e: FormEvent) {
    e.preventDefault()
    setCodeError('')
    if (!signedIn || !cloudConfigured) {
      setCodeError('Sign in to redeem a promo code.')
      return
    }
    try {
      await redeemProOnServer(code)
      activatePro()
      onProUnlocked()
      setCode('')
      setShowCode(false)
      setProfileInfo('Pro unlocked on your account.')
    } catch (err) {
      setCodeError(String((err as Error).message ?? err))
    }
  }

  async function handleUpgrade() {
    setCodeError('')
    if (!canCheckout) {
      onSignIn()
      return
    }
    setCheckoutBusy(true)
    try {
      const url = await createProCheckout()
      await openExternalUrl(url)
    } catch (err) {
      setCodeError(String((err as Error).message ?? err))
    } finally {
      setCheckoutBusy(false)
    }
  }

  async function handleManageBilling() {
    setCodeError('')
    setBillingBusy(true)
    try {
      const url = await createBillingPortal()
      await openExternalUrl(url)
    } catch (err) {
      setCodeError(String((err as Error).message ?? err))
    } finally {
      setBillingBusy(false)
    }
  }

  async function handleAvatarFile(file: File) {
    setProfileError('')
    setProfileInfo('')
    setAvatarBusy(true)
    try {
      const next = await uploadAvatar(file)
      onProfileSaved(next)
      setProfileInfo('Profile photo updated.')
    } catch (err) {
      setProfileError(String((err as Error).message ?? err))
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleRemoveAvatar() {
    if (!profile?.avatarUrl) return
    if (!window.confirm('Remove your profile photo?')) return
    setProfileError('')
    setProfileInfo('')
    setAvatarBusy(true)
    try {
      const next = await removeAvatar()
      onProfileSaved(next)
      setProfileInfo('Profile photo removed.')
    } catch (err) {
      setProfileError(String((err as Error).message ?? err))
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="account-panel">
      {signedIn && (
        <section className="account-hero">
          <Avatar
            displayName={resolvedName}
            email={resolvedEmail}
            avatarUrl={profile?.avatarUrl}
            seed={profile?.id}
            size="md"
          />
          <div className="account-hero-text">
            <h2 className="account-hero-name">{resolvedName}</h2>
            <p className="account-hero-email">{resolvedEmail}</p>
            <div className="account-hero-actions">
              <button
                type="button"
                className="btn ghost small"
                disabled={avatarBusy}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarBusy ? 'Uploading…' : profile?.avatarUrl ? 'Change photo' : 'Add photo'}
              </button>
              {profile?.avatarUrl && (
                <button
                  type="button"
                  className="link-btn"
                  disabled={avatarBusy}
                  onClick={handleRemoveAvatar}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAvatarFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </section>
      )}

      {signedIn && (profileInfo || profileError) && (
        <div className="account-flash">
          {profileInfo && <p className="auth-info">{profileInfo}</p>}
          {profileError && <p className="form-error">{profileError}</p>}
        </div>
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
              ? signedIn
                ? 'Unlimited wines, Insights, export, and AI menu scan on your account.'
                : 'Unlimited wines, Insights, and export on this device.'
              : `${wineCount} / ${FREE_WINE_LIMIT} wines · Insights and export locked`}
          </p>
          {!pro && signedIn && (
            <p className="account-hint">
              Subscribe to unlock Pro on your account — syncs across devices.
            </p>
          )}
          {!pro && !signedIn && (
            <p className="account-hint">Sign in to subscribe and sync Pro across devices.</p>
          )}
        </div>

        {pro && profile?.hasBilling && canCheckout && (
          <button
            type="button"
            className="btn ghost account-manage-billing"
            disabled={billingBusy}
            onClick={handleManageBilling}
          >
            {billingBusy ? 'Opening…' : 'Manage subscription'}
          </button>
        )}

        {!pro && (
          <>
            <ul className="account-pro-features">
              {PRO_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            {canCheckout ? (
              <button
                type="button"
                className="btn primary account-upgrade"
                disabled={checkoutBusy}
                onClick={handleUpgrade}
              >
                {checkoutBusy ? 'Starting checkout…' : `Subscribe — ${PRO_CONFIG.priceLabel}`}
              </button>
            ) : PRO_CONFIG.paymentUrl ? (
              <a
                className="btn primary account-upgrade"
                href={PRO_CONFIG.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Subscribe — {PRO_CONFIG.priceLabel}
              </a>
            ) : (
              <p className="account-hint">
                {signedIn
                  ? 'Checkout is not configured on this deployment yet.'
                  : 'Sign in to subscribe.'}
              </p>
            )}

            {canCheckout && (
              <>
                {showCode ? (
                  <form className="account-code-row" onSubmit={handleRedeem}>
                    <input
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value)
                        setCodeError('')
                      }}
                      placeholder="Promo code"
                    />
                    <button type="submit" className="btn ghost">
                      Redeem
                    </button>
                  </form>
                ) : (
                  <button type="button" className="link-btn" onClick={() => setShowCode(true)}>
                    Have a promo code?
                  </button>
                )}
              </>
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
