/** Shorter, actionable copy for common RevenueCat / StoreKit setup mistakes. */
export function friendlyRevenueCatError(error: unknown): string {
  const raw = String((error as Error)?.message ?? error ?? 'Purchase failed.')
  const lower = raw.toLowerCase()

  if (
    lower.includes('no app store products') ||
    lower.includes('offerings-empty') ||
    lower.includes('why-are-offerings-empty')
  ) {
    return (
      'RevenueCat offerings are not loading App Store products. Check: (1) Product catalog → decanti_pro_monthly is ' +
      'App Store, not Test Store only. (2) Offerings → default is Current; Monthly uses that product; remove Yearly/Lifetime ' +
      'packages if they have no App Store product. (3) Apps → iOS → valid In-App Purchase key. (4) Codemagic uses the appl_… ' +
      'key for this iOS app. (5) App Store Connect subscription is Ready to Submit, not stuck Waiting for Review.'
    )
  }

  if (lower.includes('no subscription offering') || lower.includes('offering is available')) {
    return (
      'No current RevenueCat offering. Mark your default offering as Current and attach a monthly App Store product.'
    )
  }

  if (lower.includes('no subscription package') || lower.includes('check revenuecat offerings')) {
    return 'The current offering has no monthly package. Add a Monthly package in RevenueCat → Offerings → default.'
  }

  if (lower.includes('not configured on this build')) {
    return 'In-app purchases are not in this build. Install the latest TestFlight build after Codemagic has VITE_REVENUECAT_IOS_API_KEY set.'
  }

  if (lower.includes('pro is not active') || lower.includes('restore purchases')) {
    return (
      'Purchase finished but Pro did not unlock. In RevenueCat, confirm entitlement id matches the app (pro or set ' +
      'VITE_REVENUECAT_ENTITLEMENT_ID) and the product grants that entitlement.'
    )
  }

  if (raw.length > 280) {
    const firstLine = raw.split('\n')[0]?.trim()
    return firstLine && firstLine.length < 280 ? firstLine : 'Subscription failed. Check RevenueCat offerings and App Store product metadata.'
  }

  return raw
}
