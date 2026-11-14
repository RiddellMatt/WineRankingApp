import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FREE_WINE_LIMIT, PRO_CONFIG } from '../config'
import { activatePro } from '../pro'
import { createBillingPortal, createProCheckout } from '../lib/checkoutApi'
import {
  isIosStoreKitConfigured,
  loadDecantiProSubscriptionPreview,
  openAppleSubscriptionManagement,
  purchaseDecantiPro,
  restoreDecantiPro,
} from '../lib/revenueCat'
import { friendlyRevenueCatError } from '../lib/revenueCatErrors'
import { openExternalUrl } from '../lib/openUrl'
import { redeemProOnServer } from '../lib/proApi'
import { RANKING_PREFERENCE_OPTIONS } from '../lib/ranking'
import { updateDisplayName, uploadAvatar, removeAvatar, type UserProfile } from '../lib/profileDb'
import type { RankingPreference } from '../types'
import { APP_NAME_PRO } from '../brand'
import { Avatar } from './Avatar'
import { AppIconPicker } from './AppIconPicker'
import { ThemePicker } from './ThemePicker'
import { PushNotificationSettings } from './PushNotificationSettings'

const PRO_FEATURES = [
  'Unlimited wines',
  'Stats dashboard',
  'Export & import cellar',
  'AI menu & label scan',
] as const

type AccountSettingsTab = 'profile' | 'plan' | 'look' | 'alerts' | 'ranking'

const SETTINGS_TABS: { id: AccountSettingsTab; label: string; signedInOnly?: boolean }[] = [
  { id: 'profile', label: 'Profile', signedInOnly: true },
  { id: 'plan', label: 'Pro' },
  { id: 'look', label: 'Look' },
  { id: 'alerts', label: 'Alerts', signedInOnly: true },
  { id: 'ranking', label: 'Rank' },
]

interface Props {
  profile: UserProfile | null
  email?: string
  signedIn: boolean
  offlineMode: boolean
  cloudConfigured: boolean
  pro: boolean
  wineCount: number
  rankingPreference: RankingPreference
  highlightSubscription?: boolean
  onProfileSaved: (profile: UserProfile) => void
  onRankingPreferenceSaved: (preference: RankingPreference) => Promise<void>
  /** After StoreKit/RevenueCat unlock; keeps Pro in UI when Supabase sync is still catching up. */
  onProUnlocked: (opts?: { fromNativeIap?: boolean }) => void
  onSignOut: () => void
  onSignIn: () => void
  /** Return to public profile preview (signed-in users). */
  onBackToProfile?: () => void
}

export function AccountPanel({
  profile,
  email,
  signedIn,
  offlineMode,
  cloudConfigured,
  pro,
  wineCount,
  rankingPreference,
  highlightSubscription = false,
  onProfileSaved,
  onRankingPreferenceSaved,
  onProUnlocked,
  onSignOut,
  onSignIn,
  onBackToProfile,
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
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const iosIap = isIosStoreKitConfigured()
  const [iapPriceLabel, setIapPriceLabel] = useState<string | null>(null)
  const [iapSetupHint, setIapSetupHint] = useState<string | null>(null)
  const [iapPreviewLoaded, setIapPreviewLoaded] = useState(false)

  function subscribeButtonLabel(busy: boolean): string {
    if (busy) return iosIap ? 'Processing…' : 'Starting checkout…'
    if (iapPriceLabel) return `Subscribe — ${iapPriceLabel}`
    if (iosIap && iapPreviewLoaded) return 'Subscribe to Pro'
    return `Subscribe — ${PRO_CONFIG.priceLabel}`
  }
  const [rankingBusy, setRankingBusy] = useState(false)
  const [settingsTab, setSettingsTab] = useState<AccountSettingsTab>('profile')
  const resolvedEmail = profile?.email || email || ''
  const resolvedName =
    profile?.displayName || email?.split('@')[0] || 'Wine lover'
  const canCheckout = signedIn && cloudConfigured && !offlineMode

  useEffect(() => {
    setDisplayName(profile?.displayName ?? email?.split('@')[0] ?? '')
  }, [profile?.displayName, email])

  useEffect(() => {
    if (!iosIap || pro) {
      setIapPriceLabel(null)
      setIapSetupHint(null)
      setIapPreviewLoaded(false)
      return
    }
    let cancelled = false
    setIapPreviewLoaded(false)
    void loadDecantiProSubscriptionPreview(profile?.id).then((preview) => {
      if (cancelled) return
      setIapPriceLabel(preview.priceLabel)
      setIapSetupHint(preview.setupHint)
      setIapPreviewLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [iosIap, pro, profile?.id])

  const visibleSettingsTabs = useMemo(
    () => SETTINGS_TABS.filter((tab) => !tab.signedInOnly || signedIn),
    [signedIn],
  )

  useEffect(() => {
    if (highlightSubscription) setSettingsTab('plan')
  }, [highlightSubscription])

  useEffect(() => {
    if (!visibleSettingsTabs.some((t) => t.id === settingsTab)) {
      setSettingsTab(visibleSettingsTabs[0]?.id ?? 'look')
    }
  }, [settingsTab, visibleSettingsTabs])

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

  async function handleRankingPreferenceChange(preference: RankingPreference) {
    if (preference === rankingPreference) return
    setProfileError('')
    setProfileInfo('')
    setRankingBusy(true)
    try {
      await onRankingPreferenceSaved(preference)
      setProfileInfo('Ranking style saved.')
    } catch (err) {
      setProfileError(String((err as Error).message ?? err))
    } finally {
      setRankingBusy(false)
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
      if (iosIap) {
        const syncNote = await purchaseDecantiPro()
        activatePro()
        onProUnlocked({ fromNativeIap: true })
        setProfileInfo(syncNote ?? 'Decanti Pro is active on your account.')
        return
      }
      const url = await createProCheckout()
      await openExternalUrl(url)
    } catch (err) {
      const message = iosIap ? friendlyRevenueCatError(err) : String((err as Error).message ?? err)
      if (message !== iapSetupHint) setCodeError(message)
    } finally {
      setCheckoutBusy(false)
    }
  }

  async function handleRestorePurchases() {
    setCodeError('')
    setRestoreBusy(true)
    try {
      const result = await restoreDecantiPro(profile?.id)
      if (result.restored) {
        activatePro()
        onProUnlocked({ fromNativeIap: true })
        setProfileInfo(
          result.syncNote ?? 'Purchases restored — Decanti Pro is active.',
        )
      } else {
        setCodeError(
          'No active Decanti Pro subscription found for this Apple ID on this account. ' +
            'If Apple shows an active subscription, sign in with the same Decanti account you used when you subscribed, then tap Restore again.',
        )
      }
    } catch (err) {
      setCodeError(iosIap ? friendlyRevenueCatError(err) : String((err as Error).message ?? err))
    } finally {
      setRestoreBusy(false)
    }
  }

  async function handleManageBilling() {
    setCodeError('')
    setBillingBusy(true)
    try {
      if (iosIap) {
        await openAppleSubscriptionManagement()
        return
      }
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
      <div className="account-settings-toolbar">
        {onBackToProfile && (
          <button type="button" className="btn ghost friend-back" onClick={onBackToProfile}>
            ← Profile
          </button>
        )}
      </div>

      <nav className="friends-tabs account-settings-tabs" aria-label="Settings sections">
        {visibleSettingsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`friends-tab account-settings-tab ${settingsTab === tab.id ? 'active' : ''}`}
            onClick={() => setSettingsTab(tab.id)}
            aria-current={settingsTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {signedIn && (profileInfo || profileError) && (
        <div className="account-flash">
          {profileInfo && <p className="auth-info">{profileInfo}</p>}
          {profileError && <p className="form-error">{profileError}</p>}
        </div>
      )}

      {settingsTab === 'profile' && signedIn && (
        <>
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

          <section className="account-section">
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
              <button type="submit" className="btn primary small" disabled={profileBusy}>
                {profileBusy ? 'Saving…' : 'Save name'}
              </button>
            </form>
            <label className="field account-readonly">
              <span>Email</span>
              <input value={resolvedEmail} readOnly />
            </label>
          </section>

          <section className="account-section account-signout">
            <button type="button" className="btn ghost account-signout-btn" onClick={onSignOut}>
              Sign out
            </button>
          </section>
        </>
      )}

      {settingsTab === 'plan' && (
        <section
          ref={subscriptionRef}
          className={`account-section ${highlightSubscription ? 'account-section-highlight' : ''}`}
          id="subscription"
        >
          <div className={`account-plan ${pro ? 'pro' : 'free'}`}>
            <div className="account-plan-header">
              <span className="account-plan-name">{pro ? APP_NAME_PRO : 'Free plan'}</span>
              {pro && <span className="pro-badge">PRO</span>}
            </div>
            <p className="account-plan-detail">
              {pro
                ? signedIn
                  ? 'Unlimited wines, Stats, export, AI scan, no ads.'
                  : 'Unlimited wines, Stats, export, no ads on this device.'
                : `${wineCount} of ${FREE_WINE_LIMIT} wines · Stats & export on Pro`}
            </p>
            {!pro && signedIn && (
              <p className="account-hint">Subscribe to sync Pro across devices.</p>
            )}
            {!pro && !signedIn && <p className="account-hint">Sign in to subscribe.</p>}
          </div>

          {pro && canCheckout && (iosIap || profile?.hasBilling) && (
            <button
              type="button"
              className="btn ghost account-manage-billing"
              disabled={billingBusy}
              onClick={handleManageBilling}
            >
              {billingBusy
                ? 'Opening…'
                : iosIap
                  ? 'Manage in App Store'
                  : 'Manage subscription'}
            </button>
          )}

          {!pro && (
            <>
              <ul className="account-pro-features">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              {canCheckout && iosIap && iapSetupHint && (
                <p className="form-error">{iapSetupHint}</p>
              )}

              {canCheckout && iosIap ? (
                <>
                  <button
                    type="button"
                    className="btn primary account-upgrade"
                    disabled={checkoutBusy}
                    onClick={handleUpgrade}
                  >
                    {subscribeButtonLabel(checkoutBusy)}
                  </button>
                  <button
                    type="button"
                    className="link-btn account-restore"
                    disabled={restoreBusy}
                    onClick={handleRestorePurchases}
                  >
                    {restoreBusy ? 'Restoring…' : 'Restore purchases'}
                  </button>
                </>
              ) : canCheckout ? (
                <button
                  type="button"
                  className="btn primary account-upgrade"
                  disabled={checkoutBusy}
                  onClick={handleUpgrade}
                >
                  {subscribeButtonLabel(checkoutBusy)}
                </button>
              ) : PRO_CONFIG.paymentUrl ? (
                <a
                  className="btn primary account-upgrade"
                  href={PRO_CONFIG.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {subscribeButtonLabel(false)}
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

          {!signedIn && cloudConfigured && offlineMode && (
            <div className="account-cloud-cta account-cloud-cta-inset">
              <p>Sign in to sync Pro and your cellar across devices.</p>
              <button type="button" className="btn primary small" onClick={onSignIn}>
                Sign in or create account
              </button>
            </div>
          )}
        </section>
      )}

      {settingsTab === 'look' && (
        <>
          <section className="account-section">
            <h3>Theme</h3>
            <ThemePicker />
          </section>
          <section className="account-section">
            <h3>App icon</h3>
            <AppIconPicker />
          </section>
        </>
      )}

      {settingsTab === 'alerts' && profile && (
        <PushNotificationSettings
          userId={profile.id}
          signedIn={signedIn}
          cloudConfigured={cloudConfigured}
        />
      )}

      {settingsTab === 'ranking' && (
        <section className="account-section">
          <h3>Ranking style</h3>
          <div className="ranking-preference-list account-ranking-list">
            {RANKING_PREFERENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`ranking-preference-card ${rankingPreference === option.value ? 'active' : ''}`}
                disabled={rankingBusy}
                onClick={() => handleRankingPreferenceChange(option.value)}
              >
                <span className="ranking-preference-title">{option.title}</span>
                <span className="ranking-preference-desc">{option.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!signedIn && settingsTab === 'look' && cloudConfigured && offlineMode && (
        <section className="account-section account-cloud-cta">
          <h3>Cloud sync</h3>
          <p>Sign in to sync your cellar across devices and share ratings with friends.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            Sign in or create account
          </button>
        </section>
      )}

      {!cloudConfigured && settingsTab === 'plan' && (
        <section className="account-section account-cloud-cta">
          <h3>Cloud sync</h3>
          <p>Accounts and friends require Supabase configuration on this deployment.</p>
        </section>
      )}
    </div>
  )
}
