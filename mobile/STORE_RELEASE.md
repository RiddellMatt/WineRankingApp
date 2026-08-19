# Cellar Rank — App Store & Play Store release path

Cellar Rank ships as a **native mobile app** (iOS + Android) using **Capacitor** to wrap the existing React UI. Supabase remains the backend.

## Prerequisites

| Tool | iOS | Android |
|------|-----|---------|
| Node.js 20+ | ✓ | ✓ |
| Xcode 15+ (optional) | ✓ | — |
| **Codemagic** (no Mac) | ✓ | optional |
| Apple Developer Program ($99/yr) | ✓ | — |
| Android Studio | — | ✓ |
| Google Play Console ($25 one-time) | — | ✓ |

> **No Mac?** Use `codemagic.yaml` + `mobile/CODEMAGIC_SETUP.md` for TestFlight builds from Windows.

## 1. Build the native shell

```bash
npm install
npm run cap:sync          # builds mobile bundle + copies to ios/ and android/
node scripts/configure-deeplinks.mjs
```

Open native IDEs:

```bash
npm run cap:ios           # opens Xcode
npm run cap:android       # opens Android Studio
```

Run on simulator/device from the IDE, or:

```bash
npx cap run ios
npx cap run android
```

## 2. Environment variables

Create `.env` in the project root (used at Vite build time):

```env
VITE_SUPABASE_URL=https://wqkllahjpusemdpznxfb.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Rebuild after changing env: `npm run cap:sync`.

## 3. Supabase Auth (Google + Apple)

**Authentication → URL Configuration → Redirect URLs** — add:

```
com.northline.cellarrank://login-callback
```

Enable **Google** and **Apple** providers in Supabase (same as web OAuth setup).

Run **section 5** of `supabase/run-in-sql-editor.sql` so OAuth names/avatars seed profiles.

## 4. Stripe return URLs (mobile)

In **Supabase → Edge Functions → Secrets**, set (optional — defaults match app scheme):

```
MOBILE_APP_SCHEME=com.northline.cellarrank
```

Redeploy checkout functions after pulling this branch:

```bash
npx supabase functions deploy create-pro-checkout
npx supabase functions deploy create-billing-portal
```

The mobile app passes `platform: "mobile"` so Stripe redirects back to:

- `com.northline.cellarrank://checkout-success`
- `com.northline.cellarrank://account` (billing portal)

> **App Store note:** Apple expects In-App Purchase for digital subscriptions consumed in the app. Stripe checkout works for testing and Android interim; plan **RevenueCat / StoreKit** before iOS App Store submission.

## 5. App icons & splash

Source icon: `scripts/icon-source.svg`

Generate store assets (optional):

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#16090d' --splashBackgroundColor '#16090d'
npm run cap:sync
```

## 6. iOS App Store checklist

1. **Xcode → App target → Signing & Capabilities**
   - Team: your Apple Developer team
   - Bundle ID: `com.northline.cellarrank` (must match `capacitor.config.ts`)
   - Enable **Sign in with Apple** capability (required when offering Google sign-in)
2. **Info.plist** — URL scheme added by `scripts/configure-deeplinks.mjs`
3. **Privacy**
   - Camera/photo usage strings if using label/menu scan (add to Info.plist when enabling native camera)
   - Privacy policy URL (required for Sign in with Apple + App Store)
4. **App Store Connect**
   - Create app record, screenshots (6.7", 6.5", iPad if supporting tablets)
   - Age rating questionnaire
   - Export compliance (typically "No" for HTTPS-only encryption)
5. **Build & upload**
   - **Cloud (recommended, no Mac):** `mobile/CODEMAGIC_SETUP.md` — push to `main`, Codemagic uploads to TestFlight
   - **Local Mac:** Xcode → Product → Archive → Distribute → App Store Connect
6. **TestFlight** → internal testing → submit for review

## 7. Google Play checklist

1. **Android Studio → Build → Generate Signed Bundle/APK** (AAB for Play)
2. Create keystore (store securely — required for all future updates)
3. **Play Console**
   - Create app, complete store listing
   - Data safety form (account data, photos if camera used)
   - Content rating questionnaire
   - Upload AAB to internal testing track
4. Deep link scheme patched in `AndroidManifest.xml` by configure script

## 8. Suggested release order

1. ✓ Capacitor shell + deep links (this PR)
2. Test auth (Google/Apple) on device simulators
3. Test Stripe Pro flow on Android (Stripe allowed)
4. Implement **RevenueCat** for iOS IAP before App Store submission
5. TestFlight / Play internal test → production

## Bundle identifiers

| Platform | ID |
|----------|-----|
| iOS / Android | `com.northline.cellarrank` |
| URL scheme | `com.northline.cellarrank://` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Invalid API key** on Google sign-in | This is the **Supabase anon key** baked into the app at build time — not your Google OAuth client. In Supabase → **Project Settings → API**, copy the **anon public** key into `.env.local` on your dev machine, then run `npm run cap:sync` and rebuild in Android Studio. |
| Cloud sync disabled | Same as above — env vars must exist before `npm run build:mobile`. |
| Google redirect error | Add `com.northline.cellarrank://login-callback` to Supabase redirect URLs (see `mobile/SAFARI_TESTING.md`). |
