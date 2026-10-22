# E2E — ECWC-747 Happy Hour ไม่รวมกับ Promotion

- environment: **local** (http://localhost:3023, DB localhost:3311/ecommerce-db)
- commit: `e71239d`
- เวลา: 2026-10-22T07:33:23.907Z
- ผล: 7/7 ผ่าน

| # | เคส | ผล | หมายเหตุ |
|---|-----|----|----------|
| 1 | add cart lines; promotion line is tagged with promo_id | ✅ |  |
| 2 | flag OFF: cart-preview counts the whole cart (legacy) | ✅ |  |
| 3 | flag ON: cart-preview drops the Company Day line | ✅ |  |
| 4 | flag ON: sales checkout-preview drops the promotion line | ✅ |  |
| 5 | flag ON: submit-order saves 2 cards + discount from non-promotion lines only | ✅ |  |
| 6 | flag ON: cart with only promotion lines gets no Happy Hour | ✅ |  |
| 7 | fixtures removed + config/slot/flag restored | ✅ |  |
