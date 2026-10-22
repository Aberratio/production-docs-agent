import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { liveExtractionPlugin } from '../src/live/vite-plugin.ts';
import type { ParseClient } from '../src/live/extract.ts';
import { cleanOrder } from './helpers/builders.ts';

/** The live endpoint over real HTTP, with a fake Claude client (no network, no key). */
let server: ViteDevServer;
let base: string;
let calls = 0;

const client = {
  beta: {
    messages: {
      parse: () => {
        calls += 1;
        return Promise.resolve({
          stop_reason: 'end_turn',
          model: 'claude-opus-5-5',
          parsed_output: cleanOrder(),
        });
      },
    },
  },
} as unknown as ParseClient;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: { port: 0, host: 'localhost' },
    plugins: [liveExtractionPlugin({ apiKey: 'k', clientFactory: () => client })],
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  base = `http://localhost:${address.port}`;
});

afterAll(async () => {
  await server.close();
});

const post = (body: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });

describe('POST /api/extract (live mode)', () => {
  it('returns a JSON recording for a same-origin request', async () => {
    const res = await post(JSON.stringify({ documentId: 'po-001' }), { Origin: base });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(await res.json()).toMatchObject({ document_id: 'po-001', source: 'live' });
  });

  it('refuses a request from another origin before calling Claude', async () => {
    const before = calls;
    const res = await post(JSON.stringify({ documentId: 'po-001' }), {
      Origin: 'http://localhost:9999',
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ error: expect.stringMatching(/origin/i) });
    expect(calls).toBe(before);
  });

  it('refuses a text/plain body (no CORS preflight)', async () => {
    const res = await post(JSON.stringify({ documentId: 'po-001' }), {
      'Content-Type': 'text/plain',
    });
    expect(res.status).toBe(415);
  });

  it('answers 405 to anything but POST', async () => {
    const res = await fetch(`${base}/api/extract`);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect(await res.json()).toEqual({ error: expect.stringMatching(/POST/) });
  });

  it('answers 413 to an oversized body', async () => {
    const res = await post(JSON.stringify({ documentId: 'x'.repeat(10_000) }));
    expect(res.status).toBe(413);
  });
});
