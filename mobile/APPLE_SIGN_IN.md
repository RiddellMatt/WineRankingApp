# Sign in with Apple — setup (Supabase + Apple Developer)

Decanti uses **Supabase Auth OAuth** for Apple (same flow as Google): the app opens the system browser → Apple → Supabase → `com.northline.decanti://login-callback`.

If the app shows **“Apple provider sign in not set up”** (or similar), the **Apple provider is disabled or incomplete in Supabase**, not missing app code.

---

## 1. Apple Developer

### 1A. App ID (native app)

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers** → **com.northline.decanti**.
2. Enable **Sign in with Apple** → **Save**.
3. Repository includes this in `ios/App/App/App.entitlements`; after enabling on the App ID, **regenerate iOS distribution profile** in Codemagic (or Xcode) so the capability is in the provisioning profile.

### 1B. Services ID (Supabase OAuth client)

1. **Identifiers** → **+** → **Services IDs**.
2. Description: e.g. `Decanti Auth`.
3. Identifier: e.g. `com.northline.decanti.auth` (use this as **Client ID** in Supabase).
4. Enable **Sign in with Apple** → **Configure**:
   - **Primary App ID:** `com.northline.decanti`
   - **Domains and Subdomains:** `YOUR_PROJECT_REF.supabase.co` (no `https://`)
   - **Return URLs:** `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
5. **Save** → **Continue** → **Register**.

### 1C. Sign in with Apple key (.p8)

1. **Keys** → **+** → name e.g. `Decanti Supabase Apple`.
2. Enable **Sign in with Apple** → **Configure** → select primary App ID **com.northline.decanti**.
3. **Register** → **Download** the `.p8` (once only).
4. Note **Key ID** and your **Team ID** (Membership details).

---

## 2. Supabase Dashboard

**Authentication → Providers → Apple**

| Field | Value |
|--------|--------|
| Enable Apple provider | **On** |
| Client ID | Your **Services ID** (e.g. `com.northline.decanti.auth`) — **not** the bundle id |
| Secret Key | Contents of the `.p8` file |
| Key ID | From Apple |
| Team ID | From Apple |

**Authentication → URL Configuration**

Add to **Redirect URLs** (in addition to GitHub Pages / localhost):

```
com.northline.decanti://login-callback
```

**Site URL** can stay your GitHub Pages URL for web; mobile uses the custom scheme above.

---

## 3. Database (first sign-in)

Run **section 5** in `supabase/run-in-sql-editor.sql` so OAuth display names (and avatars when available) seed `profiles`.

---

## 4. Rebuild iOS

After entitlements + Apple portal + Supabase:

1. Push to `main` → Codemagic **iOS TestFlight** workflow (or local `npm run cap:sync`).
2. Install new TestFlight build.
3. **Continue with Apple** should open Apple’s page (not an instant error).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Error before browser opens | Turn on Apple in Supabase; fill Services ID, Team ID, Key ID, secret |
| `invalid_client` | Client ID must be **Services ID**, not `com.northline.decanti` |
| Redirect fails | Add `com.northline.decanti://login-callback` in Supabase Redirect URLs |
| Apple rejects domain | Services ID → domain = `xxx.supabase.co`, return URL = `https://xxx.supabase.co/auth/v1/callback` |
| Works on web, not TestFlight | Same Supabase project; confirm new build has updated entitlements / profile |

---

## App Store

If you offer **Google** sign-in, Apple requires **Sign in with Apple** on iOS. Keep the Apple button on the auth screen (`AuthScreen.tsx`).