# SSN0-171 Cart Access E2E Report

- environment: **local** (local)
- BASE_URL: http://localhost:3402/api
- commit: e0457cd
- run at: 2026-10-20T06:47:27.584Z
- customer setup: two distinct member codes (identifiers omitted)
- result: **6/6 passed**

| # | step | status | result | detail |
|---|------|--------|--------|--------|
| 1 | Customer A can read their own ordinary cart count | 200 | PASS | expected HTTP 200 |
| 2 | Customer A cannot read customer B ordinary cart count | 403 | PASS | expected HTTP 403 |
| 3 | Customer A cannot add a product to customer B cart | 403 | PASS | expected HTTP 403 |
| 4 | Customer A cannot check all products in customer B cart | 403 | PASS | expected HTTP 403 |
| 5 | Customer A cannot delete a product from customer B cart | 403 | PASS | expected HTTP 403 |
| 6 | Customer A cannot check a product in customer B cart | 403 | PASS | expected HTTP 403 |