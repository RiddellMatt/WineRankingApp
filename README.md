# Cellar Rank 🍷

A small web app for ranking the wines you've tried. Log each bottle with a rating and tasting notes, and see your personal leaderboard — best wine first.

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
