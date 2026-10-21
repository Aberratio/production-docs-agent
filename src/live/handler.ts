import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findDocument, type DemoDocument } from '../documents/catalog';
import { PDF_DIR, readDocumentText } from '../documents/node-io';
import type { Recording } from '../domain/recording';
import {
  extractDocument,
  ExtractionError,
  type ExtractionInput,
  type ParseClient,
} from './extract';

/** Reads what the model gets for a demo document: the PDF bytes, or the e-mail text. */
export function loadExtractionInput(doc: DemoDocument): ExtractionInput {
  return doc.format === 'pdf'
    ? { pdfBase64: readFileSync(join(PDF_DIR, `${doc.id}.pdf`)).toString('base64') }
    : { text: readDocumentText(doc.id) };
}

export async function extractToRecording(
  client: ParseClient,
  doc: DemoDocument,
  now: () => Date,
  model?: string,
): Promise<Recording> {
  const { extraction, model: served } = await extractDocument(
    client,
    doc,
    loadExtractionInput(doc),
    model,
  );
  const meta = {
    schema_version: 1 as const,
    document_id: doc.id,
    source: 'live' as const,
    model: served,
    recorded_at: now().toISOString(),
  };
  return extraction.kind === 'purchase_order'
    ? { ...meta, kind: 'purchase_order', extraction: extraction.data }
    : { ...meta, kind: 'quality_report', extraction: extraction.data };
}

export interface HandlerOptions {
  apiKey: string | undefined;
  model?: string | undefined;
  clientFactory?: (apiKey: string) => ParseClient;
  now?: () => Date;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
}

/**
 * Core of `POST /api/extract` in live mode. Runs inside the local Node dev server; the API key
 * stays in this process and never appears in a response.
 */
export function createExtractHandler(options: HandlerOptions) {
  const factory = options.clientFactory ?? ((apiKey: string) => new Anthropic({ apiKey }));
  const now = options.now ?? (() => new Date());
  return async (rawBody: string, contentType: string | undefined): Promise<HandlerResponse> => {
    // A JSON content type forces a CORS preflight, so another website open in the same browser
    // cannot fire a "simple" text/plain POST at localhost and spend the owner's API credits.
    if (!contentType?.toLowerCase().startsWith('application/json')) {
      return { status: 415, body: { error: 'Send the request as application/json.' } };
    }
    let documentId: unknown;
    try {
      documentId = (JSON.parse(rawBody) as { documentId?: unknown }).documentId;
    } catch {
      return { status: 400, body: { error: 'Expected JSON: {"documentId": "po-001"}.' } };
    }
    const doc = typeof documentId === 'string' ? findDocument(documentId) : undefined;
    if (!doc) return { status: 404, body: { error: 'Unknown demo document.' } };
    if (!options.apiKey) {
      return {
        status: 503,
        body: { error: 'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a key.' },
      };
    }
    try {
      const recording = await extractToRecording(factory(options.apiKey), doc, now, options.model);
      return { status: 200, body: recording };
    } catch (error) {
      if (error instanceof ExtractionError) return { status: 422, body: { error: error.message } };
      if (error instanceof Anthropic.AuthenticationError) {
        return { status: 401, body: { error: 'The API key was rejected.' } };
      }
      if (error instanceof Anthropic.RateLimitError) {
        return { status: 429, body: { error: 'Rate limited — try again shortly.' } };
      }
      if (error instanceof Anthropic.APIError) {
        return { status: 502, body: { error: `Claude API error (${String(error.status)}).` } };
      }
      return { status: 500, body: { error: 'Extraction failed.' } };
    }
  };
}
