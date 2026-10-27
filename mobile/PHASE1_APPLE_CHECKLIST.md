# Phase 1 — Apple Developer + App Store Connect

Use this checklist for your first TestFlight path. Bundle ID everywhere in the repo: **`com.northline.decanti`**.

When a step is done, note the date. **Do not commit `.p8` files or API private keys.**

## Prerequisites

- [ ] Apple Developer Program enrollment **approved** ([developer.apple.com/programs](https://developer.apple.com/programs/)) — $99/year
- [ ] You can sign in to [Apple Developer](https://developer.apple.com/account) and [App Store Connect](https://appstoreconnect.apple.com)

---

## Step 1 — Register the App ID (Identifier)

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Click **+** → choose **App IDs** → **App** → Continue.
3. **Description:** `Decanti` (any label you recognize).
4. **Bundle ID:** choose **Explicit** → enter exactly:
   ```
   com.northline.decanti
   ```
5. **Capabilities** — enable at minimum:
   - [ ] **Sign In with Apple** (required when the app also offers Google sign-in)
6. Register / Save.

**Done when:** App ID `com.northline.decanti` appears in the list.

---

## Step 2 — Create the app in App Store Connect

1. Open [App Store Connect → Apps](https://appstoreconnect.apple.com/apps).
2. Click **+** → **New App**.
3. Fill in:
   - **Platforms:** iOS
   - **Name:** `Decanti` (store name; can change later before release)
   - **Primary language:** English (U.S.) or your preference
   - **Bundle ID:** select `com.northline.decanti` from the dropdown (must exist from Step 1)
   - **SKU:** e.g. `decanti-ios` (internal only, never shown to users)
   - **User Access:** Full Access (default for your account)
4. Create.

**Done when:** You see the Decanti app dashboard in App Store Connect.

---

## Step 3 — Copy the Apple ID (for Codemagic)

This is a **numeric** ID, not the bundle ID.

1. In App Store Connect, open **Decanti**.
2. Go to **General** → **App Information**.
3. Find **Apple ID** (a number like `1234567890`).
4. Save it somewhere safe (password manager). You will paste it into `codemagic.yaml` as `APP_STORE_APPLE_ID` in Phase 2 or when ready.

**Done when:** You have the numeric Apple ID written down.

---

## Step 4 — TestFlight internal testing group

Codemagic submits to a group named **`Internal Testers`** (see `codemagic.yaml`).

1. App Store Connect → **Decanti** → **TestFlight** tab.
2. Under **Internal Testing**, create a group named exactly:
   ```
   Internal Testers
   ```
   (If Apple suggests a default internal group, you can rename or add this name to match the YAML.)
3. Add **yourself** (Apple ID email) as an internal tester when prompted.

**Done when:** Group `Internal Testers` exists and your Apple ID is on it.

---

## Step 5 — App Store Connect API key (for Codemagic in Phase 2)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. Click **+** to generate a key.
3. **Name:** e.g. `Codemagic Decanti`
4. **Access:** **App Manager** (enough for TestFlight upload + signing automation)
5. Download the **`.p8` file once** — Apple will not let you download it again.
6. Note on the same screen:
   - **Issuer ID** (UUID at top of page)
   - **Key ID** (for this key)

Store Issuer ID, Key ID, and `.p8` in your password manager. You will upload them in Codemagic Phase 2 as integration **`decanti_asc`**.

**Done when:** You have Issuer ID, Key ID, and `.p8` saved securely.

---

## Step 6 — Supabase redirect (quick, do now)

So TestFlight auth works on first install:

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add if missing:
   ```
   com.northline.decanti://login-callback
   ```
3. Save.

**Done when:** That URL is in the allow list.

---

## Phase 1 complete — report back

Reply with (no secrets needed):

1. App ID registered? (yes/no)
2. App Store Connect app created? (yes/no)
3. Numeric **Apple ID** — either “I have it” or paste the number (it’s not secret, but optional)
4. **Internal Testers** group ready? (yes/no)
5. API key created and `.p8` saved? (yes/no)
6. Supabase redirect added? (yes/no)

Then we start **Phase 2 — Codemagic** (connect repo, signing, `decanti_env`, first build).

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Bundle ID not in dropdown when creating app | Finish Step 1 first; wait a few minutes and refresh |
| No TestFlight tab | App record may still be processing; try again in ~15 minutes |
| Can’t enable Sign in with Apple | Edit the App ID → Capabilities → Sign In with Apple |
| Lost `.p8` | Revoke key and create a new API key; update Codemagic in Phase 2 |
