# Release candidate checklist (iOS)

Use this on the **TestFlight build you will submit**. Marketing version is 1.0. The archive is iPhone-only. Goal: the binary matches the privacy page, Pro is sold only through the App Store, and a reviewer can finish the new paths without leaving the app.

## Codemagic `decanti_env` (release candidate)

| Variable | Release candidate | Internal QA |
| -------- | ----------------- | ------------- |
| `VITE_ADMOB_TEST_MODE` | `false` after AdMob verification | `true` or omit |
| `VITE_ADMOB_DEBUG_PROBE` | **unset** or `false` | `true` while debugging ads |
| `VITE_ADMOB_SHOW_FOR_PRO` | **unset** | optional `true` to test banners as Pro |
| `VITE_ADMOB_PRODUCTION_TEST_FALLBACK` | **unset** | optional `true` to show Google test ads when prod has no fill |
| `VITE_REVENUECAT_IOS_API_KEY` | set | set |
| `VITE_IOS_PRO_PRODUCT_ID` | `decanti_pro_monthly` | `decanti_pro_monthly` |

Production banner units default in `src/lib/adConfig.ts`. Info.plist app id is set by `scripts/configure-admob-ios-app-id.mjs` at build time. Publish the AdMob Privacy & messaging GDPR form before this build so the consent path has a message to show. These values are set in the Codemagic dashboard, not in the repo.

## Build

1. Merge `main`, trigger **iOS TestFlight** workflow (or production workflow when you add one).
2. Confirm Codemagic log includes `[configure-admob-ios] GADApplicationIdentifier → …` with the expected app id (sample for test mode, Decanti for prod).
3. Install on a **free** account device: banner loads, scroll clears the ad, tab bar not covered.
4. Install on **Pro** account: no banner, no empty gutter (`--banner-ad-height` cleared).
5. Stats tab (free): **lock** on Stats, not “PRO”; Pro users: no lock, Stats content loads.

## Manual smoke

Record the build number. Walk this on that install.

- [ ] Sign in with Apple, and with Google on a second account
- [ ] Add or edit a wine
- [ ] Free account: Stats is locked. Pro account: Stats opens
- [ ] Subscribe shows **Decanti Pro**, **1 month, auto-renews**, the StoreKit price, and links to the privacy policy and terms. Both links open
- [ ] iPhone never opens a Stripe checkout for Pro. A build without the RevenueCat key says purchases are unavailable
- [ ] Sandbox purchase shows `[Environment: Sandbox]`, then Pro survives a force-quit. Restore on a second install of the same Apple ID unlocks Pro. `profiles.is_pro` is set. Cancel the sandbox subscription after
- [ ] On your own wine card, the globe asks you to confirm you are 21 or older before the first Wine-Searcher open. Not now stays in the app. A friend’s cellar has no globe. A favorited wine, a wishlist bottle, and a menu match also offer Find a bottle, and that first open uses the same 21+ check
- [ ] Report someone from their cellar or the activity feed and see the in-app confirmation. Block them and confirm they disappear. Unblock brings them back
- [ ] Settings → Edit profile → Delete account, typing DELETE, signs you out. That account cannot sign back into the same data
- [ ] Free: bottom banner, no `[test env=…]` probe strip. Pro: no banner and no empty gutter
- [ ] iOS does not show the App Tracking Transparency prompt

## App Store Connect, same build

- [ ] Paid Apps agreement is Active
- [ ] Privacy policy URL is `https://decantiwine.com/privacy.html`. The description includes working links to that page and `https://decantiwine.com/terms.html`
- [ ] App Privacy: account info, photos you supply, purchases, and advertising data. **Tracking = No**
- [ ] Age rating includes alcohol references (expect 17+). Screenshots are 6.7-inch iPhone only
- [ ] Review notes name a demo Decanti account and say Pro is Sandbox In-App Purchase, product `decanti_pro_monthly`

## After AdMob verification

1. Set `VITE_ADMOB_TEST_MODE=false` on release builds.
2. Watch AdMob **Policy center** and first-day fill on a real device.
3. Keep probe **off** for any build you use for App Store screenshots.

## Related docs

- [ADMOB_SETUP.md](./ADMOB_SETUP.md)
- [DECANTI_ADMOB_IDS.md](./DECANTI_ADMOB_IDS.md)
- [STORE_RELEASE.md](./STORE_RELEASE.md)
