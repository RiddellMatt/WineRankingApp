import { sharePageRoutingScript, SHARE_APP_STORE_URL, SHARE_PLAY_STORE_URL } from '../../../src/lib/storeRouting.ts'

const DEFAULT_SITE = 'https://decantiwine.com/'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface WineSharePage {
  wineName: string
  winery?: string
  vintage?: string
  scoreLabel: string
  imageUrl?: string | null
  referralCode?: string | null
  siteUrl?: string
  appStoreUrl?: string
  playStoreUrl?: string
}

/** Public preview page. Wine text is escaped. The open-in-app link is filled in by the page script. */
export function renderWineShareHtml(page: WineSharePage): string {
  const site = page.siteUrl ?? DEFAULT_SITE
  const name = escapeHtml(page.wineName.trim() || 'A wine on Decanti')
  const winery = escapeHtml(page.winery?.trim() ?? '')
  const vintage = escapeHtml(page.vintage?.trim() ?? '')
  const score = escapeHtml(page.scoreLabel.trim() || 'Ranked')
  const meta = [vintage, winery].filter(Boolean).join(' · ')
  const description = escapeHtml(`${page.wineName} — ${page.scoreLabel} on Decanti`)
  const image = page.imageUrl ? escapeHtml(page.imageUrl) : ''
  const ref = escapeHtml(page.referralCode?.trim() ?? '')
  const appStoreUrl = escapeHtml(page.appStoreUrl ?? SHARE_APP_STORE_URL)
  const playStoreUrl = escapeHtml(page.playStoreUrl ?? SHARE_PLAY_STORE_URL)
  const routingScript = sharePageRoutingScript()
  const imageTag = image
    ? `<img class="card" src="${image}" alt="${name}">`
    : ''
  const ogImage = image ? `<meta property="og:image" content="${image}">` : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} on Decanti</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="noindex">
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  ${ogImage}
  <meta name="twitter:card" content="summary_large_image">
  <style>
    body { margin: 0; background: #12080c; color: #f7eef1; font-family: Georgia, "Times New Roman", serif; }
    main { max-width: 28rem; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    a { color: #f4d58d; }
    .card { width: 100%; height: auto; border-radius: 12px; }
    .score { color: #e8b04b; font-family: Inter, system-ui, sans-serif; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
    .btn { display: inline-block; background: #c41e3a; color: #fff; text-decoration: none; padding: 0.7rem 1rem; border-radius: 999px; font-family: Inter, system-ui, sans-serif; }
    .btn.ghost { background: transparent; color: #f7eef1; border: 1px solid #4a2834; }
    .btn[hidden] { display: none; }
    p { line-height: 1.45; }
  </style>
</head>
<body data-ref="${ref}" data-site="${escapeHtml(site)}" data-app-store="${appStoreUrl}" data-play-store="${playStoreUrl}">
  <main>
    ${imageTag}
    <h1>${name}</h1>
    ${meta ? `<p>${meta}</p>` : ''}
    <p class="score">${score}</p>
    <p>Rank the bottles you try, and keep the list with friends.</p>
    <div class="actions">
      <a class="btn" id="open-web" href="${escapeHtml(site)}">Open Decanti</a>
      <a class="btn ghost" id="open-app" href="com.northline.decanti://invite">Open in the app</a>
      <a class="btn ghost" id="open-app-store" hidden href="">Download for iPhone</a>
      <a class="btn ghost" id="open-play-store" hidden href="">Get it on Google Play</a>
    </div>
  </main>
  <script>
${routingScript}
  </script>
</body>
</html>`
}
