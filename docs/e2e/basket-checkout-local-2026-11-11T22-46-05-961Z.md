# ECWC-655 local integration

Environment: local

2026-11-11T22:46:05.961Z

Commit: 8574c24ab7a2a0e661d89d25712d892f50bc16d2

Branch: 

Dirty worktree: true

Changed paths:

- ?? docs/e2e/basket-checkout-local-2026-11-09T12-30-59-440Z.json
- ?? docs/e2e/basket-checkout-local-2026-11-09T12-30-59-440Z.md
- ?? docs/e2e/cart-own-shop-local-2026-11-09T12-28-30-777Z.md
- ?? docs/e2e/cart-own-shop-local-2026-11-11T22-35-19-880Z.md
- ?? docs/e2e/checkout-preview-local-20261109-1929.md
- ?? docs/e2e/checkout-preview-local-20261112-0532.md
- ?? docs/e2e/checkout-preview-local-20261112-0536.md
- ?? docs/e2e/current-promotions-local-20261109-1931.md
- ?? docs/e2e/current-promotions-local-20261112-0532.md
- ?? docs/e2e/current-promotions-local-20261112-0536.md
- ?? docs/e2e/customer-cart-local-20261109-1929.md
- ?? docs/e2e/customer-cart-local-20261112-0532.md
- ?? docs/e2e/customer-cart-local-20261112-0536.md
- ?? docs/e2e/customer-promotions-local-20261109-1931.md
- ?? docs/e2e/customer-promotions-local-20261112-0531.md
- ?? docs/e2e/feature-flag-admin-local-2026-11-09T12-31-26-554Z.md
- ?? docs/e2e/feature-flag-admin-local-2026-11-11T22-35-37-396Z.md
- ?? docs/e2e/internal-hotdeal-gifts-local-20261111T223553.md
- ?? docs/e2e/order-list-ownership-local-20261109-1929.md
- ?? docs/e2e/order-list-ownership-local-20261112-0532.md
- ?? docs/e2e/order-list-ownership-local-20261112-0538.md
- ?? docs/e2e/order-status-table-local-20261112-0532.md
- ?? docs/e2e/order-status-table-local-20261112-0538.md
- ?? docs/e2e/sales-cart-session-local-20261109-1929.md
- ?? docs/e2e/sales-cart-session-local-20261112-0532.md
- ?? docs/e2e/sales-cart-session-local-20261112-0536.md

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
