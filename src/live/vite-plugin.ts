import type { Plugin } from 'vite';
import { createExtractHandler, type HandlerOptions } from './handler';

const MAX_BODY = 4096;

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
        let body = '';
        let tooLarge = false;
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > MAX_BODY) tooLarge = true;
        });
        req.on('end', () => {
          const respond = (status: number, payload: unknown) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
          };
          if (tooLarge) {
            respond(413, { error: 'Request too large.' });
            return;
          }
          handle(body).then(
            (r) => respond(r.status, r.body),
            () => respond(500, { error: 'Extraction failed.' }),
          );
        });
      });
    },
  };
}
