# Fastflow — Security Architecture

Threat model: a trust marketplace moving money between cross-border strangers is a **high-value
fraud target**. Security is a first-class domain, not a checklist. Default posture: **deny by
default, zero-trust between services, least privilege, everything audited.**

## 1. OWASP Top 10 (2021) — mitigations

| # | Risk | Mitigation in this design |
|---|------|---------------------------|
| A01 | Broken Access Control | Central RBAC+ABAC, deny-by-default guards; **server-derived `companyId`** (never client-supplied — the exact bug found in the prototype); row-level predicates on every read; IDOR-proof via ownership checks before handler |
| A02 | Cryptographic Failures | TLS 1.2+ everywhere; S3 SSE-KMS at rest; RDS/Aurora encryption; field-level encryption for sensitive PII (tax IDs) via KMS; secrets in Secrets Manager; no secrets in code/images |
| A03 | Injection | Prisma parameterized queries only; **no string SQL**; allowlisted filter/sort fields; OpenSearch queries built via typed query DSL, not string concat; input validation via `class-validator` DTOs |
| A04 | Insecure Design | Bounded contexts with invariants; escrow + dispute + KYB designed as state machines; abuse cases modeled (see Fraud subsystem) |
| A05 | Security Misconfiguration | IaC (Terraform) with reviewed modules; no debug in prod; security headers (CSP, HSTS, X-Content-Type-Options, frame-ancestors none); least-privilege IAM roles per service (IRSA) |
| A06 | Vulnerable Components | Renovate/Dependabot; SCA in CI; pinned lockfiles; base-image scanning (Trivy); SBOM generated |
| A07 | Identification & Auth Failures | Clerk/Auth0 with **MFA** (TOTP/WebAuthn); short-lived JWT + refresh rotation; session revocation list; breached-password + bot checks at IdP |
| A08 | Software & Data Integrity | Signed CI artifacts; hash-chained `AuditLog`; document `sha256` integrity; webhook signature verification (Stripe/Airwallex) |
| A09 | Logging & Monitoring Failures | Structured logs + OTel traces; Sentry alerts; audit trail for all business actions; anomaly alerts on auth denials / velocity |
| A10 | SSRF | No user-supplied URLs fetched server-side without allowlist; image ingestion via signed client upload, not server fetch; egress firewall on services |

## 2. Authentication & MFA

- **IdP-owned identity** (Clerk/Auth0): OIDC, email/password + social + enterprise SSO (SAML/OIDC) for enterprise customers.
- **MFA required** for: platform admins/ops (always), company admins, and any `order:release_escrow` / `kyb:decide` / payout action (step-up auth).
- **Step-up:** sensitive actions re-challenge MFA even within an active session (WebAuthn preferred, phishing-resistant).
- **JWT validation** at every service via cached JWKS; `aud`, `iss`, `exp`, `nbf` checked; clock-skew bounded.

## 3. Session management

- Stateless JWT access tokens (≤15 min) + rotating refresh tokens held by the IdP; **`Session` mirror table** lets us list/revoke active sessions and force logout on suspicious activity.
- Cookies (BFF): `HttpOnly`, `Secure`, `SameSite=Lax`, host-prefixed; CSRF defense via double-submit token for any cookie-authenticated mutation (carry-over of the prototype hardening, done properly).
- Logout + password change + role change ⇒ revoke sessions and bump a token `version` claim.

## 4. Encryption

- **In transit:** TLS 1.2+ at the edge; internal service-to-service over mTLS (service mesh) or VPC-private TLS. HSTS preload.
- **At rest:** Aurora + ElastiCache + OpenSearch encryption; S3 SSE-KMS with per-bucket CMKs; EBS encrypted.
- **Field-level:** national IDs, tax IDs, bank details encrypted with envelope encryption (KMS data keys); access logged.
- **Key management:** AWS KMS, automatic rotation; separate CMKs per data class; no human export of keys.

## 5. Rate limiting & DDoS

- **Edge:** CloudFront + AWS WAF (managed rule sets: SQLi, XSS, bad bots, geo/IP reputation) + Shield Advanced for L3/L4 DDoS.
- **App:** Redis token-bucket per principal **and** per IP; stricter buckets on auth, payments, document download, search. `429 + Retry-After`.
- **Abuse-specific:** velocity limits on RFQ creation, quote spam, message sending, signup (anti-bot), feeding the Fraud subsystem.

## 6. Secure file uploads

1. Client requests `POST /documents` → server returns a **pre-signed S3 PUT** scoped to a single key, content-type, size cap, short expiry.
2. Upload goes **direct to a private bucket** (never through app servers).
3. On `s3:ObjectCreated`, an async pipeline: **AV scan** (ClamAV/GuardDuty Malware Protection), MIME sniff (don't trust extension), image re-encode / PDF sanitize, compute `sha256`, mark `READY` or quarantine.
4. Files are **never public**; `kind` + size + type allowlisted; EXIF stripped from images.

## 7. Secure document access

- Private bucket; downloads only via **time-boxed pre-signed GET** issued *after* RBAC+ABAC + `DocumentAccessGrant` check.
- Every issuance is an `AuditLog` entry (who, which doc, when, IP). Legal-hold docs use **S3 Object Lock**.
- KYC/inspection documents are visible only to the owning company, granted counterparties, and authorized ops — enforced by `DocumentAccessGrant`, not by guessable URLs.

## 8. Secrets management

- AWS Secrets Manager + Parameter Store; injected at runtime via IRSA / task role — **never** in env files, images, or repo.
- Rotation for DB creds, provider API keys; provider webhooks verified by signature; least-privilege scoped keys (separate Stripe restricted keys per concern).

## 9. Audit trails & admin activity logging

- **Append-only, hash-chained `AuditLog`** (`prevHash`→`hash`) — tamper-evident; integrity verifiable by replay. No deletes; cold partitions archived to S3 with Object Lock.
- **Every business state transition** writes an audit row in the same transaction as the change (via outbox/audit consumer), capturing actor, before/after, IP, trace.
- **All admin actions** (KYB decisions, dispute resolutions, manual escrow moves, role grants, impersonation) are logged with elevated retention and alerting; admin impersonation requires reason + is time-boxed and conspicuously flagged.
- Audit is queryable by ops (`audit:read`) and exportable for compliance/e-discovery.

## 10. Compliance posture (forward-looking)

- GDPR/PIPL: data-subject export + erasure flows (erasure = crypto-shred field keys + tombstone, audit preserved); consent + retention policies per data class.
- PCI: out of scope by design — card data never touches our servers (Stripe Elements / Airwallex hosted).
- Data residency: `region` seams in schema/events enable CN/EU in-region hosting (Stage 2).
- Sanctions/AML screening integrated into KYB and payout paths.

Continue to `SUBSYSTEMS.md`.
