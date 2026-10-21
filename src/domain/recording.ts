import { z } from 'zod';
import { PurchaseOrderExtraction, QualityReportExtraction, type Extraction } from './schema.ts';

/**
 * A recorded extraction run, stored as JSON in `recordings/<document_id>.json`. The demo replays
 * these instead of calling the API, so it is free and deterministic (D-023).
 */
const Meta = {
  /** `hand-authored` = written to the schema by hand; `live` = saved by `npm run record`. */
  source: z.enum(['hand-authored', 'live']),
  model: z.string().nullable(),
  recorded_at: z.string().nullable(),
};

export const Recording = z.discriminatedUnion('kind', [
  z.object({
    schema_version: z.literal(1),
    document_id: z.string(),
    kind: z.literal('purchase_order'),
    ...Meta,
    extraction: PurchaseOrderExtraction,
  }),
  z.object({
    schema_version: z.literal(1),
    document_id: z.string(),
    kind: z.literal('quality_report'),
    ...Meta,
    extraction: QualityReportExtraction,
  }),
]);
export type Recording = z.infer<typeof Recording>;

export function parseRecording(raw: unknown): Recording {
  return Recording.parse(raw);
}

/** Canonical on-disk form: schema key order, two-space indent, trailing newline. */
export function serializeRecording(recording: Recording): string {
  return `${JSON.stringify(Recording.parse(recording), null, 2)}\n`;
}

export function extractionOf(recording: Recording): Extraction {
  return recording.kind === 'purchase_order'
    ? { kind: 'purchase_order', data: recording.extraction }
    : { kind: 'quality_report', data: recording.extraction };
}
