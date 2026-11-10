# Decanti AdMob IDs (production)

Use these when wiring **Phase D–E** in `mobile/ADMOB_SETUP.md`.

| Role | iOS | Android |
| ---- | --- | ------- |
| **App ID** (`~`) | `ca-app-pub-5228268438882570~1709768455` | `ca-app-pub-5228268438882570~8788070289` |
| **Banner unit** (`/`) | `ca-app-pub-5228268438882570/1899228305` | `ca-app-pub-5228268438882570/1149253411` |

**Already in the repo (after merge):**

- iOS app ID → `ios/App/App/Info.plist` (`GADApplicationIdentifier`)
- Android app ID → `android/app/src/main/res/values/strings.xml` (`admob_app_id`)
- Banner units → `src/lib/adConfig.ts` (used when `VITE_ADMOB_TEST_MODE=false`)

## Codemagic group `decanti_env`

Add for **real** ads (not Google test labels):

```text
VITE_ADMOB_TEST_MODE=false
```

Optional overrides (normally omit — defaults match the table above):

```text
VITE_ADMOB_BANNER_IOS=ca-app-pub-5228268438882570/1899228305
VITE_ADMOB_BANNER_ANDROID=ca-app-pub-5228268438882570/1149253411
```

For **Pro QA** while testing banners:

```text
VITE_ADMOB_SHOW_FOR_PRO=true
```

Then trigger a new iOS/Android build (`npm run build:mobile` in CI).
