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
  const iosDefault = 'getAdId(call, "ca-app-pub-3940256099942544/2934735716")'
  const legacyIos = 'getAdId(call, "ca-app-pub-3940256089942544/2934735716")'
  if (source.includes(androidDefault) && !source.includes(iosDefault)) {
    source = source.replace(androidDefault, iosDefault)
  }
  if (source.includes(legacyIos)) {
    source = source.replaceAll(legacyIos, iosDefault)
  }
  if (source.includes(iosDefault)) {
    writeFileSync(pluginFile, source)
    console.log('[patch-admob-ios] Applied iOS banner test unit default')
  }
}

function patchBannerReceiveAdSizing() {
  if (!existsSync(bannerFile)) return
  const marker = 'bannerView.layoutIfNeeded()'
  let source = readFileSync(bannerFile, 'utf8')
  if (source.includes(marker) || source.includes('scheduleBannerReveal')) return

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

/**
 * Cold start lays the banner out once at the pre-tab-bar safe area, then a
 * margin reload moves it. Keep the UIView hidden until its bottom edge matches
 * the requested margin on a stable safe area, then show it.
 */
function patchBannerHiddenUntilPositioned() {
  if (!existsSync(bannerFile)) return
  const marker = 'scheduleBannerReveal'
  let source = readFileSync(bannerFile, 'utf8')
  if (source.includes(marker)) return

  if (!source.includes('var margin: Int = 0')) {
    console.warn('[patch-admob-ios] margin property missing; skipping hide-until-positioned')
    return
  }
  source = source.replace('var margin: Int = 0', 'var margin: Int = 0\n    var revealToken: Int = 0')

  const removeTarget = '    private func removeBannerViewToView() {\n        if let rootViewController = plugin?.getRootVC() {'
  const removeReplacement =
    '    private func removeBannerViewToView() {\n        revealToken += 1\n        if let rootViewController = plugin?.getRootVC() {'
  if (!source.includes(removeTarget)) {
    console.warn('[patch-admob-ios] removeBannerViewToView changed; skipping hide-until-positioned')
    return
  }
  source = source.replace(removeTarget, removeReplacement)

  const showTarget = `        rootViewController.view.addSubview(bannerView)
            rootViewController.view.bringSubviewToFront(bannerView)
            rootViewController.view.addConstraints(
                [NSLayoutConstraint(item: bannerView,
                                    attribute: self.adPosition == "TOP_CENTER" ? .top : .bottom,
                                    relatedBy: .equal,
                                    toItem: rootViewController.view.safeAreaLayoutGuide,
                                    attribute: self.adPosition == "TOP_CENTER" ? .top : .bottom,
                                    multiplier: 1,
                                    constant: CGFloat(Int(self.margin) * -1)),
                 NSLayoutConstraint(item: bannerView,
                                    attribute: .centerX,
                                    relatedBy: .equal,
                                    toItem: rootViewController.view,
                                    attribute: .centerX,
                                    multiplier: 1,
                                    constant: 0)
                ])
            bannerView.layoutIfNeeded()
            let h = max(bannerView.frame.size.height, bannerView.bounds.size.height)
            let w = max(bannerView.frame.size.width, bannerView.bounds.size.width)
            self.plugin?.notifyListeners(BannerAdPluginEvents.SizeChanged.rawValue, data: [
                "width": w,
                "height": h
            ])`
  const showReplacement = `        bannerView.isHidden = true
        bannerView.alpha = 0
        rootViewController.view.addSubview(bannerView)
        rootViewController.view.bringSubviewToFront(bannerView)
        rootViewController.view.addConstraints(
            [NSLayoutConstraint(item: bannerView,
                                attribute: self.adPosition == "TOP_CENTER" ? .top : .bottom,
                                relatedBy: .equal,
                                toItem: rootViewController.view.safeAreaLayoutGuide,
                                attribute: self.adPosition == "TOP_CENTER" ? .top : .bottom,
                                multiplier: 1,
                                constant: CGFloat(Int(self.margin) * -1)),
             NSLayoutConstraint(item: bannerView,
                                attribute: .centerX,
                                relatedBy: .equal,
                                toItem: rootViewController.view,
                                attribute: .centerX,
                                multiplier: 1,
                                constant: 0)
            ])
        revealToken += 1
        scheduleBannerReveal(
            bannerView,
            rootView: rootViewController.view,
            token: revealToken,
            attempt: 0,
            previousMaxY: -1,
            previousHeight: -1,
            previousSafeBottom: -1
        )`
  if (!source.includes(showTarget)) {
    console.warn('[patch-admob-ios] bannerViewDidReceiveAd layout changed; skipping hide-until-positioned')
    return
  }
  source = source.replace(showTarget, showReplacement)

  const tail = `    func bannerViewWillDismissScreen(_ bannerView: BannerView) {
        self.plugin?.notifyListeners(BannerAdPluginEvents.Closed.rawValue, data: [:])
    }
}`
  const helpers = `    func bannerViewWillDismissScreen(_ bannerView: BannerView) {
        self.plugin?.notifyListeners(BannerAdPluginEvents.Closed.rawValue, data: [:])
    }

    /// Hidden until the banner's edge matches the requested margin on an unchanged safe area.
    private func scheduleBannerReveal(
        _ bannerView: BannerView,
        rootView: UIView,
        token: Int,
        attempt: Int,
        previousMaxY: CGFloat,
        previousHeight: CGFloat,
        previousSafeBottom: CGFloat
    ) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self, weak bannerView, weak rootView] in
            guard
                let self,
                let bannerView,
                let rootView,
                token == self.revealToken,
                bannerView.superview != nil
            else { return }

            rootView.layoutIfNeeded()
            let frame = bannerView.convert(bannerView.bounds, to: rootView)
            let height = frame.height
            let safeBottom = rootView.safeAreaInsets.bottom
            let aligned = self.bannerFrame(frame, matchesMarginIn: rootView, height: height)
            let stable = previousMaxY >= 0
                && abs(frame.maxY - previousMaxY) < 0.5
                && abs(height - previousHeight) < 0.5
                && abs(safeBottom - previousSafeBottom) < 0.5
            if aligned && stable {
                self.revealPositionedBanner(bannerView, in: rootView, frame: frame)
                return
            }
            if attempt >= 30 && height > 1 {
                self.revealPositionedBanner(bannerView, in: rootView, frame: frame)
                return
            }
            if attempt >= 30 {
                return
            }
            self.scheduleBannerReveal(
                bannerView,
                rootView: rootView,
                token: token,
                attempt: attempt + 1,
                previousMaxY: frame.maxY,
                previousHeight: height,
                previousSafeBottom: safeBottom
            )
        }
    }

    private func bannerFrame(_ frame: CGRect, matchesMarginIn rootView: UIView, height: CGFloat) -> Bool {
        guard height > 1 else { return false }
        if adPosition == "TOP_CENTER" {
            let expectedMinY = rootView.safeAreaLayoutGuide.layoutFrame.minY + CGFloat(margin)
            return abs(frame.minY - expectedMinY) <= 2
        }
        let expectedMaxY = rootView.safeAreaLayoutGuide.layoutFrame.maxY - CGFloat(margin)
        return abs(frame.maxY - expectedMaxY) <= 2
    }

    private func revealPositionedBanner(_ bannerView: BannerView, in rootView: UIView, frame: CGRect) {
        rootView.bringSubviewToFront(bannerView)
        bannerView.alpha = 1
        bannerView.isHidden = false
        plugin?.notifyListeners(BannerAdPluginEvents.SizeChanged.rawValue, data: [
            "width": frame.width,
            "height": frame.height
        ])
    }
}`
  if (!source.includes(tail)) {
    console.warn('[patch-admob-ios] banner class tail changed; skipping hide-until-positioned helpers')
    return
  }
  source = source.replace(tail, helpers)
  writeFileSync(bannerFile, source)
  console.log('[patch-admob-ios] Banner stays hidden until its position settles')
}

/** Android draws the banner, then window insets move it. Stay invisible until that stops. */
function patchAndroidBannerHiddenUntilSettled() {
  const androidBanner = resolve(
    import.meta.dirname,
    '../node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java',
  )
  if (!existsSync(androidBanner)) return
  let source = readFileSync(androidBanner, 'utf8')
  if (source.includes('decantiBannerReveal')) return

  const fields = '    private ViewGroup mViewGroup;'
  const fieldsReplacement = `    private ViewGroup mViewGroup;
    /** decantiBannerReveal: hidden until window insets stop moving the banner. */
    private boolean decantiBannerLoaded = false;
    private boolean decantiBannerRevealed = false;
    private int decantiRevealAttempts = 0;
    private Runnable decantiBannerReveal;`
  if (!source.includes(fields)) {
    console.warn('[patch-admob-android] fields changed; skipping hide-until-settled')
    return
  }
  source = source.replace(fields, fieldsReplacement)

  const createLayout = '            mAdViewLayout = new RelativeLayout(contextSupplier.get());'
  if (!source.includes(createLayout)) {
    console.warn('[patch-admob-android] layout creation changed; skipping hide-until-settled')
    return
  }
  source = source.replace(
    createLayout,
    `${createLayout}
            mAdViewLayout.setVisibility(View.INVISIBLE);
            decantiBannerLoaded = false;
            decantiBannerRevealed = false;`,
  )

  const insetApply = `                v.setLayoutParams(mAdViewLayoutParams);
                return insets;`
  const insetReplacement = `                v.setLayoutParams(mAdViewLayoutParams);
                scheduleDecantiBannerReveal();
                return insets;`
  if (!source.includes(insetApply)) {
    console.warn('[patch-admob-android] inset listener changed; skipping hide-until-settled')
    return
  }
  source = source.replace(insetApply, insetReplacement)

  const loaded = `                    public void onAdLoaded() {
                        if (adView != mAdView) {
                            return;
                        }
                        final BannerAdSizeInfo sizeInfo = new BannerAdSizeInfo(adView);`
  const loadedReplacement = `                    public void onAdLoaded() {
                        if (adView != mAdView) {
                            return;
                        }
                        decantiBannerLoaded = true;
                        scheduleDecantiBannerReveal();
                        final BannerAdSizeInfo sizeInfo = new BannerAdSizeInfo(adView);`
  if (!source.includes(loaded)) {
    console.warn('[patch-admob-android] onAdLoaded changed; skipping hide-until-settled')
    return
  }
  source = source.replace(loaded, loadedReplacement)

  const attach = `                bannerParent.addView(mAdViewLayout);
                mAdViewLayout.requestApplyInsets();`
  if (!source.includes(attach)) {
    console.warn('[patch-admob-android] addView changed; skipping hide-until-settled')
    return
  }
  source = source.replace(attach, `${attach}
                scheduleDecantiBannerReveal();`)

  const removed = `                        mAdView = null;
                        Log.d(logTag, "Banner AD Removed");`
  if (!source.includes(removed)) {
    console.warn('[patch-admob-android] remove path changed; skipping hide-until-settled')
    return
  }
  source = source.replace(
    removed,
    `                        mAdView = null;
                        decantiBannerLoaded = false;
                        decantiBannerRevealed = false;
                        if (decantiBannerReveal != null && mAdViewLayout != null) {
                            mAdViewLayout.removeCallbacks(decantiBannerReveal);
                        }
                        Log.d(logTag, "Banner AD Removed");`,
  )

  const classEnd = `        });
    }
}`
  const classReplacement = `        });
    }

    private void scheduleDecantiBannerReveal() {
        if (mAdViewLayout == null || decantiBannerRevealed) {
            return;
        }
        mAdViewLayout.setVisibility(View.INVISIBLE);
        if (decantiBannerReveal != null) {
            mAdViewLayout.removeCallbacks(decantiBannerReveal);
        }
        decantiRevealAttempts = 0;
        decantiBannerReveal = new Runnable() {
            @Override
            public void run() {
                if (mAdViewLayout == null || mAdView == null || decantiBannerRevealed) {
                    return;
                }
                decantiRevealAttempts++;
                boolean positioned = decantiBannerLoaded && mAdView.getHeight() > 0;
                if (positioned || decantiRevealAttempts > 24) {
                    if (mAdView.getHeight() > 0) {
                        decantiBannerRevealed = true;
                        mAdViewLayout.setElevation(32f);
                        mAdViewLayout.bringToFront();
                        mAdViewLayout.setVisibility(View.VISIBLE);
                    }
                    return;
                }
                mAdViewLayout.postDelayed(this, 50);
            }
        };
        mAdViewLayout.postDelayed(decantiBannerReveal, 200);
    }
}`
  if (!source.endsWith(classEnd) && !source.includes(classEnd)) {
    console.warn('[patch-admob-android] class ending changed; skipping reveal helper')
    return
  }
  source = source.replace(classEnd, classReplacement)
  writeFileSync(androidBanner, source)
  console.log('[patch-admob-android] Banner stays hidden until insets settle')
}

/** Keep an already-patched Android banner above the WebView. */
function patchAndroidBannerOnTop() {
  const androidBanner = resolve(
    import.meta.dirname,
    '../node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java',
  )
  if (!existsSync(androidBanner)) return
  let source = readFileSync(androidBanner, 'utf8')
  if (source.includes('mAdViewLayout.bringToFront()')) return
  const target = `                        decantiBannerRevealed = true;
                        mAdViewLayout.setVisibility(View.VISIBLE);`
  const replacement = `                        decantiBannerRevealed = true;
                        mAdViewLayout.setElevation(32f);
                        mAdViewLayout.bringToFront();
                        mAdViewLayout.setVisibility(View.VISIBLE);`
  if (!source.includes(target)) {
    console.warn('[patch-admob-android] reveal path changed; skipping bring-to-front')
    return
  }
  source = source.replace(target, replacement)
  writeFileSync(androidBanner, source)
  console.log('[patch-admob-android] Banner is raised above the WebView')
}

patchBannerZOrder()
patchGetRootVC()
patchBannerDefaultTestUnit()
patchBannerReceiveAdSizing()
repairBannerReceiveAdBrace()
patchBannerHiddenUntilPositioned()
patchAndroidBannerHiddenUntilSettled()
patchAndroidBannerOnTop()
