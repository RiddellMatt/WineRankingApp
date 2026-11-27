/* decanti-store-routing */
(function () {
  var SCHEME = "com.northline.decanti";
  var PACKAGE_ID = "com.northline.decanti";
  function storePlatform(userAgent, hints) {
    var ua = String(userAgent || "");
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    var points = hints && typeof hints.maxTouchPoints === "number" ? hints.maxTouchPoints : 0;
    if (points > 1 && /Macintosh/i.test(ua)) return "ios";
    return "desktop";
  }
  function storeLinksForPlatform(platform, listings) {
    var appStoreUrl = listings && listings.appStoreUrl ? String(listings.appStoreUrl).trim() : "";
    var playStoreUrl = listings && listings.playStoreUrl ? String(listings.playStoreUrl).trim() : "";
    if (platform === "ios") return { appStoreUrl: appStoreUrl || null, playStoreUrl: null };
    if (platform === "android") return { appStoreUrl: null, playStoreUrl: playStoreUrl || null };
    return { appStoreUrl: appStoreUrl || null, playStoreUrl: playStoreUrl || null };
  }
  function openInAppHref(input) {
    var scheme = (input && input.scheme) || SCHEME;
    var packageId = (input && input.packageId) || PACKAGE_ID;
    var ref = input && input.referralCode ? String(input.referralCode) : "";
    var query = ref ? "?ref=" + encodeURIComponent(ref) : "";
    if (input && input.platform === "android") {
      var play = input.playStoreUrl ? String(input.playStoreUrl) : "";
      var fallback = play || String((input && input.webUrl) || "");
      return "intent://invite" + query + "#Intent;scheme=" + scheme + ";package=" + packageId + ";S.browser_fallback_url=" + encodeURIComponent(fallback) + ";end";
    }
    return scheme + "://invite" + query;
  }
  var params = new URLSearchParams(location.search);
  var ref = params.get("ref") || document.body.getAttribute("data-ref") || "";
  var site = document.body.getAttribute("data-site") || "";
  var web = site ? new URL(site) : new URL("./", location.href);
  if (ref) web.searchParams.set("ref", ref);
  var openWeb = document.getElementById("open-web");
  if (openWeb) openWeb.setAttribute("href", web.toString());
  var listings = {
    appStoreUrl: document.body.getAttribute("data-app-store") || "",
    playStoreUrl: document.body.getAttribute("data-play-store") || ""
  };
  var platform = storePlatform(navigator.userAgent || "", { maxTouchPoints: navigator.maxTouchPoints || 0 });
  var links = storeLinksForPlatform(platform, listings);
  var openApp = document.getElementById("open-app");
  if (openApp) {
    openApp.setAttribute("href", openInAppHref({
      platform: platform,
      referralCode: ref,
      webUrl: web.toString(),
      playStoreUrl: links.playStoreUrl,
      scheme: SCHEME,
      packageId: PACKAGE_ID
    }));
  }
  function show(id, url) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!url) {
      el.hidden = true;
      el.setAttribute("href", "");
      return;
    }
    el.hidden = false;
    el.setAttribute("href", url);
  }
  show("open-app-store", links.appStoreUrl);
  show("open-play-store", links.playStoreUrl);
})();
