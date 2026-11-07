# Push notifications — iOS (APNs) + Android (FCM)

Decanti uses **one Supabase pipeline** for both platforms:

| Platform | Token source | Server send |
|----------|----------------|-------------|
| **iOS** | Capacitor `PushNotifications` → **APNs device token** | `dispatch-notification-push` → Apple HTTP/2 |
| **Android** | Capacitor `PushNotifications` → **FCM registration token** | `dispatch-notification-push` → Firebase Cloud Messaging v1 |

In-app Social **bell** rows are unchanged; push is an extra channel when the app is backgrounded.

---

## 1. Database

Run migration `supabase/migrations/20261107_push_device_tokens.sql` (or full SQL refresh in Supabase SQL Editor).

Creates:

- `push_device_tokens`
- `profiles.push_notification_prefs` (JSON toggles)

---

## 2. Edge functions

Deploy:

- `register-push-token` — client upserts device token after sign-in
- `dispatch-notification-push` — sends push for one notification row

### Secrets (Supabase → Edge Functions → Secrets)

**Android (FCM)** — required for Google Play builds:

| Secret | Value |
|--------|--------|
| `FCM_SERVICE_ACCOUNT_JSON` | Full JSON of Firebase **service account** with Firebase Cloud Messaging API enabled (single line or minified) |

In Firebase Console: Project settings → Service accounts → Generate new private key. Add Android app with package `com.northline.decanti` and place `google-services.json` in `android/app/` (see [Capacitor FCM](https://capacitorjs.com/docs/guides/push-notifications-firebase)).

**iOS (APNs)** — required for TestFlight/App Store:

| Secret | Value |
|--------|--------|
| `APNS_KEY_ID` | Key ID from Apple Developer → Keys |
| `APNS_TEAM_ID` | Team ID |
| `APNS_KEY_P8` | Contents of the `.p8` auth key (or PEM) |
| `APNS_BUNDLE_ID` | `com.northline.decanti` (default) |
| `APNS_PRODUCTION` | `true` for App Store; `false` for sandbox/TestFlight if needed |

**Webhook auth (recommended):**

| Secret | Value |
|--------|--------|
| `PUSH_DISPATCH_SECRET` | Random string; must match webhook header |

---

## 3. Database webhook (fan-out)

Supabase Dashboard → **Database** → **Webhooks** → Create:

- **Table:** `public.notifications`
- **Events:** Insert
- **URL:** `https://<project-ref>.supabase.co/functions/v1/dispatch-notification-push`
- **HTTP headers:** `x-push-dispatch-secret: <PUSH_DISPATCH_SECRET>`
- **Payload:** default (includes `record`)

Every in-app notification row (friend request, reaction, badge, journey) can trigger a push when prefs allow.

---

## 4. iOS native project

1. Xcode → App target → **Signing & Capabilities** → **+ Push Notifications**
2. Enable **Background Modes** → Remote notifications (optional; for silent refresh later)
3. Codemagic / local: provisioning profile must include push
4. After `npm run cap:sync`, build and run on device (simulator does not deliver remote push)

---

## 5. Android native project

1. Firebase project with Android app `com.northline.decanti`
2. Download `google-services.json` → `android/app/google-services.json`
3. Ensure `android/build.gradle` / app Gradle apply Google services plugin (Capacitor Android 8 template may need `com.google.gms:google-services` — follow Capacitor push + Firebase guide)
4. API 33+: `POST_NOTIFICATIONS` is in `AndroidManifest.xml`; runtime prompt handled by Capacitor

---

## 6. App behavior

- On sign-in (native only), app requests permission and calls `register-push-token`
- **Profile → Edit → Push notifications** toggles categories (defaults: requests on, friend milestones off)
- Tap push → opens **Social** tab (`com.northline.decanti://friends?tab=manage` or `feed`)

---

## 7. Verify

1. Deploy functions + secrets + webhook + migration
2. Two test accounts, become friends
3. Send friend request from B → A should get push on physical devices (A foreground may only show in-app bell on iOS)

Check **Edge Functions → Logs** for `dispatch-notification-push` and FCM/APNs errors.

---

## Roadmap (not in v1 push)

- Friend logged a wine (throttled)
- Level-up / streak / monthly challenge
- Quiet hours

These reuse the same `notifications` + webhook pattern once you emit rows.
