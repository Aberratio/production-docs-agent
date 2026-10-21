import { describe, expect, it } from 'vitest';
import { findDocument } from '../src/documents/catalog.ts';
import {
  buildExtractionRequest,
  DEFAULT_MODEL,
  extractDocument,
  ExtractionError,
  type ParseClient,
} from '../src/live/extract.ts';
import { cleanOrder } from './helpers/builders.ts';

const pdfDoc = findDocument('po-001')!;
const emailDoc = findDocument('po-002')!;

describe('buildExtractionRequest', () => {
  it('uses the default model with server-side refusal fallback and explicit effort', () => {
    const req = buildExtractionRequest(pdfDoc, { pdfBase64: 'JVBERi0=' });
    expect(DEFAULT_MODEL).toBe('claude-opus-5-5');
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(req.thinking).toEqual({ type: 'adaptive' });
    expect(req.output_config?.effort).toBe('high');
    expect(req.output_config?.format).toBeDefined();
  });

  it('sends a PDF as a base64 document block before the instruction', () => {
    const req = buildExtractionRequest(pdfDoc, { pdfBase64: 'JVBERi0=' });
    const content = req.messages[0]?.content;
    expect(Array.isArray(content)).toBe(true);
    const [first, second] = content as { type: string }[];
    expect(first).toMatchObject({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' },
    });
    expect(second?.type).toBe('text');
  });

  it('sends an e-mail as a plain-text document block', () => {
    const req = buildExtractionRequest(emailDoc, { text: 'Od: A' });
    const [first] = req.messages[0]?.content as { type: string }[];
    expect(first).toMatchObject({
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: 'Od: A' },
    });
  });

  it('tells the model to leave uncertain values for review rather than guess', () => {
    const req = buildExtractionRequest(pdfDoc, { pdfBase64: 'x' });
    const system = String(req.system);
    expect(system).toMatch(/never guess/i);
    expect(system).toMatch(/verbatim/i);
    expect(system).toMatch(/YYYY-MM-DD/);
  });

  it('honours a model override', () => {
    expect(buildExtractionRequest(pdfDoc, { pdfBase64: 'x' }, 'claude-sonnet-5-5').model).toBe(
      'claude-sonnet-5-5',
    );
  });
});

function fakeClient(response: object): ParseClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    beta: {
      messages: {
        parse: (params: unknown) => {
          calls.push(params);
          return Promise.resolve(response);
        },
      },
    },
  } as ParseClient & { calls: unknown[] };
}

describe('extractDocument', () => {
  it('returns the schema-validated extraction and the model that served it', async () => {
    const client = fakeClient({
      stop_reason: 'end_turn',
      model: 'claude-opus-5-5',
      parsed_output: cleanOrder(),
    });
    const result = await extractDocument(client, pdfDoc, { pdfBase64: 'x' });
    expect(result.extraction).toEqual({ kind: 'purchase_order', data: cleanOrder() });
    expect(result.model).toBe('claude-opus-5-5');
    expect(client.calls).toHaveLength(1);
  });

  it('fails clearly on a refusal instead of returning partial data', async () => {
    const client = fakeClient({ stop_reason: 'refusal', model: 'm', parsed_output: null });
    await expect(extractDocument(client, pdfDoc, { pdfBase64: 'x' })).rejects.toThrow(
      ExtractionError,
    );
  });

  it('fails clearly when the output was cut off', async () => {
    const client = fakeClient({ stop_reason: 'max_tokens', model: 'm', parsed_output: null });
    await expect(extractDocument(client, pdfDoc, { pdfBase64: 'x' })).rejects.toThrow(/max_tokens/);
  });

  it('rejects output that does not match the schema', async () => {
    const client = fakeClient({
      stop_reason: 'end_turn',
      model: 'm',
      parsed_output: { order_number: 'x' },
    });
    await expect(extractDocument(client, pdfDoc, { pdfBase64: 'x' })).rejects.toThrow(
      ExtractionError,
    );
  });
});
