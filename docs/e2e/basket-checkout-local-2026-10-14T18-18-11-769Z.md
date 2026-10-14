# ECWC-655 local integration

Environment: local

2026-10-14T18:18:11.769Z

Commit: c2b6e1500d0945fcc45fad5be8e75b5292a9a7f3

Branch: release-1.54.0

Dirty worktree: true

Changed paths:

- ?? docs/e2e/hide-free-gift-search-local-20261014T181518.md
- ?? docs/e2e/preorder-local-1792001866233.md
- ?? docs/e2e/promotion-multi-creditor-local-1792001706668.md
- ?? docs/e2e/session-own-shop-local-20261014T181511.md
- ?? docs/e2e/sticker-label-local-1792001735807.md
- ?? docs/e2e/store-visibility-local-1792001698263.md

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
