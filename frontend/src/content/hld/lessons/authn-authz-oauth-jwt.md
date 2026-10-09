Authentication answers "who are you?"; authorization answers "what may you do?". OAuth2 and JWTs are the standard tools for both at scale, and interviewers expect you to know where tokens are validated, how they expire, and how to revoke them.

## The analogy

At a conference, the registration desk checks your ID once (authentication) and gives you a badge. Guards at each room glance at the badge's colour to decide whether you can enter (authorization). The badge expires at the end of the day. OAuth is like giving a hotel valet a valet key: it starts the car and nothing else, and you never hand over your house keys.

## Authentication options

| Method | How | Notes |
|---|---|---|
| Session cookie | Server stores session in Redis/DB; browser holds a random session ID | Easy revocation; needs a session lookup per request |
| Token (JWT) | Signed token carries identity and claims | Stateless validation; revocation is harder |
| API keys | Static secret per client | Simple for server-to-server; rotate and scope them |
| mTLS | Client certificates | Strong service-to-service identity |
| SSO (OIDC/SAML) | Delegate login to an identity provider | Enterprise and consumer login |
| MFA / passkeys | Additional factor or WebAuthn | Defence against credential theft |

Passwords are stored only as slow, salted hashes (bcrypt, scrypt, Argon2), never encrypted or plain.

## JWT

A JSON Web Token has three base64url parts: `header.payload.signature`. The payload contains claims such as `sub` (user ID), `exp` (expiry), `iss`, `aud`, and scopes or roles. The signature (HMAC or, better for distributed systems, RSA/ECDSA) lets any service verify the token without calling the auth server, using the issuer's public keys from a JWKS endpoint.

Trade-offs:

- **Pro**: no session lookup per request; works across services and regions.
- **Con**: cannot easily revoke before expiry; payload is readable (signed, not encrypted); tokens grow if you stuff in too many claims.

The standard pattern is **short-lived access tokens (5–15 minutes) plus long-lived refresh tokens** stored securely and rotated on use. Revocation then means revoking the refresh token; for urgent cases, keep a small denylist of token IDs checked at the gateway.

## OAuth 2.0 and OIDC

OAuth2 is a framework for **delegated authorization**: a user lets an app access their resources at another service without sharing their password. OpenID Connect adds an ID token on top, making it an authentication protocol too.

Authorization code flow with PKCE (the recommended flow for web and mobile apps):

```text
User      Client app                Authorization server           Resource API
 |  login  |                                |                            |
 |-------->|--redirect + code_challenge---->|                            |
 |<---------------- login & consent page ---|                            |
 |----------------- credentials ----------->|                            |
 |         |<----- authorization code ------|                            |
 |         |--code + code_verifier -------->|                            |
 |         |<--- access token (+ refresh, ID token)                      |
 |         |------------------- Authorization: Bearer <token> ---------->|
 |         |<------------------------------- data -----------------------|
```

Other flows: **client credentials** for service-to-service calls with no user; **device code** for TVs and CLIs. The implicit and password grants are deprecated.

## Authorization models

- **RBAC**: users have roles; roles have permissions. Simple, coarse.
- **ABAC**: decisions based on attributes (department, resource owner, time, region). Flexible, more complex.
- **ReBAC**: permissions derived from relationships ("editor of folder X, which contains doc Y"), as in Google Zanzibar-style systems. Ideal for sharing models like Google Docs.

Where to enforce: the gateway validates the token and coarse scopes; each service enforces fine-grained, resource-level permissions, because only it knows who owns what.

## Service-to-service

Use mTLS (often via a service mesh) for workload identity, plus either propagated user tokens or a token exchange that issues a downscoped internal token. Never let internal services trust a plain `X-User-Id` header from anywhere.

## Common mistakes

- Long-lived JWTs (days) with no revocation story.
- Accepting tokens without checking signature algorithm, `exp`, `aud`, and `iss`.
- Storing access tokens in localStorage where any XSS can read them; prefer HttpOnly secure cookies for browsers.
- Doing all authorization at the gateway, leaving services exposed to insecure direct object references.
- Putting sensitive data in JWT payloads.

## In the interview

**Q: Sessions or JWTs?**
For a single web app, server-side sessions in Redis are simple and instantly revocable. For many services, mobile clients, or multi-region APIs, short-lived JWTs avoid a central lookup on every call, combined with refresh tokens for revocation.

**Q: How do you log a user out everywhere immediately?**
Revoke their refresh tokens, and add their current access token IDs (or a "tokens issued before T are invalid" timestamp per user) to a fast denylist checked at the gateway until the access tokens naturally expire.

**Q: Where should authorization checks live?**
Coarse checks (valid token, required scope) at the gateway; resource-level checks (does this user own order 42?) in the owning service.

## Key takeaways

- AuthN proves identity; AuthZ decides permissions; keep them distinct.
- Use short-lived access tokens with rotating refresh tokens.
- OAuth2 authorization code + PKCE is the standard for user-facing apps; client credentials for services.
- Validate tokens at the edge and enforce fine-grained permissions in services.
