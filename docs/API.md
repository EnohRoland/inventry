# API reference

All routes are prefixed `/api`. JSON errors have an `error` string. Successful create endpoints return HTTP 201, generally with `{ "id": "UUID" }`. Updates generally return 204. Validation errors return 400, missing authentication 401, forbidden operations 403, missing records 404, and conflicts 409.

Browser requests use a session cookie. All POST, PUT, and PATCH requests must include `Origin` matching `APP_ORIGIN`, including login. Non-browser integrations must retain the cookie and supply the same header. The API is single-organization, not a multi-tenant public API.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process liveness, unauthenticated |
| GET | `/health/ready` | Database/schema connectivity, unauthenticated |
| POST | `/auth/login` | `{email,password}`; sets session cookie |
| GET | `/auth/me` | Current user's public profile |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/password` | `{current,password}`; 14+ character new password; revoke all own sessions |
| GET | `/items` | All catalog items with aggregate quantity and per-location stock |
| POST | `/items` | Create catalog item |
| PUT | `/items/:id` | Replace editable catalog fields |
| GET/POST | `/locations` | List/create locations with `{name,description}` |
| GET/POST | `/suppliers` | List/create suppliers with `{name,email,phone}` |
| GET | `/movements` | Latest 200 ledger entries |
| POST | `/movements` | Receive, issue, adjust, transfer |
| GET | `/orders` | Latest 200 orders with lines and totals |
| POST | `/orders` | Create draft purchase order |
| POST | `/orders/:id/submit` | Mark externally placed order as ordered |
| POST | `/orders/:id/receive` | Atomically receive all lines, retry-safe |
| POST | `/orders/:id/cancel` | Cancel a draft or ordered purchase |
| GET | `/audit` | Latest 200 audit events; manager/admin |
| GET/POST | `/users` | List/create team members; admin |
| PATCH | `/users/:id` | `{role,active}`; admin |

## Example bodies

Create/update item:

```json
{"sku":"THR-001","name":"Therapy journal","category":"Therapy materials","unit":"each","reorder_point":25,"unit_cost":4.80}
```

Record transfer:

```json
{"item_id":"ITEM_UUID","location_id":"SOURCE_UUID","destination_id":"DESTINATION_UUID","type":"transfer","quantity":10,"reason":"Weekly outreach replenishment"}
```

Record an adjustment using `type: "adjust"` and a signed `quantity`. A value of `-3` reduces stock by three; it does not set the absolute balance to three. Adjustments require manager or admin access.

Create order:

```json
{"supplier_id":"SUPPLIER_UUID","location_id":"LOCATION_UUID","lines":[{"item_id":"ITEM_UUID","quantity":50,"unit_cost":4.25}]}
```

Create user:

```json
{"name":"Example Colleague","email":"colleague@example.com","role":"staff","password":"a-unique-initial-password"}
```

Replace illustrative UUID placeholders with actual UUIDs. The current implementation does not delete historical catalog, stock, movement, or order records. Add new forward migrations and explicitly designed archive behavior if retention requirements change.
