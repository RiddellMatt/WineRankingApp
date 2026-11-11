#!/usr/bin/env node
/**
 * Keep AdMob banner above native UITabBar (Capawesome) after load on iOS.
 * Re-applied on npm install — do not edit node_modules by hand.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(
  import.meta.dirname,
  '../node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/Banner/BannerExecutor.swift',
)

if (!existsSync(file)) {
  process.exit(0)
}

const marker = 'bringSubviewToFront(bannerView)'
let source = readFileSync(file, 'utf8')
if (source.includes(marker)) {
  process.exit(0)
}

const target =
  '            rootViewController.view.addConstraints(\n                [NSLayoutConstraint(item: bannerView,'
const replacement =
  '            rootViewController.view.bringSubviewToFront(bannerView)\n            rootViewController.view.addConstraints(\n                [NSLayoutConstraint(item: bannerView,'

if (!source.includes(target)) {
  console.warn('[patch-admob-ios] BannerExecutor.swift layout changed; skipping z-order patch')
  process.exit(0)
}

source = source.replace(target, replacement)
writeFileSync(file, source)
console.log('[patch-admob-ios] Applied banner z-order patch')
