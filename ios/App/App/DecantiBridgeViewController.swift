import UIKit
import Capacitor

/// Disables WKWebView rubber-banding that exposes a black underlay on overscroll (TestFlight feedback).
final class DecantiBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        applyScrollChrome()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyScrollChrome()
    }

    private func applyScrollChrome() {
        guard let webView = webView else { return }
        let scroll = webView.scrollView
        scroll.bounces = false
        scroll.alwaysBounceVertical = false
        scroll.alwaysBounceHorizontal = false
        // Match classic theme --bg (#12080c) when any edge is visible.
        webView.isOpaque = true
        webView.backgroundColor = UIColor(red: 18 / 255, green: 8 / 255, blue: 12 / 255, alpha: 1)
        scroll.backgroundColor = webView.backgroundColor
    }
}
