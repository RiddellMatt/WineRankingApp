# Copy cleanup workflow

**Scope:** routine production UI only (what you see on iOS in normal use). Dev-only controls (badge reset, ad debug probe) and misconfigured-build messages (Supabase env, RevenueCat setup errors) stay in the codebase but are **not** in the review list.

1. Open the **Decanti copy cleanup review** canvas from agent chat.
2. For each item, choose **Approve cleanup** or **Keep as-is**. Verdicts persist on the canvas.
3. When finished, click **Apply in agent chat** or tell the agent the approved IDs (e.g. `C4, C11, D1`).
4. The agent implements only approved items on `cursor/copy-cleanup-review-cd41` in a single PR.

Canonical item list: `copy-cleanup-manifest.json` (`visibility: "routine-ui"`).
