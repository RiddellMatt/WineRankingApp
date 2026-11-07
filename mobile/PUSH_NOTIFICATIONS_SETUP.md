# Push notifications setup — iOS + Android (step by step)

Decanti project constants:

| Item | Value |
|------|--------|
| **Supabase project** | `wqkllahjpusemdpznxfb` |
| **Supabase URL** | `https://wqkllahjpusemdpznxfb.supabase.co` |
| **Bundle / package ID** | `com.northline.decanti` |

Push plumbing in the app is already merged. Until you finish the steps below, the **Social bell** still works; **lock-screen push** will not.

---

## Overview (do in this order)

| Step | Where | Outcome |
|------|--------|---------|
| **A** | Supabase SQL Editor | Tables + prefs column |
| **B** | Terminal | Deploy 2 Edge Functions |
| **C** | Supabase Edge secrets | FCM + APNs + webhook secret |
| **D** | Supabase Database Webhook | Each new `notifications` row triggers push |
| **E** | Firebase Console | Android FCM + `google-services.json` in repo |
| **F** | Apple Developer + Xcode | APNs key + Push capability |
| **G** | Codemagic / device | Rebuild native apps, test on real phones |

---

## Part A — Database (Supabase)

**Where:** [Supabase Dashboard](https://supabase.com/dashboard/project/wqkllahjpusemdpznxfb) → **SQL Editor** (left sidebar) → **New query**.

1. Open `supabase/migrations/20261107_push_device_tokens.sql` from the repo (or copy from GitHub `main`).
2. Paste the full file into the editor.
3. Click **Run**.

**Verify:** **Table Editor** → you should see:

- Table `push_device_tokens`
- On `profiles`, column `push_notification_prefs` (JSON)

---

## Part B — Deploy Edge Functions

**Where:** Your machine, in the `WineRankingApp` repo folder (same as RevenueCat deploy in `mobile/REVENUECAT_SETUP.md`).

### B1. Log in and link (once per machine)

```bash
cd /path/to/WineRankingApp
npx supabase login
npx supabase link --project-ref wqkllahjpusemdpznxfb
```

### B2. Deploy

```bash
npx supabase functions deploy register-push-token --project-ref wqkllahjpusemdpznxfb
npx supabase functions deploy dispatch-notification-push --project-ref wqkllahjpusemdpznxfb
```

**Verify:** Dashboard → **Edge Functions** (left sidebar). You should see:

- `register-push-token`
- `dispatch-notification-push`

(Plus your existing functions like `revenuecat-webhook`, etc.)

---

## Part C — Edge Function secrets

**Where:** Dashboard → **Project Settings** (gear, bottom left) → **Edge Functions** → **Secrets**  
(or **Edge Functions** → **Manage secrets** — UI label may vary).

Add each secret **by exact name** (case-sensitive):

### C1. Webhook auth (do this first)

| Secret name | What to put |
|-------------|-------------|
| `PUSH_DISPATCH_SECRET` | Long random string you invent (e.g. `openssl rand -hex 32`). **Same value** goes on the Database Webhook header in Part D. |

### C2. Android — Firebase Cloud Messaging

| Secret name | What to put |
|-------------|-------------|
| `FCM_SERVICE_ACCOUNT_JSON` | **Entire** JSON file from Firebase, as **one line** (minified). See Part E step E4. |

Do **not** add line breaks inside the JSON when pasting into Supabase; minify it first.

### C3. iOS — Apple Push Notification service (APNs)

Create an APNs auth key in Part F first, then add:

| Secret name | What to put |
|-------------|-------------|
| `APNS_KEY_ID` | 10-character Key ID (e.g. `AB12CD34EF`) |
| `APNS_TEAM_ID` | Your Apple **Team ID** (Membership details) |
| `APNS_KEY_P8` | Full text of the `.p8` file (starts with `-----BEGIN PRIVATE KEY-----` or paste raw key body — the function accepts both) |
| `APNS_BUNDLE_ID` | `com.northline.decanti` |
| `APNS_PRODUCTION` | Start with `false` for **TestFlight / debug** devices; set `true` for **App Store** production pushes |

**CLI alternative** (from linked repo):

```bash
npx supabase secrets set PUSH_DISPATCH_SECRET="your-random-secret" --project-ref wqkllahjpusemdpznxfb
# Paste JSON carefully; prefer Dashboard UI for FCM_SERVICE_ACCOUNT_JSON
```

After saving secrets, **redeploy** `dispatch-notification-push` if Supabase prompts you to (some projects require redeploy to pick up new secrets).

---

## Part D — Database webhook (notifications → push)

This calls `dispatch-notification-push` whenever a row is inserted into `notifications` (friend request, reaction, etc.).

**Where:** Dashboard → **Database** → **Webhooks**  
If you do not see Webhooks under Database, try **Integrations** → **Database Webhooks** or **Project Settings** → **Integrations**.

1. **Create a new hook**
2. **Name:** `notifications-push-dispatch` (any name)
3. **Table:** `notifications` (schema `public`)
4. **Events:** enable **Insert** only
5. **Type:** HTTP Request (Supabase Edge Function URL or HTTPS URL)
6. **URL:**

   ```
   https://wqkllahjpusemdpznxfb.supabase.co/functions/v1/dispatch-notification-push
   ```

7. **HTTP method:** `POST`
8. **HTTP headers** (add one header):

   | Header name | Header value |
   |-------------|--------------|
   | `x-push-dispatch-secret` | (same string as `PUSH_DISPATCH_SECRET`) |
   | `Content-Type` | `application/json` |

9. **Payload:** use the default webhook payload (must include the new row as `record`).

**Verify:** After setup, send a friend request between two test accounts. Then:

- Dashboard → **Edge Functions** → `dispatch-notification-push` → **Logs**
- You should see invocations; if tokens exist, `sent: true` or FCM/APNs errors explaining missing config.

---

## Part E — Firebase (Android)

Capacitor Android push needs **Firebase Cloud Messaging**. The app Gradle file already applies the Google Services plugin **when** `android/app/google-services.json` exists.

### E1. Create or open Firebase project

**Where:** [Firebase Console](https://console.firebase.google.com/)

- Use an existing project or **Add project** (name e.g. `Decanti`).

### E2. Add Android app

1. Project overview → **Add app** → **Android**
2. **Android package name:** `com.northline.decanti` (must match exactly)
3. Register app (SHA-1 optional for now; add later for some Google features)
4. **Download `google-services.json`**

### E3. Put file in the repo

Save as:

```
WineRankingApp/android/app/google-services.json
```

Commit and push so **Codemagic** builds include it (this file is not secret; it identifies the Firebase project).

### E4. Service account for the Edge Function

**Where:** Firebase → **Project settings** (gear) → **Service accounts**

1. Click **Generate new private key**
2. Save the downloaded JSON locally
3. Minify to one line (no pretty-print), e.g. in a terminal:

   ```bash
   jq -c . your-downloaded-key.json
   ```

4. Paste that **entire one-line JSON** into Supabase secret `FCM_SERVICE_ACCOUNT_JSON` (Part C2).

### E5. Enable FCM API (if prompted)

**Where:** [Google Cloud Console](https://console.cloud.google.com/) → same project as Firebase → **APIs & Services** → enable **Firebase Cloud Messaging API** (often already on).

### E6. Rebuild Android

```bash
npm run cap:sync
```

Then run a new **Codemagic** Android build (or local release build).

---

## Part F — Apple (iOS / APNs)

### F1. Create APNs authentication key

**Where:** [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Keys**

1. **+** to create a key
2. Name: e.g. `Decanti APNs`
3. Enable **Apple Push Notifications service (APNs)**
4. Continue → Register → **Download** the `.p8` file (only once)
5. Note **Key ID** and your **Team ID** (Membership page)

Add secrets in Part C3.

### F2. Enable Push in Xcode

**Where:** Open `ios/App/App.xcworkspace` in Xcode (after `npm run cap:sync`).

1. Select **App** target → **Signing & Capabilities**
2. **+ Capability** → **Push Notifications**
3. (Optional) **Background Modes** → check **Remote notifications**

### F3. Provisioning for Codemagic

Push must be allowed on the **App ID** and in the **provisioning profile** Codemagic uses.

**Where:** Developer portal → **Identifiers** → `com.northline.decanti` → ensure **Push Notifications** is enabled.

Regenerate or refresh the **distribution** profile in Codemagic / Apple so it includes push.

### F4. `APNS_PRODUCTION` vs TestFlight

| Build / test | Suggested `APNS_PRODUCTION` |
|--------------|----------------------------|
| Xcode debug, early TestFlight | `false` (sandbox APNs) |
| App Store production | `true` |

If pushes never arrive on TestFlight, try flipping this secret and redeploying `dispatch-notification-push`.

### F5. Rebuild iOS

New **Codemagic** iOS build after capability + profile updates.

**Note:** iOS **Simulator** does not receive real remote push — use a physical iPhone.

---

## Part G — Test on devices

### G1. In the app

1. Install **signed-in** native build (not PWA, not offline mode).
2. Accept the OS **notification permission** prompt (or enable in iOS Settings → Decanti → Notifications).
3. Optional: **Profile → Edit** → **Push notifications** — confirm toggles (friend requests on by default).

### G2. Confirm token registered

**Where:** Supabase → **Table Editor** → `push_device_tokens`

After opening the app signed in, you should see a row with your `user_id`, `platform` (`ios` or `android`), and a long `token`.

If empty:

- Check you are on a **real device**, signed into **cloud** (not “Continue without account”)
- Edge Functions → `register-push-token` → Logs for errors

### G3. End-to-end

1. Account **A** and **B**, both with tokens registered
2. **B** sends friend request to **A**
3. **A** should get:
   - In-app bell entry (existing)
   - **Push** on lock screen if **A** backgrounded the app

Tap push → app opens **Social** (manage tab for requests).

### G4. If push fails

| Symptom | Check |
|---------|--------|
| No webhook log | Part D webhook on `notifications` INSERT |
| `skipped: prefs` | Profile → push toggles; `enabled` and category for that type |
| `skipped: no tokens` | Part G2 |
| `FCM not configured` | Part C2 + E4 |
| `APNs not configured` | Part C3 + F1 |
| FCM 404/invalid token | Reinstall app, re-register; stale tokens are deleted on error |

---

## Part H — Codemagic checklist

No new Codemagic env vars are required for push **secrets** (those live in Supabase only).

You **must**:

1. Commit `android/app/google-services.json` after Part E3
2. Run builds that include the merged native code (`@capacitor/push-notifications`)
3. Use iOS profiles with **Push Notifications** enabled

Existing `VITE_SUPABASE_*` vars stay the same (`mobile/CODEMAGIC_SETUP.md`).

---

## Quick reference — URLs

| Item | URL |
|------|-----|
| Supabase project | https://supabase.com/dashboard/project/wqkllahjpusemdpznxfb |
| Register token function | `https://wqkllahjpusemdpznxfb.supabase.co/functions/v1/register-push-token` |
| Dispatch function | `https://wqkllahjpusemdpznxfb.supabase.co/functions/v1/dispatch-notification-push` |

---

## What is not push yet

These stay **in-app bell only** until you add notification types later:

- Friend logged / rated a wine  
- Your level-up / streak / monthly challenge  

Same webhook pattern applies when you emit new `notifications` rows.
