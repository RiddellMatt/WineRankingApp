#!/usr/bin/env node
/**
 * When QA builds use Google test ad units, pair them with Google's sample iOS app ID.
 * Production TestFlight / App Store builds keep Decanti's real GADApplicationIdentifier.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const plistPath = resolve(root, 'ios/App/App/Info.plist')

const PRODUCTION_IOS_APP_ID = 'ca-app-pub-5228268438882570~1709768455'
const GOOGLE_SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256089942544~1458002511'

function useTestAdsAtBuildTime() {
  return process.env.VITE_ADMOB_TEST_MODE !== 'false'
}

function targetAppId() {
  return useTestAdsAtBuildTime() ? GOOGLE_SAMPLE_IOS_APP_ID : PRODUCTION_IOS_APP_ID
}

function patchPlist(desiredId) {
  if (!existsSync(plistPath)) {
    console.warn('[configure-admob-ios] Info.plist missing; skip')
    return
  }
  let source = readFileSync(plistPath, 'utf8')
  const re =
    /(<key>GADApplicationIdentifier<\/key>\s*\n\s*<string>)([^<]+)(<\/string>)/
  if (!re.test(source)) {
    console.warn('[configure-admob-ios] GADApplicationIdentifier not found; skip')
    return
  }
  const current = source.match(re)?.[2]
  if (current === desiredId) {
    console.log(`[configure-admob-ios] GADApplicationIdentifier already ${desiredId}`)
    return
  }
  source = source.replace(re, `$1${desiredId}$3`)
  writeFileSync(plistPath, source)
  console.log(
    `[configure-admob-ios] GADApplicationIdentifier → ${desiredId} (testMode=${useTestAdsAtBuildTime()})`,
  )
}

patchPlist(targetAppId())
