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

patchBannerZOrder()
patchGetRootVC()
patchBannerDefaultTestUnit()
