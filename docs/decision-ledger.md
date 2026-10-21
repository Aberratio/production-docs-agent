# T-11 — decision ledger

- 2026-10-21 · spec · committed recordings are hand-authored to the extraction schema (`"source": "hand-authored"`), not recorded from the API — no API key is available to the builder; `npm run record` replaces them and the corpus test shows any change in flags · self
- 2026-10-21 · spec · document type comes from the demo catalog instead of a classification step — keeps the live call a single structured-output extraction; classification is listed as a limitation · self
- 2026-10-21 · spec · a flagged field without a human decision is exported empty (with `review_status=needs_review` and `open_fields`), not with the model's proposal — "oznaczone, nie zgadywane" must hold in the export too · self
- 2026-10-21 · standards · XLSX via SheetJS 0.20.3 from the official CDN tarball (cdn.sheetjs.com), not exceljs — exceljs pulls a vulnerable `uuid`; the npm `xlsx` package is stale; `npm audit` is clean · self
- 2026-10-21 · standards · vitest 5 / vite 8 instead of the vitest 3 first installed — vitest ≤4.1.10 carries critical tinypool/@vitest/mocker advisories · self
- 2026-10-21 · standards · live mode is a Vite dev-server middleware (one Node process on localhost), not a separate server — the key stays in Node, one command (`npm run dev:live`), and the static build contains no server code · self
- 2026-10-21 · spec · document pane renders the source text (same renderer as the generated PDFs) with an "Open PDF" link instead of an embedded PDF viewer — lets the UI highlight the quoted source line, works in iframes and on phones, and headless screenshots can show it · self
- 2026-10-21 · spec · UI copy is English while the documents are Polish — matches the EN README / portfolio; PL summary in README · self
- 2026-10-21 · standards · flow-tdd ran without a tiller profile (none resolves for this repo yet), so `verify-claim` was not run; gates were run directly and their output is in the PR · self
- 2026-10-21 · standards · live request uses `fallbacks: "default"` with beta `server-side-fallback-2026-07-01` and `effort: high` — the claude-api skill's default for `claude-opus-5-5` · self
