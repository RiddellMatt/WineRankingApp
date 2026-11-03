# RevenueCat + App Store — Decanti Pro (iOS)

Step-by-step setup across **App Store Connect**, **RevenueCat**, **Supabase**, and **Codemagic**. Decanti Pro on iOS uses **Apple In-App Purchase**; web/Android can keep **Stripe** for now.

**Bundle ID:** `com.northline.decanti`  
**App Store Connect app name:** Decanti (Apple ID `6829230183` if unchanged)  
**Supabase project URL:** `https://wqkllahjpusemdpznxfb.supabase.co`

---

## Part 0 — Order of operations

Do these in order; later steps depend on earlier ones:

1. Apple **Paid Apps** agreement (or subscriptions stay stuck in “Missing Metadata”).
2. Create **subscription product** in App Store Connect.
3. Create **RevenueCat** project and link Apple + products.
4. Add **Supabase** secrets and deploy edge functions.
5. Add **Codemagic** env var and ship a new iOS build.
6. Test with a **Sandbox Apple ID** on TestFlight.

---

## Part 1 — Apple Developer & App Store Connect

### 1A. Confirm you can sell (Agreements, Tax, and Banking)

**Where:** [App Store Connect](https://appstoreconnect.apple.com) → sign in with your Apple Developer Apple ID.

1. Top navigation: **Business** (or **Agreements, Tax, and Banking** on older layouts).
2. Under **Agreements**, find **Paid Apps Agreement**.
3. Status must be **Active**. If it says **Action needed**, open it and complete:
   - Legal entity / contact
   - **Banking** (where Apple sends money)
   - **Tax** forms (W-9 or equivalent)

Until this is active, subscription products may not go live for real purchases (Sandbox can still work for testing in many cases).

---

### 1B. Open your Decanti app record

**Where:** App Store Connect → **Apps** (grid icon or “My Apps”).

1. Click **Decanti** (bundle `com.northline.decanti`).
2. You should see tabs like **Distribution**, **TestFlight**, **Xcode Cloud**, etc.

If the app does not exist yet: **+** → **New App** → iOS → name **Decanti** → bundle **com.northline.decanti** → SKU e.g. `decanti-ios`.

---

### 1C. Create a subscription group and product

**Where:** Still in **Decanti** → left sidebar under your app:

1. Click **Subscriptions** (under **MONETIZATION** or **Features**, depending on UI version).  
   - If you do not see Subscriptions: ensure the app is iOS and the Paid Apps agreement is in progress or active.

2. **Subscription Groups**
   - Click **+** or **Create** to add a **Subscription Group**.
   - Reference name: e.g. `Decanti Pro` (internal; users see product names, not always this).
   - Save the group.

3. **Add subscription** inside that group
   - Click **+** to add a subscription to the group.
   - **Reference name:** `Decanti Pro Monthly` (internal).
   - **Product ID:** choose a permanent ID, e.g. `decanti_pro_monthly` — **write this down**; RevenueCat must use the same ID.
   - **Subscription duration:** 1 month.

4. **Subscription pricing**
   - Set price tier (e.g. **$3.99 USD** or your chosen tier).
   - Apple may ask you to confirm territories; default “all” is fine for v1.

5. **Localization** (required before submission)
   - Add **Subscription Display Name** and **Description** for at least **English (U.S.)**  
     Example name: `Decanti Pro`  
     Example description: `Unlimited wines, Insights, export, and AI menu scans.`

6. **Review information** (for the subscription)
   - Apple may ask for a **screenshot** showing where subscription is offered (Account → Subscribe in Decanti is fine once IAP build exists).

7. Save. Status may show **Ready to Submit** or **Missing Metadata** until localizations and pricing are complete.

**Send to your agent when done:** the exact **Product ID** (e.g. `decanti_pro_monthly`).

---

### 1D. App-specific shared secret (optional if RevenueCat uses App Store Connect API)

RevenueCat’s current setup usually prefers **App Store Connect API** (Part 2). If their wizard asks for **App-Specific Shared Secret**:

**Where:** App Store Connect → **Apps** → **Decanti** → **General** → **App Information**  
- Scroll to **App-Specific Shared Secret** → **Manage** → generate/copy.

---

### 1E. Sandbox tester (for TestFlight / device testing)

**Where:** App Store Connect → **Users and Access** (top nav, person icon).

1. Left sidebar: **Sandbox** → **Test Accounts** (or **Sandbox Testers**).
2. Click **+** to add a tester.
3. Use a **new email** you control (does not need to be a real inbox for all flows, but must be unique in Sandbox).
4. Set password and country.

On your **iPhone**: **Settings → App Store → Sandbox Account** (bottom) → sign in with this Sandbox Apple ID.  
Do **not** use Sandbox ID in the normal iCloud slot unless Apple’s docs for your iOS version say otherwise.

---

### 1F. In-App Purchase capability (usually automatic)

**Where:** [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers** → select **com.northline.decanti**.

- Ensure **In-App Purchase** capability is enabled (often on by default for App Store apps).

Codemagic already builds with App Store distribution; no extra Xcode step on your Mac if you only use CI.

---

## Part 2 — RevenueCat

**Where:** [RevenueCat Dashboard](https://app.revenuecat.com)

### 2A. Create project and add the iOS app

1. Sign up / log in.
2. **+ New project** → name: **Decanti**.
3. Inside the project: **Apps** (left nav) → **+ New** → **Apple App Store**.
4. **App name:** Decanti iOS  
   **Bundle ID:** `com.northline.decanti`  
   **App Store Connect App Apple ID:** `6829230183` (if that is still your app’s Apple ID under App Information).

5. **Connect to App Store Connect** — RevenueCat will guide you:
   - **Recommended:** **App Store Connect API Key**  
     **Where to get it:** App Store Connect → **Users and Access** → **Integrations** tab → **App Store Connect API** → **+** generate key with at least **App Manager** access. Download `.p8` once; copy **Issuer ID** and **Key ID** into RevenueCat.
   - **Alternative:** App-specific shared secret (Part 1D).

6. Finish until RevenueCat shows the app as connected / able to import products.

---

### 2B. Entitlement (what “Pro” means in code)

**Where:** RevenueCat project → **Product catalog** → **Entitlements** (left nav).

1. **+ New entitlement**
2. **Identifier:** `pro` (lowercase — matches app default `VITE_REVENUECAT_ENTITLEMENT_ID` / server `REVENUECAT_ENTITLEMENT_ID`).
3. **Display name:** Decanti Pro  
4. Save.

If you use a different identifier, tell the agent and set the same value in Codemagic + Supabase secrets.

---

### 2C. Attach App Store product to entitlement

**Where:** **Product catalog** → **Products** (or **Subscriptions**).

1. **+ New** / **Import** from App Store Connect.
2. Select your subscription **`decanti_pro_monthly`** (your Product ID from Part 1C).
3. Link it to entitlement **`pro`**.

RevenueCat should show the product as attached to `pro`.

---

### 2D. Offering (what the app loads at runtime)

**Where:** **Product catalog** → **Offerings**.

1. Open the **default** offering (RevenueCat often creates `default` automatically).
2. **+ Add package** (or edit existing):
   - **Identifier:** e.g. `$rc_monthly` or `monthly` (internal package id).
   - **Package type:** **Monthly**.
   - **Product:** your App Store subscription linked to `pro`.
3. Mark this offering as **Current** if the UI asks.

The app calls `getOfferings()` and picks `current.monthly` or the first available package.

---

### 2E. API keys (Codemagic + Supabase)

**Where:** RevenueCat project → **Project settings** (gear) → **API keys** (or **Apps** → your iOS app → **API keys**).

Copy two keys (different purposes):

| Key | Looks like | Where it goes | Never commit to Git |
|-----|------------|---------------|---------------------|
| **Public Apple SDK key** | `appl_…` | Codemagic `VITE_REVENUECAT_IOS_API_KEY` | Public in app binary is OK |
| **Secret API key** | `sk_…` | Supabase secret `REVENUECAT_SECRET_API_KEY` | Server only |

---

### 2F. Webhook (keeps `profiles.is_pro` in sync)

**Where:** RevenueCat project → **Integrations** → **Webhooks** → **+ Add new configuration**.

1. **Name:** `Supabase Decanti`
2. **URL:**  
   `https://wqkllahjpusemdpznxfb.supabase.co/functions/v1/revenuecat-webhook`
3. **Authorization header:** invent a secret string, e.g.  
   `Bearer 7f3a9c2e-4b1d-4e8a-9f0c-1d2e3f4a5b6c`  
   Copy **the entire value** including `Bearer ` if you use that format.
4. **Environment:** enable **Production** and **Sandbox** (both).
5. **Apps:** this iOS app only (or whole project — either works if events include your app).
6. **Event types:** select all, or at minimum: `INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION`, `CANCELLATION` (optional; access ends on `EXPIRATION`).
7. Save.

You will paste the **same** authorization header value into Supabase in Part 3.

After first deploy, RevenueCat may show delivery logs; failed 401 means Supabase secret mismatch.

---

## Part 3 — Supabase

**Where:** [Supabase Dashboard](https://supabase.com/dashboard) → project **wqkllahjpusemdpznxfb**

### 3A. Edge Function secrets

**Where:** **Project Settings** (gear, bottom left) → **Edge Functions** → **Secrets** (or **Settings → Edge Functions → Manage secrets**).

Add:

| Secret name | Value |
|-------------|--------|
| `REVENUECAT_SECRET_API_KEY` | RevenueCat **secret** key `sk_…` (v2 keys need `REVENUECAT_PROJECT_ID`) |
| `REVENUECAT_PROJECT_ID` | RevenueCat **Project settings → Project ID** (e.g. `proj…` or dashboard id) — **required** if secret key is API v2 |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | **Exact** Authorization header from RevenueCat webhook (Part 2F) |
| `REVENUECAT_ENTITLEMENT_ID` | `pro` (optional if you use default) |

Click **Save** / **Add secret** for each.

**CLI alternative** (from a machine with Supabase CLI logged in and linked to this project):

```bash
cd /path/to/WineRankingApp
npx supabase link --project-ref wqkllahjpusemdpznxfb
npx supabase secrets set REVENUECAT_SECRET_API_KEY=sk_xxxx
npx supabase secrets set REVENUECAT_WEBHOOK_AUTHORIZATION="Bearer your-uuid-here"
npx supabase secrets set REVENUECAT_ENTITLEMENT_ID=pro
```

---

### 3B. Deploy edge functions

**Where (UI):** **Edge Functions** in left sidebar — you should see functions after deploy from CLI.

**Deploy from terminal** (recommended after PR #58 is merged):

```bash
npx supabase functions deploy sync-revenuecat-entitlement --project-ref wqkllahjpusemdpznxfb
npx supabase functions deploy revenuecat-webhook --project-ref wqkllahjpusemdpznxfb
```

**Verify webhook reachable:** RevenueCat sends POST; your function returns 401 without auth, 200 with valid auth and body.

---

### 3C. Confirm Pro flag in database (after test purchase)

**Where:** **Table Editor** → **profiles** → your user row → column **`is_pro`** should become `true`.

---

## Part 4 — Codemagic

**Where:** [Codemagic](https://codemagic.io) → your **WineRankingApp** application.

### 4A. Environment variables (not Team global secrets unless you prefer)

**Where:** Codemagic → **Applications** → **WineRankingApp** → **Environment variables**  
(or **Workflow** → **iOS TestFlight** → **Environment variables** — match how you already set `decanti_env`).

You already use group **`decanti_env`** for Supabase. Add to that group:

| Variable | Value | Secure? |
|----------|--------|---------|
| `VITE_REVENUECAT_IOS_API_KEY` | `appl_…` from RevenueCat | Mark **secure** if available |
| `VITE_REVENUECAT_ENTITLEMENT_ID` | `pro` | No |

Ensure workflow **`ios-testflight`** in `codemagic.yaml` still lists `decanti_env` under `environment.groups`.

---

### 4B. New iOS build

**Where:** Codemagic → **WineRankingApp** → workflow **iOS TestFlight** → **Start new build**  
Branch: **`main`** (after merging RevenueCat PR) or feature branch for testing.

Wait for upload to App Store Connect → **TestFlight** → install on device.

---

## Part 5 — Test on iPhone (Sandbox)

Use a **free** Decanti account (not already Pro via Stripe) so **Subscribe** is visible.

1. **Sandbox Apple ID:** On iOS 18+, often **Settings → Developer → Sandbox Apple Account** (requires Developer Mode). On older iOS, **Settings → App Store** (scroll down) — or sign in when you tap **Subscribe** in TestFlight.
2. Install **Decanti** from TestFlight.
3. Sign in to Decanti with a **real Supabase account** (email or Google after OAuth is production-ready).
4. **Profile** tab → **Subscribe** (label shows App Store price from RevenueCat/StoreKit, not a hardcoded amount).
5. Apple payment sheet should say **[Environment: Sandbox]**.
6. Complete purchase → app should show Pro; **Insights** unlocks.
7. Supabase **profiles.is_pro** = true.
8. **Restore purchases** on a reinstall should still work.

---

## Part 6 — App Store Review (later)

**Where:** App Store Connect → **Decanti** → **Distribution** → **App Store** → version → **App Review Information**

- **Sign-in required:** yes  
- **Demo account:** email/password test user (separate from Sandbox Apple ID).  
- **Notes:** “Decanti Pro is sold via In-App Purchase. For subscription testing, use Sandbox Apple ID on device. Primary login: [demo email].”

Do **not** point reviewers to Stripe for Pro on iOS once IAP is live.

---

## Checklist to report back

- [ ] Paid Apps Agreement **Active**
- [ ] Subscription **Product ID:** `________________`
- [ ] RevenueCat entitlement id: **`pro`** (or other: `________`)
- [ ] Default **Offering** has **monthly** package → product
- [ ] Codemagic: `VITE_REVENUECAT_IOS_API_KEY` set in **decanti_env**
- [ ] Supabase: three RevenueCat **secrets** set
- [ ] Functions **sync-revenuecat-entitlement** and **revenuecat-webhook** deployed
- [ ] RevenueCat webhook shows successful test delivery (or 200 after sandbox purchase)
- [ ] Sandbox purchase tested on TestFlight

---

## App behavior (reference)

- **iOS + SDK key in build:** Profile uses Apple IAP; no Stripe checkout.
- **iOS without SDK key:** falls back to Stripe (not App Review–ready for Pro).
- **Web/Android:** Stripe unchanged.
- RevenueCat **`app_user_id`** = Supabase user UUID when signed in.

See also: `mobile/CODEMAGIC_SETUP.md`, `mobile/STORE_RELEASE.md`.
