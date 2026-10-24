# TrashDrop admin site — rules for AI assistants and contributors

## Protected: TrashDrop Digital Bin Pricing
Digital bin prices and promotions follow the accepted **TrashDrop Digital Bin
Pricing**, specified in `docs/DIGITAL_BIN_PRICING.md` of the household app
repository (apaloo/TrashDrop-Mobile-User-Domestic). This site only checks
fees against it: `feeBreakdown` in `src/utils/pickupRequestUtils.js` (request
details) and rule 9 of `run_alert_rules()`
(`supabase/migrations/20261107_fee_mismatch_pricing.sql`).

Do not change those checks, or anything that writes digital bin prices or
promotions, without the owner's written approval in the pull request. Keep them
in step with the specification, and never weaken the fee tests in
`src/utils/__tests__/pickupRequestUtils.test.js` to make a change pass.
