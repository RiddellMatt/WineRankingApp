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

function patchAndroidManifest() {
  const manifestPath = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml')
  if (!fs.existsSync(manifestPath)) {
    console.warn('Skipping Android deep link patch (AndroidManifest.xml not found).')
    return
  }

  let manifest = fs.readFileSync(manifestPath, 'utf8')
  if (manifest.includes(`android:scheme="${SCHEME}"`)) {
    console.log('Android URL scheme already configured.')
    return
  }

  const intentFilter = `
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" />
            </intent-filter>`

  manifest = manifest.replace(
    '</activity>',
    `${intentFilter}\n        </activity>`,
  )
  fs.writeFileSync(manifestPath, manifest)
  console.log('Patched AndroidManifest.xml with URL scheme.')
}

patchIosInfoPlist()
patchAndroidManifest()
