import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { SampleDocument } from '../documents/catalog.ts';
import { parseExtraction, schemaFor, type Extraction } from '../domain/schema.ts';

/**
 * Live extraction with Claude (Node only — never bundled into the browser). Structured output
 * constrains the reply to the same zod schema the recordings use, and the review layer then
 * re-checks every value deterministically.
 */
export const DEFAULT_MODEL = 'claude-opus-5-5';

export const SYSTEM_PROMPT = `You extract data from production documents (purchase orders and quality inspection reports) for a manufacturing company's ERP. A human reviews every value you are unsure about, so an honest "not sure" is worth more than a plausible guess.

For every field return value, confidence, source_text and note:
- value: exactly what the document states, normalised to the field type. Never guess silently: do not invent or fill in a value the document does not contain. If the document does not state it, value is null.
- Dates: YYYY-MM-DD, and only when the document gives an unambiguous date. If the year is missing or day and month could be swapped (e.g. "03/11"), you may propose the most likely reading, but only with confidence "low" and a note naming the alternatives. A low-confidence value is a proposal shown to the reviewer; it is never exported without a human decision.
- Numbers: plain numbers (28380, 38.5) without thousands separators or currency.
- confidence: "high" only when the document states the value directly and unambiguously. Use "medium" or "low" for approximations ("ok. 500", "kilkanaście"), contradictions inside the document, values assembled from several places, or values taken from context (for example an e-mail's sent date used as an order date).
- A field the document clearly does not contain: value null, confidence "high", note saying so.
- A field the document mentions but you cannot resolve: value null, confidence "low", note explaining why.
- source_text: a short verbatim quote from the document that the value was read from, copied character for character. null when nothing was found.
- note: one sentence explaining any confidence below "high" or any null value; otherwise null.
- If two parts of the document contradict each other, report the value from the main table or field, set confidence "low", and quote both in note.
- Quality decisions: "accepted", "rejected" or "conditional" only when the document records a decision. A request for a decision is not a decision.`;

export type ExtractionInput = { pdfBase64: string } | { text: string };

export type ExtractionRequest = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

export function buildExtractionRequest(
  doc: SampleDocument,
  input: ExtractionInput,
  model: string = DEFAULT_MODEL,
): ExtractionRequest {
  const document: Anthropic.Beta.Messages.BetaRequestDocumentBlock =
    'pdfBase64' in input
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: input.pdfBase64 },
          title: `${doc.id}.pdf`,
        }
      : {
          type: 'document',
          source: { type: 'text', media_type: 'text/plain', data: input.text },
          title: `${doc.id}.txt`,
        };
  const what = doc.kind === 'purchase_order' ? 'purchase order' : 'quality inspection report';
  return {
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    output_config: { effort: 'high', format: betaZodOutputFormat(schemaFor[doc.kind]) },
    messages: [
      {
        role: 'user',
        content: [
          document,
          { type: 'text', text: `Extract the ${what} fields from this document.` },
        ],
      },
    ],
  };
}

export class ExtractionError extends Error {
  override name = 'ExtractionError';
}

/** The slice of the SDK client this module uses — lets tests run without network or key. */
export interface ParseClient {
  beta: {
    messages: {
      parse(params: ExtractionRequest): PromiseLike<{
        stop_reason: string | null;
        model: string;
        parsed_output?: unknown;
      }>;
    };
  };
}

export interface ExtractionResult {
  extraction: Extraction;
  model: string;
}

export async function extractDocument(
  client: ParseClient,
  doc: SampleDocument,
  input: ExtractionInput,
  model?: string,
): Promise<ExtractionResult> {
  const response = await client.beta.messages.parse(buildExtractionRequest(doc, input, model));
  if (response.stop_reason === 'refusal') {
    throw new ExtractionError(`The model declined to process ${doc.id}.`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ExtractionError(`Output for ${doc.id} was cut off (max_tokens).`);
  }
  const extraction = parseExtraction(doc.kind, response.parsed_output);
  if (!extraction) {
    throw new ExtractionError(`Output for ${doc.id} does not match the schema.`);
  }
  return { extraction, model: response.model };
}
