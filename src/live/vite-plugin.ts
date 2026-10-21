import type { Plugin } from 'vite';
import { createExtractHandler, type HandlerOptions } from './handler.ts';

const MAX_BODY = 4096;

/** Browsers always send Origin on a cross-origin POST; non-browser clients (curl) send none. */
function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Adds `POST /api/extract` to the local dev server in live mode (`npm run dev:live`). The key is
 * read from `.env` by vite.config.ts in Node and only used here; Vite exposes nothing without the
 * `VITE_` prefix to the browser bundle.
 */
export function liveExtractionPlugin(options: HandlerOptions): Plugin {
  const handle = createExtractHandler(options);
  return {
    name: 'production-docs-agent:live-extraction',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/extract', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (!isSameOrigin(req.headers.origin, req.headers.host)) {
          // Another local app or website must not spend the owner's API credits.
          res.statusCode = 403;
          res.end();
          return;
        }
        const respond = (status: number, payload: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        };
        let body = '';
        let tooLarge = false;
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          if (tooLarge) return;
          body += chunk;
          if (body.length > MAX_BODY) {
            // Answer now and stop reading the rest of an oversized body.
            tooLarge = true;
            res.setHeader('Connection', 'close');
            respond(413, { error: 'Request too large.' });
            req.destroy();
          }
        });
        req.on('end', () => {
          if (tooLarge) return;
          handle(body, req.headers['content-type']).then(
            (r) => respond(r.status, r.body),
            () => respond(500, { error: 'Extraction failed.' }),
          );
        });
      });
    },
  };
}
