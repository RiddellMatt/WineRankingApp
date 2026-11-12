# Phase 1 — release candidate checklist (iOS)

Use this before each **App Store / TestFlight release candidate** build. Goal: no debug ad UI, correct env, Pro is ad-free.

## Codemagic `decanti_env` (release candidate)

| Variable | Release candidate | Internal QA |
| -------- | ----------------- | ------------- |
| `VITE_ADMOB_TEST_MODE` | `false` after AdMob verification | `true` or omit |
| `VITE_ADMOB_DEBUG_PROBE` | **unset** or `false` | `true` while debugging ads |
| `VITE_ADMOB_SHOW_FOR_PRO` | **unset** | optional `true` to test banners as Pro |

Production banner units default in `src/lib/adConfig.ts`. Info.plist app id is set by `scripts/configure-admob-ios-app-id.mjs` at build time.

## Build

1. Merge `main`, trigger **iOS TestFlight** workflow (or production workflow when you add one).
2. Confirm Codemagic log includes `[configure-admob-ios] GADApplicationIdentifier → …` with the expected app id (sample for test mode, Decanti for prod).
3. Install on a **free** account device: banner loads, scroll clears the ad, tab bar not covered.
4. Install on **Pro** account: no banner, no empty gutter (`--banner-ad-height` cleared).
5. Stats tab (free): **lock** on Stats, not “PRO”; Pro users: no lock, Stats content loads.

## Manual smoke (10 min)

- [ ] Sign in (Google / Apple)
- [ ] Add or edit a wine
- [ ] Open Stats as free → upgrade CTA; as Pro → insights charts
- [ ] Profile → Restore purchases (signed in)
- [ ] Privacy policy link opens
- [ ] Free: bottom banner (prod or test per env); Pro: no banner
- [ ] No `[test env=…]` probe strip on screen unless `VITE_ADMOB_DEBUG_PROBE=true`

## After AdMob verification

1. Set `VITE_ADMOB_TEST_MODE=false` on release builds.
2. Watch AdMob **Policy center** and first-day fill on a real device.
3. Keep probe **off** for any build you use for App Store screenshots.

## Related docs

- [ADMOB_SETUP.md](./ADMOB_SETUP.md)
- [DECANTI_ADMOB_IDS.md](./DECANTI_ADMOB_IDS.md)
- [STORE_RELEASE.md](./STORE_RELEASE.md)
