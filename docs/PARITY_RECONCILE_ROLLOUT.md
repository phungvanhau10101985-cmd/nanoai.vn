# Parity reconcile rollout

Migrations are schema-only. Always run the report first; only `--apply` changes
historical rows. The apply phase uses one database transaction and installs
deferred unique indexes only after reconciliation succeeds.

## Local (Windows CMD)

```bat
node scripts/pg-run-sql-file.mjs db/migrations/20260921170000_partner_checkout_stock_payment_parity.sql --apply
node scripts/pg-run-sql-file.mjs db/migrations/20260921180000_partner_order_schema_audit_parity.sql --apply
node scripts/reconcile-partner-order-schema-parity.mjs
node scripts/reconcile-partner-order-schema-parity.mjs --apply
node scripts/reconcile-partner-order-schema-parity.mjs
```

Review the first report before running the fourth command. The final report
must show zero legacy hold rows, mismatches, and duplicate rows.

## VPS

```bash
cd /var/www/Thu-do-online
node scripts/pg-run-sql-file.mjs db/migrations/20260921170000_partner_checkout_stock_payment_parity.sql --apply
node scripts/pg-run-sql-file.mjs db/migrations/20260921180000_partner_order_schema_audit_parity.sql --apply
node scripts/reconcile-partner-order-schema-parity.mjs
node scripts/reconcile-partner-order-schema-parity.mjs --apply
node scripts/reconcile-partner-order-schema-parity.mjs
```

Duplicate payment webhook rows are preserved in
`messaging_partner_parity_reconcile_archive` before removal from the active
idempotency ledger.
