#!/usr/bin/env node
/**
 * Ensures iOS and Android native projects register the Decanti URL scheme
 * for Supabase OAuth and Stripe return links. Run after `npx cap sync`.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCHEME = 'com.northline.decanti'

function patchIosInfoPlist() {
  const plistPath = path.join(ROOT, 'ios/App/App/Info.plist')
  if (!fs.existsSync(plistPath)) {
    console.warn('Skipping iOS deep link patch (Info.plist not found). Run cap add ios first.')
    return
  }

  let plist = fs.readFileSync(plistPath, 'utf8')
  if (plist.includes(`<string>${SCHEME}</string>`)) {
    console.log('iOS URL scheme already configured.')
    return
  }

  const urlTypeBlock = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>${SCHEME}</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${SCHEME}</string>
			</array>
		</dict>
	</array>`

  plist = plist.replace('</dict>\n</plist>', `${urlTypeBlock}\n</dict>\n</plist>`)
  fs.writeFileSync(plistPath, plist)
  console.log('Patched iOS Info.plist with URL scheme.')
}

const ANDROID_VIEW_FILTER = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" android:host="login-callback" />
                <data android:scheme="${SCHEME}" android:host="checkout-success" />
                <data android:scheme="${SCHEME}" android:host="checkout-cancel" />
                <data android:scheme="${SCHEME}" android:host="account" />
                <data android:scheme="${SCHEME}" android:host="friends" />
                <data android:scheme="${SCHEME}" android:host="invite" />
            </intent-filter>`

function patchAndroidManifest() {
  const manifestPath = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml')
  if (!fs.existsSync(manifestPath)) {
    console.warn('Skipping Android deep link patch (AndroidManifest.xml not found).')
    return
  }

  let manifest = fs.readFileSync(manifestPath, 'utf8')
  const before = manifest
  manifest = manifest.replace(/<intent-filter android:autoVerify="true">/g, '<intent-filter>')

  // The launcher is an activity-alias. Chrome's package-scoped return intent
  // only opens the app when that enabled alias accepts the link.
  manifest = manifest.replace(/<activity-alias\b[\s\S]*?<\/activity-alias>/g, (alias) => {
    if (alias.includes(`android:scheme="${SCHEME}"`)) return alias
    return alias.replace('</activity-alias>', `${ANDROID_VIEW_FILTER}\n        </activity-alias>`)
  })

  if (!manifest.includes(`android:scheme="${SCHEME}"`)) {
    manifest = manifest.replace('</activity>', `${ANDROID_VIEW_FILTER}\n        </activity>`)
  }

  if (!manifest.includes('android:host="invite"')) {
    manifest = manifest.replaceAll(
      `<data android:scheme="${SCHEME}" android:host="friends" />`,
      `<data android:scheme="${SCHEME}" android:host="friends" />\n                <data android:scheme="${SCHEME}" android:host="invite" />`,
    )
  }

  if (manifest === before) {
    console.log('Android URL scheme already configured.')
    return
  }
  fs.writeFileSync(manifestPath, manifest)
  console.log('Patched AndroidManifest.xml with URL scheme on the launcher aliases.')
}

patchIosInfoPlist()
patchAndroidManifest()
