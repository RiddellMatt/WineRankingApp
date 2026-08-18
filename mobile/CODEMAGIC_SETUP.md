# Codemagic — iOS TestFlight without a Mac

Cellar Rank uses **Codemagic** cloud Mac builders to produce signed iOS IPAs and upload them to **TestFlight**. You can develop on Windows/Android Studio and still ship to the App Store.

Android Play Store builds are optional in the same `codemagic.yaml` (second workflow).

## What you need

| Item | Cost | Purpose |
|------|------|---------|
| [Apple Developer Program](https://developer.apple.com/programs/) | $99/yr | App Store + TestFlight |
| [Codemagic account](https://codemagic.io/) | Free tier available | Cloud Mac CI |
| App Store Connect app record | — | Bundle ID `com.northline.cellarrank` |

> **Before App Store review:** Apple expects **In-App Purchase** for digital subscriptions in iOS apps. Stripe Pro is fine for Android testing; plan RevenueCat/StoreKit before iOS production submission.

## 1. Apple Developer + App Store Connect

1. Enroll in the Apple Developer Program.
2. **Certificates, Identifiers & Profiles → Identifiers** — register App ID `com.northline.cellarrank`.
3. Enable **Sign in with Apple** on the App ID (required when offering Google sign-in).
4. **App Store Connect → Apps → +** — create **Cellar Rank** with bundle ID `com.northline.cellarrank`.
5. Note the numeric **Apple ID** (General → App Information). Update `APP_STORE_APPLE_ID` in `codemagic.yaml`.
6. **TestFlight → Internal Testing** — create a group named **Internal Testers** (matches `beta_groups` in `codemagic.yaml`).

## 2. App Store Connect API key (for Codemagic)

1. App Store Connect → **Users and Access → Integrations → App Store Connect API**.
2. Generate a key with **App Manager** access. Download the `.p8` file once.
3. Save **Issuer ID**, **Key ID**, and the `.p8` file.

## 3. Connect the repo to Codemagic

1. Codemagic → **Add application** → connect `RiddellMatt/WineRankingApp`.
2. Codemagic detects `codemagic.yaml` on the default branch after merge.

## 4. Codemagic Team settings

### App Store Connect integration

Team settings → **Team integrations → Developer Portal → Manage keys**:

| Field | Value |
|-------|--------|
| Key name | `cellar_rank_asc` (must match `codemagic.yaml`) |
| Issuer ID | from App Store Connect |
| Key ID | from App Store Connect |
| .p8 file | downloaded API key |

### iOS code signing (automatic)

Team settings → **codemagic.yaml settings → Code signing identities**:

1. **iOS certificates** → **Generate certificate** → type **Apple Distribution**, API key `cellar_rank_asc`.
2. **iOS provisioning profiles** → **Fetch profiles** → select **App Store** profile for `com.northline.cellarrank`.

Codemagic matches `distribution_type: app_store` and `bundle_identifier` from `codemagic.yaml` — no manual profile references needed in the YAML.

### Environment variable group: `cellar_rank_env`

Team settings → **Environment variables** → group `cellar_rank_env`:

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://wqkllahjpusemdpznxfb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |

Mark both as **Secure**.

### Supabase redirect URL (native app)

Dashboard → **Authentication → URL Configuration** — ensure this is listed:

```
com.northline.cellarrank://login-callback
```

## 5. First iOS build

1. Merge `codemagic.yaml` to `main` (or start the workflow manually from Codemagic).
2. Open the **iOS TestFlight** workflow → **Start new build**.
3. On success, the IPA uploads to App Store Connect → **TestFlight**.
4. Add yourself as an internal tester in App Store Connect → install via the TestFlight app on iPhone.

Test **Continue with Google** on the TestFlight build (uses the native deep link, not GitHub Pages).

## 6. Optional — Android Play internal track

Only needed if you want Codemagic to upload AABs (you can also build locally in Android Studio).

1. Create a Play Console app with package `com.northline.cellarrank`.
2. Create a Google Cloud service account with Play Console API access; download JSON credentials.
3. Codemagic → environment group `google_play` → variable `GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS` (paste JSON, secure).
4. Generate/upload a release keystore under **Code signing identities → Android keystores**, reference name `cellar_rank_keystore`.

Then run the **Android Play internal track** workflow.

## 7. Recommended release order

1. **Now:** Merge Safari testing PR → iPhone testers use GitHub Pages (`mobile/SAFARI_TESTING.md`).
2. **Next:** Complete this Codemagic setup → TestFlight internal builds.
3. **Before App Store:** RevenueCat / StoreKit for Pro on iOS.
4. **Android:** Play internal testing (local Android Studio or Codemagic workflow).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails at signing | Regenerate/fetch Distribution cert + App Store profile in Codemagic |
| `get-latest-app-store-build-number` fails | Set correct `APP_STORE_APPLE_ID` in `codemagic.yaml` |
| Google sign-in fails on TestFlight | Confirm Supabase redirect URL + Google OAuth test users |
| Blank app / no backend | Check `cellar_rank_env` group has both `VITE_*` variables |
| Stripe Pro on iOS | Works for testing; replace with IAP before App Store review |

See also: `mobile/STORE_RELEASE.md`, `mobile/SAFARI_TESTING.md`.
