# Archive

Moved here from the repository root on 2026-11-11 so the root shows only what
a new engineer needs. **The code and `supabase/migrations/` are the source of
truth**; everything here may be out of date.

- `*.md`: implementation and fix notes written during development.
- `sql/`: one-off SQL fixes and checks. **Not migrations: never run them.**
  Database changes go through migrations (engineering handbook, Change and
  release policy).
- `design/`: QR template drafts that were in `temp/`.
- `scripts/`: one-off scripts, including ones that ran SQL against the
  database directly. Kept for reference only; do not run.

Also removed at the same time (still in git history): the earlier plain
JavaScript admin portal (`js/`, `modals/`, five root HTML pages) and two
unused design files that were served publicly from `public/`
(`Batch_QR_frame.psd`, 17.8 MB, and `Batch_QR_frame_with_qr_filled.png`,
7.7 MB). Design files belong in the shared drive.
