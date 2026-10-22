# Architecture and design decisions

This page records why the code is shaped the way it is. The [README](../README.md) covers what it
does and how to run it.

## Pipeline

```
document (PDF / e-mail)
  └─► extraction (Claude, structured output)       live mode
  └─► recorded extraction (recordings/<id>.json)   recorded mode
        └─► deterministic review   → issues per field, never fills a value
              └─► human decisions  → approve / correct
                    └─► mapping    → ERP record (JSON) → sheet rows → CSV / XLSX
```

## Extraction

- **One structured-output call per document.** The live request uses `client.beta.messages.parse`
  with the same zod schema that validates the recordings, so a live run and a recorded run have
  the same shape. The document type comes from the sample catalog rather than a classification
  step; classifying arbitrary uploads is out of scope.
- **Model settings.** `claude-opus-5-5` by default (override with `CLAUDE_MODEL`), adaptive
  thinking, `effort: high`, and server-side refusal fallback (`fallbacks: "default"`).
- **Every field carries evidence.** Each value comes with `confidence`, a quoted `source_text`
  and a `note`. The model is told to leave a value empty rather than guess.

## Review

- **The model's confidence is an input, not the verdict.** The quoted source is re-read
  deterministically: a date without a year or with swappable day and month, or an approximate
  count, is flagged even when the model reports high confidence. A value whose quote does not
  occur in the document is flagged as not traceable.
- **Required vs optional fields.** A required field without a value is _missing_. An optional
  field (contact person, payment terms, total, order reference, acceptance number, defect
  description, inspector) is flagged only when the document mentions it but it could not be
  read, so the reviewer is not asked about information the document never contained.
- **Cross-field rules run twice:** on the model output and again on the human-resolved values.
  A correction that contradicts a field accepted automatically sends that field back to review;
  a field a human decided keeps the human's decision.
- **Approve is validated.** A value can be approved only if it passes its format check. The
  placeholder for missing order lines can be neither approved nor corrected; lines are fixed at
  the source.

## Export

- **Unresolved means empty.** A flagged field without a human decision is exported empty, with
  `review_status = needs_review` and the field listed in `open_fields`. The model's proposal is
  kept only as an audit column in the XLSX `review_log`.
- **XLSX via SheetJS 0.20.3** from the official CDN tarball. The npm `xlsx` package is no longer
  maintained and the common alternative pulls a vulnerable dependency; `npm audit` is clean.
- **CSV** follows RFC 4180, is UTF-8 with BOM for Excel and neutralises formula injection.

## Two modes

- **Recorded run** (default, used for the hosted build): replays `recordings/*.json`. No key, no
  server, no API calls, deterministic output. The committed recordings are hand-authored to the
  extraction schema and marked `"source": "hand-authored"`; `npm run record` replaces them with
  live runs marked `"source": "live"`.
- **Live** (`npm run dev:live`): a small Vite dev-server middleware serves `POST /api/extract` in
  the local Node process. There is no separate server and the static build contains no server
  code.

## Security

- The API key is read from `.env` in Node only. It has no `VITE_` prefix, so Vite never exposes
  it to the browser, and an e2e test asserts the built assets contain no key material or SDK code.
- `/api/extract` accepts only ids from the sample catalog, only `application/json` bodies (which
  forces a CORS preflight) and only requests whose `Origin` matches the dev server. Another web
  page open in the same browser cannot spend the key owner's credits.
- Every `/api/extract` answer is JSON (`{ error }` on failures). The browser parses it defensively
  and validates the returned recording with zod instead of casting it.
- The document pane's only HTML sink is fed solely by `renderDocumentHtml`, which escapes every
  text path (covered by `tests/render.test.ts`).

## Embedding

- The iframe needs `allow-same-origin`: without it the frame's origin is `null` and the browser
  blocks Vite's `crossorigin` script and stylesheet, leaving an empty frame. The e2e suite reads
  the sandbox attribute from the README and checks both the working and the failing case.
- The app posts its height to the parent's origin (from `location.ancestorOrigins`, else the
  referrer), with `*` only as a last resort since the payload is a single number.

## UI

- The document pane renders the source text with the same renderer that produces the PDFs, plus
  an "Open PDF" link, instead of an embedded PDF viewer. This makes it possible to highlight the
  quoted source line, and works inside iframes and on phones.
- `src/ui/app.ts` is a single module that re-renders on each state change and restores focus via
  `data-focus` keys. The DOM is small, so no framework is used.
- Brand tokens (`src/styles/tokens.css`, `src/styles/fonts.css`) follow the kokot.it brand. Fonts
  are self-hosted, so visitors' IPs are not sent to a third party. `tests/tokens.test.ts` checks
  the brand values and WCAG AA contrast for every colour pairing the UI uses.

## Known trade-offs

- Rules that infer the document kind from field names, and order/report branching repeated
  across several modules, are candidates for a refactor if more document types are added.
- Regenerated PDFs are not byte-identical (Chromium stamps a creation date); their text is.
