import { describe, expect, it } from 'vitest';
import { createExtractHandler } from '../src/live/handler';
import type { ParseClient } from '../src/live/extract';
import { parseRecording } from '../src/domain/recording';
import { cleanReport } from './helpers/builders';

function client(parsed_output: unknown): ParseClient & { used: number } {
  const c = {
    used: 0,
    beta: {
      messages: {
        parse: () => {
          c.used += 1;
          return Promise.resolve({
            stop_reason: 'end_turn',
            model: 'claude-opus-5-5',
            parsed_output,
          });
        },
      },
    },
  };
  return c as unknown as ParseClient & { used: number };
}

const JSON_TYPE = 'application/json; charset=utf-8';
const now = () => new Date('2026-10-21T12:00:00Z');

describe('createExtractHandler', () => {
  it('returns a live recording for a known document', async () => {
    const c = client(cleanReport());
    const handle = createExtractHandler({ apiKey: 'k', clientFactory: () => c, now });
    const res = await handle(JSON.stringify({ documentId: 'qr-001' }), JSON_TYPE);
    expect(res.status).toBe(200);
    const rec = parseRecording(res.body);
    expect(rec).toMatchObject({
      document_id: 'qr-001',
      kind: 'quality_report',
      source: 'live',
      model: 'claude-opus-5-5',
      recorded_at: '2026-10-21T12:00:00.000Z',
    });
  });

  it('answers 503 without calling the API when no key is configured', async () => {
    const c = client(cleanReport());
    const handle = createExtractHandler({ apiKey: undefined, clientFactory: () => c, now });
    const res = await handle(JSON.stringify({ documentId: 'qr-001' }), JSON_TYPE);
    expect(res.status).toBe(503);
    expect(c.used).toBe(0);
    expect(JSON.stringify(res.body)).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('only extracts documents from the demo catalog (no arbitrary paths)', async () => {
    const c = client(cleanReport());
    const handle = createExtractHandler({ apiKey: 'k', clientFactory: () => c, now });
    expect((await handle(JSON.stringify({ documentId: '../.env' }), JSON_TYPE)).status).toBe(404);
    expect((await handle('not json', JSON_TYPE)).status).toBe(400);
    expect(c.used).toBe(0);
  });

  it('maps an extraction failure to 422 without leaking the key', async () => {
    const handle = createExtractHandler({
      apiKey: 'sk-secret',
      clientFactory: () => client({ wrong: true }),
      now,
    });
    const res = await handle(JSON.stringify({ documentId: 'qr-001' }), JSON_TYPE);
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('sk-secret');
  });

  it('refuses a non-JSON content type, so another website cannot post without a CORS preflight', async () => {
    const c = client(cleanReport());
    const handle = createExtractHandler({ apiKey: 'k', clientFactory: () => c, now });
    const body = JSON.stringify({ documentId: 'qr-001' });
    expect((await handle(body, 'text/plain')).status).toBe(415);
    expect((await handle(body, undefined)).status).toBe(415);
    expect(c.used).toBe(0);
  });
});
