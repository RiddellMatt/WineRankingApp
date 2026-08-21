# Decanti

Rank, remember, and share every wine you've tried — with friends, a want-to-try list, and AI menu matching.

## Features

- **Add wines** with name, winery, vintage, type, varietal, region, price, and tasting notes
- **Rate in half-star steps** (0.5–5 stars) with an interactive star picker
- **Ranked leaderboard** — wines are numbered by rating, with gold/silver/bronze badges for the top three
- **Search and filter** by wine type, or search across names, wineries, regions, and notes
- **Sort** by rating, price, vintage, name, or recently added (ranks stay stable while you re-sort)
- **Stats bar** showing total wines tried, average rating, and your current favorite
- **Edit and delete** any entry
- **Local persistence** — everything is stored in your browser's localStorage; no account or backend needed
- **Sample wines** available from the empty state so you can explore the app instantly
- **Purchase location** — track where you bought each bottle; searchable
- **Taste characteristics** — data-driven Vivino-style stats (Light↔Bold, Smooth↔Tannic, Dry↔Sweet, Soft↔Acidic, and Gentle↔Fizzy for sparkling). Profiles auto-populate from a curated per-varietal reference dataset (`src/tasteData.ts`) and can be fine-tuned per bottle; cards fall back to the typical varietal profile when the user hasn't customized. Architecture is ready for aggregated community ratings later.
- **Menu sommelier** — photograph a restaurant wine list; on-device OCR finds the wines and ranks them against your cellar using your own ratings, varietal averages, and favorite regions, with plain-English reasons for each score
- **Label scanner** — snap or upload a photo of the label and on-device OCR (Tesseract.js, lazy-loaded) prefills name, winery, vintage, varietal, region, and type for review
- **Food pairings** — curated "Pairs with" suggestions per wine, keyed by varietal with wine-type fallbacks (`src/pairings.ts`)

## Monetization

The app ships with a freemium model plus an affiliate revenue channel. All knobs live in `src/config.ts`:

- **Free plan cap** — free users can log up to `FREE_WINE_LIMIT` (default 20) wines, then hit the upgrade paywall
- **Decanti Pro** — unlocks unlimited wines, the Insights dashboard (total spend, best-value bottles, rating distribution, taste profile by type/region/varietal), and JSON export/import
  - Connect payments by creating a [Stripe Payment Link](https://dashboard.stripe.com/payment-links) and pasting it into `PRO_CONFIG.paymentUrl`
  - Until payments are connected, Pro can be activated with a support unlock code via Edge Functions — useful for testing, promos, and manual fulfillment
- **Affiliate shop links** — every wine card has a 🛒 button that searches the wine on Wine-Searcher; set `SHOP_CONFIG.affiliateSuffix` to your affiliate tag so purchases earn commission

Note: Pro entitlement is stored client-side (localStorage), which is fine for validating the model but trivially bypassable. Before charging real money at scale, add accounts and server-side entitlement checks.

## Live app & mobile install

Every push to `main` deploys automatically to GitHub Pages via `.github/workflows/deploy.yml`:

**https://riddellmatt.github.io/WineRankingApp/**

The app is a PWA — on a phone, open the URL and use "Add to Home Screen" (Share menu on iOS, browser menu on Android) to install it like a native app. It works offline after the first load. Note that data still lives per-device in localStorage; syncing between devices requires accounts + a backend (future work).

## Getting started

```bash
npm install
npm run dev
```

Then open the printed URL (defaults to http://localhost:5173).

## Other scripts

```bash
npm run build    # type-check and build for production (output in dist/)
npm run preview  # serve the production build locally
npm run lint     # run oxlint
```

## Tech stack

- [React 19](https://react.dev/) + TypeScript
- [Vite](https://vite.dev/) for dev server and builds
- Plain CSS — no UI framework
- localStorage for persistence
