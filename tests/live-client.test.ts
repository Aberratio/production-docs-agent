import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readExtractResponse } from '../src/ui/live-client.ts';

const response = (status: number, body: string) => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(body),
});

describe('readExtractResponse — the browser side of live mode', () => {
  it('returns a schema-validated recording on success', async () => {
    const body = readFileSync('recordings/po-001.json', 'utf8');
    const rec = await readExtractResponse(response(200, body));
    expect(rec.document_id).toBe('po-001');
  });

  it("surfaces the server's error message", async () => {
    await expect(
      readExtractResponse(
        response(503, JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set.' })),
      ),
    ).rejects.toThrow('ANTHROPIC_API_KEY is not set.');
  });

  it.each([
    ['an empty body', ''],
    ['HTML', '<html>Bad gateway</html>'],
    ['an error that is not a string', JSON.stringify({ error: { nested: true } })],
  ])('falls back to the HTTP status for %s', async (_name, body) => {
    await expect(readExtractResponse(response(502, body))).rejects.toThrow('HTTP 502');
  });

  it('rejects a 200 whose body is not a valid recording', async () => {
    await expect(readExtractResponse(response(200, JSON.stringify({ ok: true })))).rejects.toThrow(
      /not a valid recording/,
    );
  });
});
