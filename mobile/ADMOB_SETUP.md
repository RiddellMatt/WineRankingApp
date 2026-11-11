# AdMob banner ads

Decanti shows an **adaptive bottom banner** on **iOS and Android** via `@capacitor-community/admob`.

- **Free users:** banners on by default (after sign-in, main app shell).
- **Pro users:** no banners unless you opt in for QA (below).

---

## How the app decides to show a banner

| Condition | Banner? |
| --------- | ------- |
| Mobile web / browser | No — native only |
| Auth / login screen | No |
| **Pro** subscriber | No (unless `VITE_ADMOB_SHOW_FOR_PRO=true`) |
| Free signed-in user, main app | Yes — if SDK init + consent allow |
| `VITE_ADMOB_TEST_MODE=false` but no `VITE_ADMOB_BANNER_*` | No — fails closed |

Flow: `startBannerAds()` → `AdMob.initialize()` → UMP consent → `showBanner()` with adaptive size. The native view sits **above** the WebView; `--banner-ad-height` pads your scrollable content.

---

## Test ads while you are Pro

Production policy is **no ads for Pro**. To verify banners on a Pro account (TestFlight / internal builds):

1. In `.env.local` (and Codemagic env for mobile builds), set:
   ```bash
   VITE_ADMOB_SHOW_FOR_PRO=true
   ```
2. Rebuild: `npm run build:mobile && npm run cap:sync` → new native build.

Leave this **unset** for App Store / Play releases you ship to paying subscribers.

With test mode default on, you still see **Google “Test Ad”** creatives — not your revenue yet.

---

## Walkthrough: revenue-generating ads

### 1. Google AdMob account

1. Go to [admob.google.com](https://admob.google.com/) and sign in with a Google account you control for payouts.
2. Complete **payments** profile (tax, bank / payment method). You must do this before you can be paid.
3. Accept AdMob terms.

### 2. Register the app (once per store)

In AdMob → **Apps** → **Add app**:

| Store    | Already published? | App name   | Package / bundle ID        |
| -------- | ------------------ | ---------- | -------------------------- |
| **iOS**  | Yes (TestFlight/App Store) | Decanti    | `com.northline.decanti`    |
| **Android** | Yes (Play / sideload) | Decanti    | `com.northline.decanti`    |

AdMob gives you an **App ID** per platform (format `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).  
This is **not** the same as a banner **ad unit** id.

### 3. Create banner ad units

For each app in AdMob:

1. **Ad units** → **Add ad unit** → **Banner**.
2. Name them e.g. `Decanti iOS banner` / `Decanti Android banner`.
3. Copy each **Ad unit ID** (`ca-app-pub-…/…`).

### 4. Wire App IDs into native projects

Replace the **Google sample** application IDs in the repo:

**Android** — `android/app/src/main/res/values/strings.xml`:

```xml
<string name="admob_app_id">ca-app-pub-YOUR_PUBLISHER~YOUR_ANDROID_APP_ID</string>
```

(`AndroidManifest.xml` already points at `@string/admob_app_id`.)

**iOS** — `ios/App/App/Info.plist`:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-YOUR_PUBLISHER~YOUR_IOS_APP_ID</string>
```

### 5. Wire ad unit IDs into the web build (Vite)

These are baked in at **build time** for mobile (`npm run build:mobile`).

**Local** — `.env.local`:

```bash
VITE_ADMOB_BANNER_IOS=ca-app-pub-xxxxxxxx/yyyyyyyyyy
VITE_ADMOB_BANNER_ANDROID=ca-app-pub-xxxxxxxx/zzzzzzzzzz
VITE_ADMOB_TEST_MODE=false
# VITE_ADMOB_SHOW_FOR_PRO=true   # QA only; omit for release
```

**Codemagic** — Team settings → Environment variables → group **`decanti_env`** (same group as Supabase in `codemagic.yaml`):

| Variable | Example | Secure? |
| -------- | ------- | ------- |
| `VITE_ADMOB_BANNER_IOS` | `ca-app-pub-1234567890123456/1111111111` | No (not secret) |
| `VITE_ADMOB_BANNER_ANDROID` | `ca-app-pub-1234567890123456/2222222222` | No |
| `VITE_ADMOB_TEST_MODE` | `false` when earning real revenue; omit or `true` for Google test ads | No |
| `VITE_ADMOB_SHOW_FOR_PRO` | `true` only while **you** test on Pro TestFlight; remove before public release | No |

Codemagic runs `npm run build:mobile`, which loads these via Vite at compile time — changing them requires a **new build**, not just a web deploy.

**Windows local Android debug:** copy the same keys into `.env.local`, then `npm run cap:sync` and run from Android Studio/emulator.

If `VITE_ADMOB_TEST_MODE=false` and a banner id is missing, the app **will not** request ads (by design).

### 6. iOS: SKAdNetwork + privacy

1. Open [AdMob iOS quick-start — Info.plist](https://developers.google.com/admob/ios/quick-start#update_your_infoplist).
2. Replace the minimal `SKAdNetworkItems` in `Info.plist` with Google’s **full** list (many entries). Required for proper attribution on iOS.
3. **App Store Connect** → your app → **App Privacy**: disclose that you use advertising data / third-party advertising as applicable (match what AdMob and your consent flow collect).
4. `NSUserTrackingUsageDescription` is already in `Info.plist`; wording should match your real use.

### 7. Consent (UMP) — required in EU/UK and similar

1. AdMob → **Privacy & messaging** → create **GDPR** message for your app(s).
2. Publish the message. The app calls `requestConsentInfo` / `showConsentForm` before loading ads.
3. Test in a region that triggers the form, or use [AdMob consent debugging](https://developers.google.com/admob/android/privacy/consent).

### 8. Build and ship

```bash
npm install
npm run cap:sync   # or npm run cap:sync in your CI after build:mobile
```

Then **new iOS TestFlight / Play** builds. Ads do not update via web-only deploy — native binary must include SDK + env at build time.

### 9. Confirm revenue path

| Check | What to expect |
| ----- | -------------- |
| AdMob dashboard | Impressions and estimated earnings lag (often hours). |
| Test ads | With `VITE_ADMOB_TEST_MODE` not `false` off and **test** units, you see “Test Ad” — **no** revenue. |
| Production | Real units + real app IDs + `VITE_ADMOB_TEST_MODE=false` → real impressions count toward pay. |
| Pro users | With `VITE_ADMOB_SHOW_FOR_PRO` unset, Pro never loads banners. |

### 10. Common pitfalls

- **`initialize()` before UMP consent** — request consent first, then `initialize()` + `showBanner()` (see `bannerAds.ts`).
- **Production unit, no fill** — new AdMob apps often show no banner until verified; leave `VITE_ADMOB_TEST_MODE` unset (Google test ads) until you see a banner, or use the app’s built-in test fallback when production fails.
- **iOS native tab bar** — banner must sit above the Capawesome `UITabBar` (z-order patch runs in `postinstall` / `cap:sync`).
- **`isTesting: true` on iOS** — the Capacitor AdMob plugin forces an Android test unit; use `isTesting: false` with the iOS Google demo ad unit id from `adConfig.ts`.
- Using **ad unit** id in `Info.plist` / `strings.xml` (must be **app** id).
- Shipping with Google’s **sample** app IDs in store builds.
- Forgetting to set env vars on **Codemagic** so release builds still use test logic or empty units.
- Linking AdMob app to wrong bundle id / package name.

---

## Layout note

The banner is a **native overlay** above the WebView. `bannerAds.ts` sets `--banner-ad-height` on `<html>` so scrollable content clears the ad and sits above the tab bar (native Liquid Glass tab bar on iOS).
