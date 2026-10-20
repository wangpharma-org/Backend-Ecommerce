# ECWC-655 local integration

Environment: local

2026-10-03T13:38:38.478Z

Commit: 5f339399f4713e7ed7564db8fa00a85eef6391cc

Branch: feature/ECWC-655

Dirty worktree: false

Changed paths:

none

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
