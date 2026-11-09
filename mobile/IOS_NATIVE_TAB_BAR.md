# iOS native tab bar (Liquid Glass)

Decanti uses **`@capawesome/capacitor-tab-bar`** on **iOS only**. It draws a real `UITabBar` above the WebView:

- **iOS 26+** — system Liquid Glass tab bar
- **Earlier iOS** — classic native translucent tab bar

Android and mobile web still use the HTML bottom nav in `App.tsx`.

## After pulling tab-bar changes

```bash
npm install
npm run cap:sync
```

Then build in **Codemagic** / Xcode. The plugin is wired via Swift Package Manager (`CapApp-SPM`).

## Behavior

- Tabs appear after the splash is dismissed (`SplashScreen.hide()`), not in `capacitor.config` `plugins.TabBar.tabs` (that would show tabs over the splash).
- Selection is synced both ways: native tap → React `view` state; in-app navigation → `TabBar.selectTabById`.
- On sign-in, the **Social** tab is added via `setTabs`.
- Auth screen hides the native bar until the main shell loads.

## Web content insets

`index.html` uses `viewport-fit=cover`. Content padding uses `env(safe-area-inset-bottom)` when `html.native-ios-tab-bar` is set — the plugin grows the bottom safe area to include the tab bar height.
