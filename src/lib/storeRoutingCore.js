/**
 * Which store a share visitor should see, and how "Open in the app" should open.
 * The page script below repeats these three functions so the static share page
 * and the edge-function page do not import this module. scripts/organic-growth.test.ts
 * checks that both copies make the same choice.
 */

const DEFAULT_SCHEME = 'com.northline.decanti'

export function storePlatform(userAgent, hints) {
  var ua = String(userAgent || '')
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  var points = hints && typeof hints.maxTouchPoints === 'number' ? hints.maxTouchPoints : 0
  if (points > 1 && /Macintosh/i.test(ua)) return 'ios'
  return 'desktop'
}

export function storeLinksForPlatform(platform, listings) {
  var appStoreUrl = listings && listings.appStoreUrl ? String(listings.appStoreUrl).trim() : ''
  var playStoreUrl = listings && listings.playStoreUrl ? String(listings.playStoreUrl).trim() : ''
  if (platform === 'ios') return { appStoreUrl: appStoreUrl || null, playStoreUrl: null }
  if (platform === 'android') return { appStoreUrl: null, playStoreUrl: playStoreUrl || null }
  return { appStoreUrl: appStoreUrl || null, playStoreUrl: playStoreUrl || null }
}

export function openInAppHref(input) {
  var scheme = (input && input.scheme) || DEFAULT_SCHEME
  var packageId = (input && input.packageId) || scheme
  var ref = input && input.referralCode ? String(input.referralCode) : ''
  var query = ref ? '?ref=' + encodeURIComponent(ref) : ''
  if (input && input.platform === 'android') {
    var play = input.playStoreUrl ? String(input.playStoreUrl) : ''
    var fallback = play || String((input && input.webUrl) || '')
    return (
      'intent://invite' +
      query +
      '#Intent;scheme=' +
      scheme +
      ';package=' +
      packageId +
      ';S.browser_fallback_url=' +
      encodeURIComponent(fallback) +
      ';end'
    )
  }
  return scheme + '://invite' + query
}

export function storeRoutingBrowserScript(config) {
  var scheme = (config && config.scheme) || DEFAULT_SCHEME
  var packageId = (config && config.packageId) || scheme
  return (
    '/* decanti-store-routing */\n' +
    '(function () {\n' +
    '  var SCHEME = ' +
    JSON.stringify(scheme) +
    ';\n' +
    '  var PACKAGE_ID = ' +
    JSON.stringify(packageId) +
    ';\n' +
    '  function storePlatform(userAgent, hints) {\n' +
    '    var ua = String(userAgent || "");\n' +
    '    if (/Android/i.test(ua)) return "android";\n' +
    '    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";\n' +
    '    var points = hints && typeof hints.maxTouchPoints === "number" ? hints.maxTouchPoints : 0;\n' +
    '    if (points > 1 && /Macintosh/i.test(ua)) return "ios";\n' +
    '    return "desktop";\n' +
    '  }\n' +
    '  function storeLinksForPlatform(platform, listings) {\n' +
    '    var appStoreUrl = listings && listings.appStoreUrl ? String(listings.appStoreUrl).trim() : "";\n' +
    '    var playStoreUrl = listings && listings.playStoreUrl ? String(listings.playStoreUrl).trim() : "";\n' +
    '    if (platform === "ios") return { appStoreUrl: appStoreUrl || null, playStoreUrl: null };\n' +
    '    if (platform === "android") return { appStoreUrl: null, playStoreUrl: playStoreUrl || null };\n' +
    '    return { appStoreUrl: appStoreUrl || null, playStoreUrl: playStoreUrl || null };\n' +
    '  }\n' +
    '  function openInAppHref(input) {\n' +
    '    var scheme = (input && input.scheme) || SCHEME;\n' +
    '    var packageId = (input && input.packageId) || PACKAGE_ID;\n' +
    '    var ref = input && input.referralCode ? String(input.referralCode) : "";\n' +
    '    var query = ref ? "?ref=" + encodeURIComponent(ref) : "";\n' +
    '    if (input && input.platform === "android") {\n' +
    '      var play = input.playStoreUrl ? String(input.playStoreUrl) : "";\n' +
    '      var fallback = play || String((input && input.webUrl) || "");\n' +
    '      return "intent://invite" + query + "#Intent;scheme=" + scheme + ";package=" + packageId + ";S.browser_fallback_url=" + encodeURIComponent(fallback) + ";end";\n' +
    '    }\n' +
    '    return scheme + "://invite" + query;\n' +
    '  }\n' +
    '  var params = new URLSearchParams(location.search);\n' +
    '  var ref = params.get("ref") || document.body.getAttribute("data-ref") || "";\n' +
    '  var site = document.body.getAttribute("data-site") || "";\n' +
    '  var web = site ? new URL(site) : new URL("./", location.href);\n' +
    '  if (ref) web.searchParams.set("ref", ref);\n' +
    '  var openWeb = document.getElementById("open-web");\n' +
    '  if (openWeb) openWeb.setAttribute("href", web.toString());\n' +
    '  var listings = {\n' +
    '    appStoreUrl: document.body.getAttribute("data-app-store") || "",\n' +
    '    playStoreUrl: document.body.getAttribute("data-play-store") || ""\n' +
    '  };\n' +
    '  var platform = storePlatform(navigator.userAgent || "", { maxTouchPoints: navigator.maxTouchPoints || 0 });\n' +
    '  var links = storeLinksForPlatform(platform, listings);\n' +
    '  var openApp = document.getElementById("open-app");\n' +
    '  if (openApp) {\n' +
    '    openApp.setAttribute("href", openInAppHref({\n' +
    '      platform: platform,\n' +
    '      referralCode: ref,\n' +
    '      webUrl: web.toString(),\n' +
    '      playStoreUrl: links.playStoreUrl,\n' +
    '      scheme: SCHEME,\n' +
    '      packageId: PACKAGE_ID\n' +
    '    }));\n' +
    '  }\n' +
    '  function show(id, url) {\n' +
    '    var el = document.getElementById(id);\n' +
    '    if (!el) return;\n' +
    '    if (!url) {\n' +
    '      el.hidden = true;\n' +
    '      el.setAttribute("href", "");\n' +
    '      return;\n' +
    '    }\n' +
    '    el.hidden = false;\n' +
    '    el.setAttribute("href", url);\n' +
    '  }\n' +
    '  show("open-app-store", links.appStoreUrl);\n' +
    '  show("open-play-store", links.playStoreUrl);\n' +
    '})();\n'
  )
}
