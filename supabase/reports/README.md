# Supabase reports (Decanti)

Copy **one section at a time** from `tester-activity-and-scans.sql` into **Supabase Dashboard → SQL Editor**. The editor runs as admin, so these aggregates work across all testers.

| # | Report | Use it to |
| --- | --- | --- |
| 1 | Tester scorecard | Rank testers by last wine added, scan success, Pro, push |
| 2 | Weekly active testers | WAU-style trend from wines + AI scans |
| 3 | Daily scan volume | Success %, latency p50/p90 per day |
| 4 | Scan errors | error_code / model breakdown |
| 5 | Correction rate | Who edits AI fields after label scan |
| 6 | Quota vs events | Compare `label_scan_usage` / `menu_scan_usage` to `ai_scan_events` |
| 7 | Cold testers | Nudge list (no wine / stale sign-in) |
| 8 | Social engagement | Friends, reactions, passport |
| 9 | Scan drill-down | Last 7 days row-level (debug) |

**Optional filters:** Uncomment the `CONFIG` block at the top of the SQL file and join `filtered_users` when you only want a TestFlight allowlist.

**Export:** After a query runs, use **Download CSV** in the SQL Editor for sharing with the team.

**Schema:** `ai_scan_events` requires migration `supabase/migrations/20261114_ai_scan_metrics.sql` (and deployed Edge Functions that call `recordScanEvent`).