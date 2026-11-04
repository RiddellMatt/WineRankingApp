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
        // Stop at scroll edges (no rubber-band). Underlay matches app chrome if anything peeks through.
        scroll.bounces = false
        scroll.alwaysBounceVertical = false
        scroll.alwaysBounceHorizontal = false

        let underlay = UIColor(red: 18 / 255, green: 8 / 255, blue: 12 / 255, alpha: 1)
        webView.isOpaque = true
        webView.backgroundColor = underlay
        scroll.backgroundColor = underlay
    }
}
