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
        // Rubber-band with matched underlay (classic --bg #12080c). Disabling bounce makes
        // WKWebView fight scroll offset at y=0 and shake when pulling down/up past the top.
        scroll.bounces = true
        scroll.alwaysBounceVertical = true
        scroll.alwaysBounceHorizontal = false
        if #available(iOS 11.0, *) {
            // Safe areas come from CSS; avoid UIKit inset animation fighting layout on cold start.
            scroll.contentInsetAdjustmentBehavior = .never
        }

        let underlay = UIColor(red: 18 / 255, green: 8 / 255, blue: 12 / 255, alpha: 1)
        webView.isOpaque = true
        webView.backgroundColor = underlay
        scroll.backgroundColor = underlay
        view.backgroundColor = underlay
    }
}
