REST is the default style for public and client-facing APIs because it maps cleanly onto HTTP and is easy for anyone to call. A well-designed REST API is predictable: once you have seen two endpoints, you can guess the rest.

## The analogy

Think of a library catalogue. Every book has a fixed shelf address (`/books/42`). You can look at a book, add one, replace one, or remove one, and the librarian replies with a clear outcome: "here it is", "created", "not found", "you are not allowed". REST APIs organize everything as addressable things (resources) and use a small, fixed set of actions on them.

## Core principles

- **Resources are nouns**: `/users/123/orders`, not `/getOrdersForUser`.
- **HTTP methods are verbs**: GET reads, POST creates, PUT replaces, PATCH partially updates, DELETE removes.
- **Statelessness**: each request carries everything needed (auth token, parameters). Any server can handle any request, which makes horizontal scaling trivial.
- **Standard status codes**: `201 Created` with a `Location` header, `204 No Content`, `400`, `404`, `409 Conflict`, `422` for validation failures, `429` for throttling.
- **Cacheability**: GET responses can carry `Cache-Control` and `ETag`.

## A sample design

```text
POST   /v1/orders                     create order (Idempotency-Key header)
GET    /v1/orders/{orderId}           fetch one
GET    /v1/users/{userId}/orders?limit=20&cursor=abc   list, paginated
PATCH  /v1/orders/{orderId}           update status/notes
POST   /v1/orders/{orderId}/cancel    action that does not map to CRUD
```

Actions that are not simple CRUD (cancel, refund, retry) are usually modelled as a sub-resource with POST. That is fine; purity matters less than consistency.

## Pagination

| Style | How | Pros | Cons |
|---|---|---|---|
| Offset | `?offset=200&limit=20` | Simple, jump to page N | Slow for deep pages (DB scans and discards rows); items shift when data changes |
| Cursor / keyset | `?cursor=<opaque>` encoding last seen `(created_at, id)` | Constant cost per page, stable under inserts | No random page access |

For feeds and large tables, cursor pagination is the right default. Make the cursor opaque (base64 of the sort key) so you can change its contents later.

## Idempotency for writes

Clients retry when a response is lost. For a payment or order creation, the client sends an `Idempotency-Key` header. The server stores the key with the result; a repeated key returns the saved result instead of creating a duplicate. Keys typically live for 24 hours.

## Versioning

| Approach | Example | Notes |
|---|---|---|
| URL path | `/v1/orders` | Most visible, easy to route at the gateway |
| Header | `Accept: application/vnd.api.v2+json` | Cleaner URLs, harder to test in a browser |
| No versions, additive only | Add fields, never remove | Works internally with good discipline |

Additive changes (new optional fields, new endpoints) should never require a new version. Removing or renaming fields does.

## Other practical details

- **Filtering and sorting**: `?status=shipped&sort=-created_at`.
- **Partial responses**: `?fields=id,status` to trim payloads for mobile.
- **Consistent errors**: return a body like `{ "code": "INSUFFICIENT_FUNDS", "message": "...", "requestId": "..." }`.
- **Rate-limit headers**: tell clients their remaining quota.

## Common mistakes

- Verbs in URLs (`/createUser`) and inconsistent pluralization.
- Using offset pagination on a table with tens of millions of rows.
- Non-idempotent POSTs for money movement without idempotency keys.
- Breaking changes without a version bump, or bumping versions for additive changes.
- Chatty APIs that force a mobile client to make ten calls to render one screen.

## In the interview

**Q: How would you paginate a timeline that receives new posts constantly?**
Use a cursor based on `(created_at, post_id)`. The next page query is "items older than this cursor", which is a fast index range scan and does not skip or repeat items when new posts arrive at the top.

**Q: How do you stop a double charge when the client retries?**
Require an idempotency key per logical operation. Store it with a unique constraint alongside the outcome; on a repeat, return the stored response. Handle concurrent duplicates by having the second request wait or receive a `409`.

**Q: Why is statelessness important?**
If no session lives in server memory, a load balancer can send any request anywhere, instances can be added or removed freely, and a crashed instance loses nothing.

## Key takeaways

- Model resources as nouns and let HTTP methods and status codes carry meaning.
- Prefer cursor pagination for large or fast-changing collections.
- Make retried writes safe with idempotency keys.
- Version only for breaking changes; evolve additively wherever you can.
