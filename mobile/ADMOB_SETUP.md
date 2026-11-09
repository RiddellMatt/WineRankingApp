# AdMob banner ads (free tier)

Decanti shows an **adaptive bottom banner** on **iOS and Android** for **non‑Pro** users via `@capacitor-community/admob`. **Pro** subscribers never load ads.

## Before production

1. Create an [AdMob](https://admob.google.com/) app for **iOS** and **Android** (bundle `com.northline.decanti`).
2. Create **Banner** ad units for each platform.
3. Replace **Google sample app IDs** (currently in `Info.plist` and `strings.xml`) with your real **application** IDs.
4. Add production ad unit IDs to Codemagic / `.env.local`:
   - `VITE_ADMOB_BANNER_IOS=ca-app-pub-…`
   - `VITE_ADMOB_BANNER_ANDROID=ca-app-pub-…`
   - `VITE_ADMOB_TEST_MODE=false`
5. Copy the full **SKAdNetworkItems** list from [Google’s iOS AdMob setup](https://developers.google.com/admob/ios/quick-start#update_your_infoplist) into `Info.plist` (required for attribution).
6. Rebuild native apps: `npm run cap:sync` and ship new store builds.

## Development / TestFlight

Defaults use **Google test app + ad unit IDs** while `VITE_ADMOB_TEST_MODE` is not `false` (default). Safe for internal testing; do not ship store release with sample app IDs.

## Privacy

- UMP **consent** flow runs before the first ad request (EU / required regions).
- iOS **App Tracking Transparency** string is in `Info.plist` (`NSUserTrackingUsageDescription`).

## Layout

The banner is a **native overlay** above the WebView. `bannerAds.ts` sets `--banner-ad-height` and `show-banner-ad` on `<html>` so scrollable content clears the ad and sits above the tab bar (native Liquid Glass tab bar on iOS).
