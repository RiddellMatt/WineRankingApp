# Test Cellar Rank on iPhone Safari (Google sign-in)

Use this for **beta testers on iPhone** who do not have the native app installed. They open a normal link in **Safari**.

## 1. Supabase redirect URLs

Dashboard → **Authentication → URL Configuration**

**Site URL** (set to):

```
https://riddellmatt.github.io/WineRankingApp/
```

**Redirect URLs** — add all of these:

```
https://riddellmatt.github.io/WineRankingApp/
https://riddellmatt.github.io/WineRankingApp
com.northline.cellarrank://login-callback
http://localhost:5173/
http://localhost:5173
```

Save changes.

## 2. Google Cloud (already done for web client)

OAuth client type: **Web application**

Authorized redirect URI:

```
https://wqkllahjpusemdpznxfb.supabase.co/auth/v1/callback
```

Test users on the OAuth consent screen must include each Gmail address that will sign in (while app is in **Testing** mode).

## 3. GitHub Pages secrets

Repo → **Settings → Secrets and variables → Actions**

| Secret | Value |
|--------|--------|
| `VITE_SUPABASE_URL` | `https://wqkllahjpusemdpznxfb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |

Push to `main` to deploy, or run **Actions → Deploy to GitHub Pages → Run workflow**.

## 4. Link for iPhone testers

Send this URL (open in **Safari**, not Chrome if possible on iOS):

```
https://riddellmatt.github.io/WineRankingApp/
```

Tap **Continue with Google** on the sign-in screen.

Flow: Safari → Google login → back to Cellar Rank → signed in.

Optional: **Share → Add to Home Screen** for an app-like icon.

## 5. Native iOS app (separate path)

The App Store / TestFlight build uses `com.northline.cellarrank://login-callback`, not the GitHub Pages URL. You do **not** need a Mac — use **Codemagic** cloud builds (`mobile/CODEMAGIC_SETUP.md`). Local Xcode is optional; see `mobile/STORE_RELEASE.md`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cloud sync disabled on web | GitHub secrets missing; redeploy after adding secrets |
| Google access blocked | Add tester Gmail to Google OAuth consent **Test users** |
| Redirect error | Confirm Supabase redirect URLs match section 1 exactly |
| Stuck on sign-in after Google | Hard refresh Safari; try private tab |
