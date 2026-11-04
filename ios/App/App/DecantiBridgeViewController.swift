import UIKit
import Capacitor

/// Keeps WKWebView underlay on-brand during rubber-banding (TestFlight overscroll feedback).
final class DecantiBridgeViewController: CAPBridgeViewController {
    private var didApplyScrollChrome = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        applyScrollChromeIfNeeded()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // WebView is nil until after first layout; apply once (re-applying every layout caused top-edge flicker).
        applyScrollChromeIfNeeded()
    }

    private func applyScrollChromeIfNeeded() {
        guard !didApplyScrollChrome, let webView = webView else { return }
        didApplyScrollChrome = true

        let scroll = webView.scrollView
        // Allow rubber-band; matched underlay color replaces the old black flash. Disabling bounce
        // made WKWebView fight the scroll offset at y=0 and flicker when pulling past the top.
        scroll.bounces = true
        scroll.alwaysBounceVertical = true
        scroll.alwaysBounceHorizontal = false

        let underlay = UIColor(red: 18 / 255, green: 8 / 255, blue: 12 / 255, alpha: 1)
        webView.isOpaque = true
        webView.backgroundColor = underlay
        scroll.backgroundColor = underlay
    }
}
