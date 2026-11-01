# RevenueCat + App Store — Decanti Pro (iOS)

Decanti Pro on **iOS** uses **Apple In-App Purchase** via [RevenueCat](https://www.revenuecat.com/). **Android and web** can keep **Stripe** until you add Google Play billing.

Server entitlement remains **`profiles.is_pro`** (same as Stripe webhooks).

---

## What you need to send / configure

### 1. App Store Connect (you)

1. **App Store Connect → Your app → Subscriptions**
   - Create a **Subscription Group** (e.g. `Decanti Pro`).
   - Add an auto-renewable subscription, e.g. **Decanti Pro Monthly** at **$3.99/month**.
   - Note the **Product ID** (example: `decanti_pro_monthly`) — must match RevenueCat.

2. **Paid Applications Agreement** and banking/tax must be active (Apple requirement to sell).

3. **Sandbox tester** (Users and Access → Sandbox) for TestFlight/App Review purchases.

### 2. RevenueCat project (you)

1. Sign up / create project **Decanti**.
2. **Apps → Add app → Apple App Store**
   - Bundle ID: `com.northline.decanti`
   - Connect App Store Connect (API key / shared secret per RevenueCat wizard).

3. **Product catalog**
   - Entitlement identifier: **`pro`** (or tell us a different id — must match env below).
   - Attach your App Store subscription product to entitlement **`pro`**.

4. **Offerings**
   - Default offering with a **monthly** package pointing at that product (app loads `offerings.current.monthly` or first package).

5. **API keys** (Project settings)
   - **Apple public SDK key** → give to agent for Codemagic `VITE_REVENUECAT_IOS_API_KEY`.
   - **Secret API key** (starts with `sk_`) → Supabase secret **`REVENUECAT_SECRET_API_KEY`** (server only).

6. **Webhooks**
   - URL: `https://wqkllahjpusemdpznxfb.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: generate a long random string (e.g. `Bearer <uuid>`) → Supabase secret **`REVENUECAT_WEBHOOK_AUTHORIZATION`** (exact same value RevenueCat sends).
   - Events: at least `INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION` (or “all events”).
   - Enable **production** and **sandbox**.

### 3. Codemagic / build env (you)

In **decanti_env** (or app env vars):

| Variable | Example | Notes |
|----------|---------|--------|
| `VITE_REVENUECAT_IOS_API_KEY` | `appl_…` | Public Apple SDK key |
| `VITE_REVENUECAT_ENTITLEMENT_ID` | `pro` | Optional; default `pro` |

Rebuild iOS after adding keys (`npm run cap:sync` in CI).

### 4. Supabase Edge Function secrets (you)

```bash
npx supabase secrets set REVENUECAT_SECRET_API_KEY=sk_...
npx supabase secrets set REVENUECAT_WEBHOOK_AUTHORIZATION="Bearer your-secret"
npx supabase secrets set REVENUECAT_ENTITLEMENT_ID=pro   # optional

npx supabase functions deploy sync-revenuecat-entitlement
npx supabase functions deploy revenuecat-webhook
```

---

## App behavior (after merge)

- **iOS + SDK key present:** Profile → **Subscribe** uses StoreKit; **Restore purchases**; **Manage in App Store** (no Stripe checkout).
- **Sign-in:** RevenueCat `app_user_id` = Supabase user UUID (webhooks + sync function).
- **After purchase:** Client calls `sync-revenuecat-entitlement` so `is_pro` updates immediately; webhooks keep renewals/expiry in sync.
- **Stripe Pro on web/Android:** Unchanged; IAP expiry does **not** revoke Pro if `stripe_subscription_id` is set.

---

## Test checklist

1. Sandbox Apple ID on device.
2. Sign in to Decanti with a real Supabase account.
3. Profile → Subscribe → complete Sandbox purchase.
4. Confirm Insights unlock and `profiles.is_pro = true` in Supabase.
5. Restore purchases on a fresh install.
6. App Review notes: “Pro via In-App Purchase; use Sandbox Apple ID.”

---

## Info for Matt to paste back when ready

When setup is done, reply with:

- [ ] App Store subscription **Product ID**
- [ ] RevenueCat **entitlement id** (if not `pro`)
- [ ] Confirmation that **default offering** has a monthly package
- [ ] `VITE_REVENUECAT_IOS_API_KEY` added to Codemagic (you can paste in secure channel — not in GitHub)
- [ ] Supabase secrets set + functions deployed
- [ ] Webhook URL live (RevenueCat dashboard shows successful delivery on test)

No need to commit secret keys to the repo.
