# Security

## Reporting a vulnerability

If you find a security issue in Passage, please open a GitHub issue or reach out directly
rather than filing a public PR with the fix. Include enough detail to reproduce it -
endpoint, request, and expected vs. actual behavior.

## Design notes

A few decisions worth knowing if you're auditing this codebase - including two real bugs
an adversarial review pass found and fixed, since a security doc that only lists the good
decisions isn't telling the whole story.

- **Document visibility has one real source of truth, `document_access`.** A document with
  no rows there is visible to every member of its workspace; rows there narrow it to an
  allowlist. `canUserAccessDocument`, `listVisibleDocumentIds`,
  `listVisiblePassagesForWorkspace`, and `listVisibleDocumentsForWorkspace` all apply the
  identical rule, so a restricted document can't leak through retrieval, the document
  listing, or the file-serving route independently drifting out of sync with each other.
- **The document listing used to leak restricted documents' metadata to every workspace
  member** - `GET /api/workspaces/:slug/documents` called an unfiltered
  `listDocumentsForWorkspace`, so a document explicitly restricted away from someone still
  showed up in their dashboard table (title, size, status) even though the file itself
  correctly 404'd. Found in an adversarial review pass, fixed by adding
  `listVisibleDocumentsForWorkspace`, the same allowlist logic already used everywhere
  else, applied to the listing too - including for non-"ready" documents (a restricted
  document that's still processing or failed shouldn't reappear in the list just because
  it hasn't hit "ready" yet).
- **Any workspace member could delete any document, including ones restricted away from
  them** - the `DELETE` route checked workspace membership but not role, unlike every
  other permission-mutating route (`members` POST, `access` PUT, `slack` PUT/DELETE),
  which are all owner-gated. A plain member could delete a document they weren't even
  allowed to view. Found in the same review pass (the asymmetry with the sibling
  access-control UI, which is correctly owner-gated, made it clear this wasn't
  intentional) - fixed by adding the same `role !== "owner"` check the other routes
  already had. The `GET` on the per-document access endpoint had the identical gap
  (readable by any member, not just the owner who can change it) and got the same fix.
- **Document upload had no rate limit at all**, unlike every other write-heavy route
  (`login`, `signup`, `query`). Ingestion (real PDF/DOCX parsing) runs synchronously in
  that request, on the single Node process every workspace's traffic shares - an
  authenticated member of any workspace could upload as fast as the network allowed and
  degrade the process for every other tenant. Fixed with the same per-user
  `rate-limit.ts` pattern used elsewhere (20/hour). `extractText` is also now wrapped in a
  30s timeout (`withTimeout` in `pipeline.ts`) as a real, but genuinely partial,
  mitigation - Node is single-threaded, so a timer-based race can only fire once a
  synchronous decompression routine yields control back to the event loop, which isn't
  guaranteed. A hard memory ceiling and a real preemptive timeout both require running
  extraction in an isolated worker or process, which this doesn't do; that's a stated,
  understood gap, not a claimed fix.
- **Session auth** (`src/lib/auth/session.ts`) is a signed (HS256) JWT in an httpOnly,
  `sameSite: lax` cookie, verified by `src/middleware.ts` before any `/app/*` page
  renders - not a layout-level `redirect()`, which Next can stream a protected page's RSC
  payload around in some cases.
- **Login doesn't leak which emails have accounts.** A nonexistent email is checked
  against a fixed dummy scrypt hash before responding, so the "no such account" and "wrong
  password" paths cost the same wall-clock time and aren't distinguishable by timing.
- **The Slack slash command path has no real Passage user behind it** - Slack proves which
  team and channel a request came from, not which individual account, since there's no
  OAuth identity-linking flow here. It can only search documents visible to the whole
  workspace (`listUnrestrictedPassagesForWorkspace`), never anything restricted to a
  specific allowlist - a real, narrower corpus than a signed-in user gets, not a shortcut
  around the permission model. Inbound requests are verified against Slack's real
  documented signing scheme (`src/lib/slack/verify.ts`): HMAC-SHA256 over the raw body,
  timing-safe comparison, and a 5-minute replay window - tested against genuinely computed
  signatures, not stubbed ones.
- **The eval harness (`scripts/evals.ts`) refuses to run with `NODE_ENV=production`.** It
  seeds and deletes real rows in a dedicated `evals` workspace on every run; without this
  guard, running it against the wrong `DATABASE_URL` would silently create permanent
  fixture data in whatever database that happened to be.
- **Uploaded documents are served through a real, auth-checked route**
  (`src/app/uploads/[filename]`), not Next's static `/public` handling - and that route
  re-derives the exact same `canUserAccessDocument` check retrieval uses, rather than
  trusting that a URL being hard to guess is enough.

## Verifying findings

Every fix above was live-tested against a real running server, real Postgres, and real
uploaded files - not just a unit test - as part of building this project. The retrieval
math (BM25, TF-IDF, RRF) is separately hand-verified against manually-computed expected
scores in `src/lib/retrieval/*.test.ts`.
