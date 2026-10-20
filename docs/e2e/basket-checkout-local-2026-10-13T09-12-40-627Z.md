# ECWC-655 local integration

Environment: local

2026-10-13T09:12:40.627Z

Commit: 7d22e7b277a096c9e73486fcceae3a03ff3a6aa7

Branch: release-1.53.0

Dirty worktree: true

Changed paths:

- ?? docs/e2e/basket-checkout-local-2026-10-13T09-12-15-377Z.json
- ?? docs/e2e/basket-checkout-local-2026-10-13T09-12-15-377Z.md
- ?? docs/e2e/preorder-local-1791882635505.md
- ?? docs/e2e/promotion-multi-creditor-local-1791882700966.md
- ?? docs/e2e/session-own-shop-local-20261013T091156.md
- ?? docs/e2e/sticker-label-local-1791882666050.md
- ?? docs/new-arrivals.md

- passed: scoped product-cart includes only target paid rows and scoped gifts
- passed: scoped summary uses target120 rather than combined300
- passed: Happy Hour preview carries scope and preserves persisted rows
- passed: abandoning checkout retains basket and unrelated selection
- passed: invalid/missing/foreign scope never falls back to full cart
- passed: transaction failure rolls back order writes and basket cleanup
- passed: successful retry orders target and scoped gift, preserving other rows/checks
- passed: consumed basket retry cannot create another order
- passed: concurrent duplicate submit commits exactly once
- passed: ineligible applied code gift is removed by existing rule after basket purchase
- passed: dedicated fixtures fully removed

local HTTP/MySQL integration only; Kafka delivery, deployed code, mobile device and downstream picking are unverified
