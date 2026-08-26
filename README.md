# Passage

Document Q&A where the answer is never a paraphrase - ask a question and get back the
literal passage it came from, cited to the source document, or an honest refusal when
nothing in the corpus actually answers it.

> Status: core product built and verified - real document extraction (PDF/DOCX/text),
> real hybrid retrieval (BM25 + TF-IDF vector space, hand-verified against computed
> scores), a confidence-threshold refusal path, workspace membership with per-document
> access control, and the workspace web app are all live-tested against a running server,
> real Postgres, and real uploaded files. See the [roadmap](#roadmap) below.

## Why

A document Q&A tool's whole value depends on whether its answers can actually be trusted,
and "trust" for something built on retrieval + text generation isn't a vibe - it's either
a real citation someone can click and verify, or it isn't. Passage is built around that
being real:

- **The answer IS the source** - not a model's summary of it. Every answer is the literal
  matched passage, with a link back to the document it came from.
- **Refusing is a feature, not a failure** - below a real, tunable confidence threshold,
  Passage says it doesn't know rather than returning the least-bad match dressed up as an
  answer.
- **Retrieval is real math, not a black box** - BM25 and TF-IDF cosine similarity are both
  hand-implemented and tested against hand-computed expected scores, not delegated to an
  opaque library or a paid embeddings API.

## Architecture

- Next.js (App Router) + TypeScript, Tailwind, Postgres via Drizzle
- Session auth (scrypt password hashing, signed session cookies), multi-user workspaces
  with owner/member roles
- Real document ingestion: PDF via `pdf-parse`, `.docx` via `mammoth`, plain text/Markdown
  read directly - chunked along paragraph boundaries so every passage's `charStart`/
  `charEnd` is an exact substring of the source document, not a reconstructed string
- Real hybrid retrieval with no external API dependency (`src/lib/retrieval/`):
  - Okapi BM25, implemented from the standard formula (k1=1.5, b=0.75), hand-verified
    against a corpus with manually-computed expected scores
  - TF-IDF vector space model + cosine similarity, with smoothed IDF
    (`ln((1+N)/(1+df))+1`) - the plain textbook formula collapses to exactly 0 for a
    single-document corpus (every brand-new workspace's first upload), which made every
    query against it refuse regardless of match quality until this was found live and
    fixed
  - Reciprocal Rank Fusion combines both rankings, the same technique real hybrid search
    systems (Elasticsearch, OpenSearch) use to merge lexical and vector search
  - A stopword list removes function words before indexing/querying - IDF alone doesn't
    reliably suppress them in a small corpus, where a common word can appear rare purely
    by chance and drive a false match
- A confidence-threshold refusal path (`src/lib/retrieval/answer.ts`) - the top-ranked
  passage's own cosine similarity has to clear a real threshold before it's returned as an
  answer at all
- Documents are private by default, workspace-wide unless explicitly restricted to a
  subset of members (`document_access`) - enforced identically in the retrieval corpus
  itself, the document listing, and the file-serving route, so a restricted document can't
  leak through any of the three
- Uploaded documents are served through a real, auth-checked route
  (`src/app/uploads/[filename]`), not Next's static `/public` handling

## Roadmap

- [x] Domain schema (users, workspaces, membership, documents, passages, access, queries)
- [x] Session auth, multi-user signup and login
- [x] Real Okapi BM25 and TF-IDF vector-space retrieval, hand-verified against computed
      scores
- [x] Reciprocal Rank Fusion hybrid search
- [x] Confidence-threshold refusal, tuned against real eval fixtures
- [x] Real PDF/DOCX/plain-text extraction and paragraph-boundary chunking
- [x] Document upload, ingestion pipeline, and permission-scoped listing/deletion
- [x] Auth-checked document-serving route (not Next's static `/public` handling)
- [x] Workspace web app - ask a question, upload/manage documents
- [x] Workspace member management and per-document access restriction
- [x] Fixture-based citation-accuracy eval harness (`npm run evals`) - 84.6% against 13 real
      fixtures, a genuine precision/recall tradeoff (see the comment on `CONFIDENCE_THRESHOLD`),
      not a number massaged to look clean
- [ ] Slack app - real request-signature verification, slash command
- [ ] REST API docs page, health check
- [ ] Adversarial review pass

## License

MIT
