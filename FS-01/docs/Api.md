# API documentation

Base URL (local): `http://localhost:5000/api`
Base URL (production): `https://multi-vendor-e-commerce-0l2j.onrender.com/api/health/api`

## Conventions

- Requests and responses are JSON, except image upload (multipart) and invoices (PDF).
- **All money values are integer paise** (79900 means Rs. 799.00). The only exception is the search filters `minPrice` and `maxPrice`, which are in rupees.
- Protected routes need the header `Authorization: Bearer <token>`. The token comes from register or login and expires after 1 day.
- Errors always look like this:

```json
{ "error": "Human readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input or a rule was broken |
| 401 | Not logged in, or token invalid or expired |
| 403 | Logged in, but this role (or an unapproved vendor) cannot do this |
| 404 | Not found, or not yours |
| 409 | Conflict (duplicate, out of stock, already paid) |
| 500 | Server error (details only in server logs) |

Roles: **P** = public, **C** = customer, **V** = approved vendor, **VR** = any vendor (applied or not), **A** = admin.

---

## Health

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/health` | P | Returns `{ "status": "ok", "time": "..." }` |

## Auth

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | P | Create an account. Role can be `CUSTOMER` (default) or `VENDOR`. `ADMIN` is rejected. |
| POST | `/auth/login` | P | Returns `{ user, token }` |
| GET | `/auth/me` | any | Current user (with vendor profile if any) |

```json
// POST /auth/register
{ "name": "Amit", "email": "amit@test.com", "password": "Test@1234", "role": "CUSTOMER" }

// response 201
{ "user": { "id": 4, "name": "Amit", "email": "amit@test.com", "role": "CUSTOMER" }, "token": "eyJ..." }
```

Rules: password at least 8 characters. Duplicate email returns 409. Wrong email or password returns the same 401 message (so an attacker cannot tell which emails are registered).

## Vendors

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/vendors/apply` | VR | Apply for a store. Status starts as `PENDING`. A second application returns 409. |
| GET | `/vendors/me` | VR | Own vendor profile (404 if never applied) |

```json
// POST /vendors/apply
{ "storeName": "Ravi Gadgets", "description": "Accessories" }
```

## Products

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/products/:id` | P | Public product with images, category and store name. Soft-deleted products return 404. |
| GET | `/products/mine/list` | V | Own products (includes removed ones, check `isActive`) |
| POST | `/products` | V | Create a product |
| PUT | `/products/:id` | V | Update own product (any subset of fields) |
| DELETE | `/products/:id` | V | Soft delete (sets `isActive` to false). Returns 204. |
| POST | `/products/:id/images` | V | Upload images. Multipart form, field name `images`, up to 5 files |

```json
// POST /products
{ "title": "Wireless Mouse", "description": "Ergonomic 2.4GHz mouse",
  "pricePaise": 79900, "stock": 50, "categoryId": 1 }
```

Image rules: jpg, png or webp only, 3 MB per file. Another vendor's product returns 404 (ownership is enforced by filtering every query on the vendor's own id). A vendor that is not `APPROVED` gets 403.

## Search

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/search` | P | Search products in Elasticsearch (falls back to PostgreSQL if Elasticsearch is unreachable) |

| Query parameter | Description |
|---|---|
| `q` | Text. Fuzzy, so `mouce` finds `mouse`. Title counts 3 times more than description. |
| `categoryId` | Category filter |
| `minPrice`, `maxPrice` | Price range in rupees |
| `sort` | `price_asc`, `price_desc`, `newest`. Default is best match (or newest when no `q`). |
| `page`, `limit` | Default 1 and 12. Limit is at most 50. |

```json
// GET /search?q=mouse&sort=price_asc
{ "total": 1, "page": 1, "pages": 1,
  "items": [ { "id": 1, "title": "Wireless Mouse", "pricePaise": 79900, "stock": 45,
               "storeName": "Ravi Gadgets", "imageUrl": "https://.../mouse.png" } ] }
```

Results are cached in Redis for 30 seconds. The response header `X-Cache` shows `HIT` or `MISS`. If Elasticsearch could not be reached, the response header `X-Search` is set to `postgres-fallback` (no fuzzy matching in that case, but the site still works). An invalid parameter returns 400.

## Cart (customer only, stored in Redis)

| Method | Path | Description |
|---|---|---|
| GET | `/cart` | Items with fresh prices (read from PostgreSQL, never from the cart itself) and subtotal |
| POST | `/cart/items` | Add `{ productId, quantity }` (quantity 1 to 10). Adds to the existing quantity. |
| PATCH | `/cart/items/:productId` | Set `{ quantity }` |
| DELETE | `/cart/items/:productId` | Remove one item |
| DELETE | `/cart` | Empty the cart (204) |

A quantity above stock returns 409 `Only N in stock`. Vendors and admins get 403. Anonymous users get 401.

## Orders

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/orders/checkout` | C | Turn the cart into an order |
| GET | `/orders` | C | My orders with items |
| GET | `/orders/:id` | C | One of my orders |
| GET | `/orders/:id/invoice` | C | PDF invoice (only for PAID orders, else 409) |
| GET | `/orders/vendor/items` | V | My order items from **paid** orders only |
| PATCH | `/orders/items/:id/status` | V | Move an item to the next status |

```json
// POST /orders/checkout
{ "address": "12 MG Road, Lucknow 226001", "couponCode": "DIWALI20" }
```

Checkout runs in one database transaction: it reduces stock with a conditional update (so two customers buying the last item at once cannot both succeed — one gets 409), claims the coupon, and creates the order with commission snapshots per item. The order starts with `paymentStatus: "CREATED"`.

Status changes allowed: `PLACED` to `PACKED` or `CANCELLED`, `PACKED` to `SHIPPED`, `SHIPPED` to `DELIVERED`. Skipping a step, or any other vendor's item, returns 400 or 404. Cancelling an item returns its stock.

```json
// PATCH /orders/items/1/status
{ "status": "PACKED" }
```

## Payments (customer only, except the webhook)

| Method | Path | Description |
|---|---|---|
| POST | `/payments/create` | `{ orderId }`. Creates the Razorpay order. Amount comes from the database, never from the client. Returns `razorpayOrderId`, `amountPaise`, `keyId`. |
| POST | `/payments/verify` | Body: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. Recomputes the HMAC-SHA256 signature, marks the order PAID and creates vendor payouts. |
| POST | `/payments/cancel` | `{ orderId }`. Cancels an unpaid order, returns stock and the coupon use. Paid orders return 409. |
| POST | `/payments/webhook` | Called by Razorpay (event `payment.captured`). No login. The `x-razorpay-signature` header is checked against the raw request body. |

A wrong signature returns 400. Another customer's payment returns 404. Verifying twice is safe (idempotent via a conditional update) and creates only one payout even if both the browser callback and the webhook arrive.

## Reviews

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/products/:id/reviews` | P | `{ average, count, reviews }` |
| POST | `/products/:id/reviews` | C | `{ rating (1 to 5), comment? }` |

Allowed only after the customer actually received the product (an item in state `DELIVERED` on a paid order), otherwise 403. A second review of the same product by the same user returns 409.

## Coupons

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/coupons/preview` | C | `{ code }`. Shows the discount on the current cart without using up the coupon. |
| POST | `/coupons` | A | `{ code, discountPercent (1 to 90), maxUses, expiresAt? }` |
| GET | `/coupons` | A | All coupons with usage counts |

Codes are case-insensitive. The platform pays the discount, so vendor earnings are unaffected by a coupon. Invalid, expired or used-up coupons return 400. A duplicate code returns 409.

## Admin

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/admin/vendors?status=PENDING` | A | List vendors, optional status filter |
| PATCH | `/admin/vendors/:id` | A | `{ status?, commissionPercent? }`. Status is `PENDING`, `APPROVED`, `REJECTED` or `SUSPENDED`. Commission is 0 to 50. |
| GET | `/admin/analytics` | A | Platform-wide numbers |

```json
// GET /admin/analytics
{ "paidOrders": 2, "revenuePaise": 319600, "commissionPaise": 31960,
  "discountPaise": 0, "platformNetPaise": 31960, "vendorEarningsPaise": 287640,
  "users": { "CUSTOMER": 3, "VENDOR": 2, "ADMIN": 1 },
  "vendors": { "APPROVED": 1, "PENDING": 1 },
  "topProducts": [ { "productId": 1, "title": "Wireless Mouse", "unitsSold": 4 } ],
  "topVendors": [ { "vendorId": 1, "storeName": "Ravi Gadgets", "earnedPaise": 287640, "commissionPaise": 31960 } ],
  "daily": [ { "day": "2026-10-28", "orders": 2, "revenuePaise": 319600 } ] }
```

`platformNetPaise` is commission minus coupon discounts, which is what the platform really keeps.

---

## Example: full purchase with curl

```bash
# 1. login
curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"amit@test.com","password":"Test@1234"}'

# 2. add to cart (use the token from step 1)
curl -X POST localhost:5000/api/cart/items -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"productId":1,"quantity":2}'

# 3. checkout
curl -X POST localhost:5000/api/orders/checkout -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"address":"12 MG Road, Lucknow 226001"}'

# 4. create the Razorpay order (then pay in the popup — see the frontend, or docs/pay-test.html for a bare-bones test page)
curl -X POST localhost:5000/api/payments/create -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"orderId":1}'
```