#!/usr/bin/env node
/**
 * iOS AdMob patches for Decanti (native tab bar + Capacitor bridge).
 * Re-applied on npm install / cap:sync — do not edit node_modules by hand.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const admobRoot = resolve(import.meta.dirname, '../node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin')
const bannerFile = resolve(admobRoot, 'Banner/BannerExecutor.swift')
const pluginFile = resolve(admobRoot, 'AdMobPlugin.swift')

function patchBannerZOrder() {
  if (!existsSync(bannerFile)) return
  const marker = 'bringSubviewToFront(bannerView)'
  let source = readFileSync(bannerFile, 'utf8')
  if (source.includes(marker)) return

  const target =
    '            rootViewController.view.addConstraints(\n                [NSLayoutConstraint(item: bannerView,'
  const replacement =
    '            rootViewController.view.bringSubviewToFront(bannerView)\n            rootViewController.view.addConstraints(\n                [NSLayoutConstraint(item: bannerView,'

  if (!source.includes(target)) {
    console.warn('[patch-admob-ios] BannerExecutor.swift layout changed; skipping z-order patch')
    return
  }
  source = source.replace(target, replacement)
  writeFileSync(bannerFile, source)
  console.log('[patch-admob-ios] Applied banner z-order patch')
}

function patchGetRootVC() {
  if (!existsSync(pluginFile)) return
  const marker = 'bridge?.viewController'
  let source = readFileSync(pluginFile, 'utf8')
  if (source.includes(marker)) return

  const target = '    func getRootVC() -> UIViewController? {\n        var window: UIWindow?'
  const replacement =
    '    func getRootVC() -> UIViewController? {\n        if let vc = bridge?.viewController {\n            return vc\n        }\n        var window: UIWindow?'

  if (!source.includes(target)) {
    console.warn('[patch-admob-ios] getRootVC layout changed; skipping bridge patch')
    return
  }
  source = source.replace(target, replacement)
  writeFileSync(pluginFile, source)
  console.log('[patch-admob-ios] Applied Capacitor bridge viewController patch')
}

function patchBannerDefaultTestUnit() {
  if (!existsSync(pluginFile)) return
  let source = readFileSync(pluginFile, 'utf8')
  const androidDefault = 'getAdId(call, "ca-app-pub-3940256099942544/6300978111")'
  const iosDefault = 'getAdId(call, "ca-app-pub-3940256089942544/2934735716")'
  if (!source.includes(androidDefault) || source.includes(iosDefault)) return
  source = source.replace(androidDefault, iosDefault)
  writeFileSync(pluginFile, source)
  console.log('[patch-admob-ios] Applied iOS banner test unit default')
}

function patchBannerReceiveAdSizing() {
  if (!existsSync(bannerFile)) return
  const marker = 'bannerView.layoutIfNeeded()'
  let source = readFileSync(bannerFile, 'utf8')
  if (source.includes(marker)) return

  const target = `        NSLog("bannerViewDidReceiveAd")
        if let rootViewController = plugin?.getRootVC() {
            rootViewController.view.addSubview(bannerView)`
  const replacement = `        NSLog("bannerViewDidReceiveAd")
        guard let rootViewController = plugin?.getRootVC() else {
            NSLog("AdMob: getRootVC nil in bannerViewDidReceiveAd")
            return
        }
        rootViewController.view.addSubview(bannerView)`
  if (!source.includes(target)) {
    console.warn('[patch-admob-ios] bannerViewDidReceiveAd layout changed; skipping sizing patch')
    return
  }
  source = source.replace(target, replacement)

  const sizeTarget = `            self.plugin?.notifyListeners(BannerAdPluginEvents.SizeChanged.rawValue, data: [
                "width": bannerView.frame.width,
                "height": bannerView.frame.height
            ])`
  const sizeReplacement = `            bannerView.layoutIfNeeded()
            let h = max(bannerView.frame.size.height, bannerView.bounds.size.height)
            let w = max(bannerView.frame.size.width, bannerView.bounds.size.width)
            self.plugin?.notifyListeners(BannerAdPluginEvents.SizeChanged.rawValue, data: [
                "width": w,
                "height": h
            ])`
  if (source.includes(sizeTarget)) {
    source = source.replace(sizeTarget, sizeReplacement)
  }

  writeFileSync(bannerFile, source)
  console.log('[patch-admob-ios] Applied banner receive sizing patch')
}

/** `if let` → `guard` patch used to leave a stray `}` that breaks Swift compile. */
function repairBannerReceiveAdBrace() {
  if (!existsSync(bannerFile)) return
  let source = readFileSync(bannerFile, 'utf8')
  const orphan = `            self.plugin?.notifyListeners(BannerAdPluginEvents.Loaded.rawValue, data: [:])

        }
    }`
  const fixed = `        self.plugin?.notifyListeners(BannerAdPluginEvents.Loaded.rawValue, data: [:])
    }`
  if (!source.includes(orphan)) return
  source = source.replace(orphan, fixed)
  writeFileSync(bannerFile, source)
  console.log('[patch-admob-ios] Repaired extraneous brace in bannerViewDidReceiveAd')
}

patchBannerZOrder()
patchGetRootVC()
patchBannerDefaultTestUnit()
patchBannerReceiveAdSizing()
repairBannerReceiveAdBrace()
