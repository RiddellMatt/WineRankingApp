import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { deleteMyAccount } from '../lib/deleteAccount'
import { nativePlatform } from '../lib/platform'
import { purchasePath } from '../lib/purchasePath'
import { redeemProOnServer } from '../lib/proApi'
import { updateDisplayName, uploadAvatar, removeAvatar, type UserProfile } from '../lib/profileDb'
import type { RankingPreference } from '../types'
import { applyAppIcon, loadStoredAppIcon, type AppIconVariant } from '../lib/appIcon'
import { applyTheme, loadStoredTheme, previewTheme, type AppTheme } from '../lib/themes'
import { RankingPreferencePicker } from './RankingPreferencePicker'
import { RatingTips } from './RatingTips'
import { APP_NAME_PRO } from '../brand'
import { referralProNote } from '../lib/referrals'
import { Avatar } from './Avatar'
import { AppIconPicker } from './AppIconPicker'
import { ThemePicker } from './ThemePicker'
import { PushNotificationSettings } from './PushNotificationSettings'
import { SettingsCommitBar } from './SettingsCommitBar'
import { SettingsMenu, type SettingsGroupId } from './SettingsMenu'
import { LegalDocLink } from './LegalDocLink'
import type { AccountSettingsSection } from './accountSettings'

const PRO_FEATURES = [
  'Unlimited wines',
  'Stats dashboard',
  'Export & import cellar',
  'AI menu & label scan',
] as const

interface Props {
  profile: UserProfile | null
  email?: string
  signedIn: boolean
  offlineMode: boolean
  cloudConfigured: boolean
  pro: boolean
  wineCount: number
  rankingPreference: RankingPreference
  onRankingPreferenceSaved: (preference: RankingPreference) => Promise<void>
  highlightSubscription?: boolean
  onProfileSaved: (profile: UserProfile) => void
  /** After StoreKit/RevenueCat unlock; keeps Pro in UI when Supabase sync is still catching up. */
  onProUnlocked: (opts?: { fromNativeIap?: boolean }) => void
  onSignOut: () => void
  onSignIn: () => void
  settingsSection: AccountSettingsSection
  onSettingsSectionChange: (section: AccountSettingsSection) => void
  onBack?: () => void
  backLabel?: string
  onReplayGuide?: () => void
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
  onRankingPreferenceSaved,
  highlightSubscription = false,
  onProfileSaved,
  onProUnlocked,
  onSignOut,
  onSignIn,
  settingsSection,
  onSettingsSectionChange,
  onBack,
  backLabel = '← Back',
  onReplayGuide,
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
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const iosIap = isIosStoreKitConfigured()
  const path = purchasePath(nativePlatform(), iosIap)
  const inviteProNote = referralProNote({
    isPro: profile?.isPro,
    proUntil: profile?.proUntil,
    bonusProDays: profile?.bonusProDays,
  })
  const referralOnly = Boolean(pro && profile && !profile.isPro)
  const [iapPriceLabel, setIapPriceLabel] = useState<string | null>(null)
  const [iapSetupHint, setIapSetupHint] = useState<string | null>(null)
  const [iapPreviewLoaded, setIapPreviewLoaded] = useState(false)

  const [draftRanking, setDraftRanking] = useState(rankingPreference)
  const [rankingBusy, setRankingBusy] = useState(false)
  const [rankingError, setRankingError] = useState('')
  const [rankingSaved, setRankingSaved] = useState(false)
  const rankingSaveLock = useRef(false)

  const [openSettingsGroups, setOpenSettingsGroups] = useState<SettingsGroupId[]>([])
  const [savedTheme, setSavedTheme] = useState<AppTheme>(() => loadStoredTheme())
  const [draftTheme, setDraftTheme] = useState<AppTheme>(() => loadStoredTheme())
  const [savedIcon, setSavedIcon] = useState<AppIconVariant>(() => loadStoredAppIcon())
  const [draftIcon, setDraftIcon] = useState<AppIconVariant>(() => loadStoredAppIcon())
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const [appearanceError, setAppearanceError] = useState('')
  const [appearanceSaved, setAppearanceSaved] = useState(false)
  const appearanceSaveLock = useRef(false)
  const savedThemeRef = useRef(savedTheme)
  const savedIconRef = useRef(savedIcon)
  savedThemeRef.current = savedTheme
  savedIconRef.current = savedIcon
  const priceShown = iapPriceLabel ?? PRO_CONFIG.priceLabel

  function subscribeButtonLabel(busy: boolean): string {
    if (busy) return iosIap ? 'Processing…' : 'Starting checkout…'
    if (iapPriceLabel) return `Subscribe — ${iapPriceLabel}`
    if (iosIap && iapPreviewLoaded) return 'Subscribe to Pro'
    return `Subscribe — ${PRO_CONFIG.priceLabel}`
  }
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

  useEffect(() => {
    if (highlightSubscription) onSettingsSectionChange('subscription')
  }, [highlightSubscription, onSettingsSectionChange])

  useEffect(() => {
    setDraftRanking(rankingPreference)
  }, [rankingPreference])

  useEffect(() => {
    if (settingsSection === 'ranking') return
    setDraftRanking(rankingPreference)
    setRankingError('')
    setRankingSaved(false)
  }, [settingsSection, rankingPreference])

  useEffect(() => {
    if (settingsSection === 'appearance') return
    setDraftTheme(savedThemeRef.current)
    setDraftIcon(savedIconRef.current)
    previewTheme(savedThemeRef.current)
    setAppearanceError('')
    setAppearanceSaved(false)
  }, [settingsSection])

  useEffect(() => {
    return () => {
      previewTheme(loadStoredTheme())
    }
  }, [])

  function chooseRanking(preference: RankingPreference) {
    setDraftRanking(preference)
    setRankingError('')
    setRankingSaved(false)
  }

  function cancelRanking() {
    setDraftRanking(rankingPreference)
    setRankingError('')
    setRankingSaved(false)
  }

  async function saveRanking() {
    if (draftRanking === rankingPreference || rankingSaveLock.current) return
    rankingSaveLock.current = true
    setRankingError('')
    setRankingSaved(false)
    setRankingBusy(true)
    try {
      await onRankingPreferenceSaved(draftRanking)
      setRankingSaved(true)
    } catch (err) {
      setRankingError(String((err as Error).message ?? err))
    } finally {
      rankingSaveLock.current = false
      setRankingBusy(false)
    }
  }

  function chooseTheme(next: AppTheme) {
    setDraftTheme(next)
    setAppearanceError('')
    setAppearanceSaved(false)
    previewTheme(next)
  }

  function applyMenuTheme(next: AppTheme) {
    setDraftTheme(next)
    setSavedTheme(next)
    setAppearanceError('')
    setAppearanceSaved(false)
    applyTheme(next)
  }

  function chooseIcon(next: AppIconVariant) {
    setDraftIcon(next)
    setAppearanceError('')
    setAppearanceSaved(false)
  }

  function cancelAppearance() {
    setDraftTheme(savedTheme)
    setDraftIcon(savedIcon)
    previewTheme(savedTheme)
    setAppearanceError('')
    setAppearanceSaved(false)
  }

  async function saveAppearance() {
    const themeChanged = draftTheme !== savedTheme
    const iconChanged = draftIcon !== savedIcon
    if ((!themeChanged && !iconChanged) || appearanceSaveLock.current) return
    appearanceSaveLock.current = true
    setAppearanceError('')
    setAppearanceSaved(false)
    setAppearanceBusy(true)
    try {
      if (themeChanged) applyTheme(draftTheme)
      if (iconChanged) await applyAppIcon(draftIcon)
      setSavedTheme(draftTheme)
      setSavedIcon(draftIcon)
      setAppearanceSaved(true)
    } catch (err) {
      setAppearanceError(String((err as Error).message ?? err))
      previewTheme(savedTheme)
    } finally {
      appearanceSaveLock.current = false
      setAppearanceBusy(false)
    }
  }

  const rankingDirty = draftRanking !== rankingPreference
  const appearanceDirty = draftTheme !== savedTheme || draftIcon !== savedIcon

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
    if (path === 'unavailable') {
      setCodeError('Purchases are unavailable in this build.')
      return
    }
    setCheckoutBusy(true)
    try {
      if (path === 'storekit') {
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

  async function handleManageBilling(report: (message: string) => void = setCodeError) {
    report('')
    setBillingBusy(true)
    try {
      if (iosIap) {
        await openAppleSubscriptionManagement()
        return
      }
      const url = await createBillingPortal()
      await openExternalUrl(url)
    } catch (err) {
      report(String((err as Error).message ?? err))
    } finally {
      setBillingBusy(false)
    }
  }

  function resetDeleteConfirm() {
    setDeleteArmed(false)
    setDeleteConfirm('')
    setDeleteError('')
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault()
    if (deleteConfirm !== 'DELETE' || deleteBusy) return
    setDeleteError('')
    setDeleteBusy(true)
    try {
      await deleteMyAccount()
      await onSignOut()
    } catch (err) {
      setDeleteError(String((err as Error).message ?? err))
      setDeleteBusy(false)
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
      {onBack && (
        <div className="account-settings-toolbar">
          <button type="button" className="btn ghost friend-back" onClick={onBack}>
            {backLabel}
          </button>
        </div>
      )}

      {signedIn && (profileInfo || profileError) && (
        <div className="account-flash">
          {profileInfo && <p className="auth-info">{profileInfo}</p>}
          {profileError && <p className="form-error">{profileError}</p>}
        </div>
      )}

      {settingsSection === 'menu' && (
        <SettingsMenu
          signedIn={signedIn}
          pro={pro}
          cloudConfigured={cloudConfigured}
          theme={savedTheme}
          openGroups={openSettingsGroups}
          onOpenGroupsChange={setOpenSettingsGroups}
          onSelect={(section) => onSettingsSectionChange(section)}
          onThemeChange={applyMenuTheme}
          onSignOut={signedIn ? onSignOut : undefined}
          onSignIn={!signedIn && cloudConfigured ? onSignIn : undefined}
          onReplayGuide={onReplayGuide}
        />
      )}

      {settingsSection === 'profile' && signedIn && (
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
                  enterKeyHint="done"
                  autoComplete="nickname"
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

          <section className="account-section account-delete" id="delete-account">
            <h3>Delete account</h3>
            <p id="delete-account-help">
              This permanently removes your cellar, photos, and sign-in from Decanti. An App Store
              or Google Play subscription keeps billing until you cancel it with that store.
            </p>
            {iosIap ? (
              <button
                type="button"
                className="btn ghost account-manage-billing"
                disabled={billingBusy || deleteBusy}
                onClick={() => void handleManageBilling(setDeleteError)}
              >
                {billingBusy ? 'Opening…' : 'Manage in App Store'}
              </button>
            ) : profile?.hasBilling ? (
              <button
                type="button"
                className="btn ghost account-manage-billing"
                disabled={billingBusy || deleteBusy}
                onClick={() => void handleManageBilling(setDeleteError)}
              >
                {billingBusy ? 'Opening…' : 'Manage subscription'}
              </button>
            ) : null}
            {deleteArmed ? (
              <form className="account-delete-form" onSubmit={handleDeleteAccount}>
                <label className="field">
                  <span>Type DELETE to confirm</span>
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-describedby="delete-account-help"
                    disabled={deleteBusy}
                  />
                </label>
                <div className="account-delete-actions">
                  <button
                    type="submit"
                    className="btn danger"
                    disabled={deleteConfirm !== 'DELETE' || deleteBusy}
                  >
                    {deleteBusy ? 'Deleting…' : 'Delete account'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={deleteBusy}
                    onClick={resetDeleteConfirm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setDeleteError('')
                  setDeleteArmed(true)
                }}
              >
                Delete account
              </button>
            )}
            {deleteError && <p className="form-error">{deleteError}</p>}
          </section>
        </>
      )}

      {settingsSection === 'subscription' && (
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
              {referralOnly && inviteProNote
                ? inviteProNote
                : pro
                  ? signedIn
                    ? 'Unlimited wines, Stats, export, AI scan, no ads.'
                    : 'Unlimited wines, Stats, export, no ads on this device.'
                  : `${wineCount} of ${FREE_WINE_LIMIT} wines · Stats & export on Pro`}
            </p>
            {pro && !referralOnly && inviteProNote && (
              <p className="account-hint">{inviteProNote}</p>
            )}
            {!pro && signedIn && (
              <p className="account-hint">Subscribe to sync Pro across devices.</p>
            )}
            {!pro && !signedIn && <p className="account-hint">Sign in to subscribe.</p>}
          </div>

          {pro && !referralOnly && canCheckout && (iosIap || profile?.hasBilling) && (
            <button
              type="button"
              className="btn ghost account-manage-billing"
              disabled={billingBusy}
              onClick={() => void handleManageBilling()}
            >
              {billingBusy
                ? 'Opening…'
                : iosIap
                  ? 'Manage in App Store'
                  : 'Manage subscription'}
            </button>
          )}

          {pro && !referralOnly && (
            <p className="account-legal-links">
              <LegalDocLink file="privacy.html">Privacy policy</LegalDocLink>
              <LegalDocLink file="terms.html">Terms of use</LegalDocLink>
            </p>
          )}

          {(!pro || referralOnly) && (
            <>
              <ul className="account-pro-features">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <p className="account-subscription-legal">
                {APP_NAME_PRO} · 1 month, auto-renews · {priceShown}
              </p>
              <p className="account-legal-links">
                <LegalDocLink file="privacy.html">Privacy policy</LegalDocLink>
                <LegalDocLink file="terms.html">Terms of use</LegalDocLink>
              </p>

              {canCheckout && iosIap && iapSetupHint && (
                <p className="form-error">{iapSetupHint}</p>
              )}

              {path === 'unavailable' ? (
                <p className="account-hint">Purchases are unavailable in this build.</p>
              ) : path === 'storekit' && canCheckout ? (
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
              ) : path === 'external' && canCheckout ? (
                <button
                  type="button"
                  className="btn primary account-upgrade"
                  disabled={checkoutBusy}
                  onClick={handleUpgrade}
                >
                  {subscribeButtonLabel(checkoutBusy)}
                </button>
              ) : path === 'external' && PRO_CONFIG.paymentUrl ? (
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

      {settingsSection === 'appearance' && (
        <>
          <SettingsCommitBar
            className="settings-commit-leading"
            hint="The theme previews right away. Save changes keeps the theme and icon."
            dirty={appearanceDirty}
            busy={appearanceBusy}
            saved={appearanceSaved}
            error={appearanceError}
            onSave={() => void saveAppearance()}
            onCancel={cancelAppearance}
          />
          <section className="account-section">
            <h3>Theme</h3>
            <ThemePicker theme={draftTheme} disabled={appearanceBusy} onChange={chooseTheme} />
          </section>
          <section className="account-section">
            <h3>App icon</h3>
            <AppIconPicker icon={draftIcon} disabled={appearanceBusy} onChange={chooseIcon} />
          </section>
        </>
      )}

      {settingsSection === 'notifications' && profile && (
        <PushNotificationSettings
          userId={profile.id}
          signedIn={signedIn}
          cloudConfigured={cloudConfigured}
        />
      )}

      {settingsSection === 'rating-tips' && <RatingTips />}

      {settingsSection === 'ranking' && (
        <RankingPreferencePicker
          value={draftRanking}
          onChange={chooseRanking}
          disabled={rankingBusy}
        >
          <SettingsCommitBar
            hint="Save changes to update how your wines are scored."
            dirty={rankingDirty}
            busy={rankingBusy}
            saved={rankingSaved}
            error={rankingError}
            onSave={() => void saveRanking()}
            onCancel={cancelRanking}
          />
        </RankingPreferencePicker>
      )}

      {!signedIn && settingsSection === 'appearance' && cloudConfigured && offlineMode && (
        <section className="account-section account-cloud-cta">
          <h3>Cloud sync</h3>
          <p>Sign in to sync your cellar across devices and share ratings with friends.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            Sign in or create account
          </button>
        </section>
      )}

      {!cloudConfigured && settingsSection === 'subscription' && (
        <section className="account-section account-cloud-cta">
          <h3>Cloud sync</h3>
          <p>Accounts and friends require Supabase configuration on this deployment.</p>
        </section>
      )}
    </div>
  )
}
