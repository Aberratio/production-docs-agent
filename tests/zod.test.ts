import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('zod in jitless mode', () => {
  it('parses a recording without ever constructing a Function', async () => {
    // Spy before the app modules load: zod probes `new Function` lazily, on the first parse.
    const spy = vi.spyOn(globalThis, 'Function');
    const { z } = await import('../src/domain/zod.ts');
    const { parseRecording } = await import('../src/domain/recording.ts');
    expect(z.config().jitless).toBe(true);
    const raw: unknown = JSON.parse(readFileSync('recordings/po-002.json', 'utf8'));
    expect(parseRecording(raw).document_id).toBe('po-002');
    expect(() => parseRecording({ ...(raw as object), kind: 'invoice' })).toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
