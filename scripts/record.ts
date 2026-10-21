/**
 * Records live extractions into `recordings/<id>.json` (the files the demo replays).
 *
 *   npm run record              # every demo document
 *   npm run record -- po-002    # selected documents
 *
 * Needs ANTHROPIC_API_KEY in `.env` (or the environment). Review the diff before committing:
 * the corpus test pins which fields each document flags, so a changed recording shows up there.
 */
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCUMENTS, findDocument } from '../src/documents/catalog';
import { RECORDINGS_DIR } from '../src/documents/node-io';
import { serializeRecording } from '../src/domain/recording';
import { extractToRecording } from '../src/live/handler';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env — fall back to the environment
}

const apiKey = process.env['ANTHROPIC_API_KEY'];
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a key.');
  process.exit(1);
}
const model = process.env['CLAUDE_MODEL'] || undefined;
const ids = process.argv.slice(2);
const docs = ids.length ? ids.map((id) => findDocument(id)) : [...DOCUMENTS];
if (docs.some((d) => !d)) {
  console.error(`Unknown document id. Known: ${DOCUMENTS.map((d) => d.id).join(', ')}`);
  process.exit(1);
}

const client = new Anthropic({ apiKey });
for (const doc of docs) {
  if (!doc) continue;
  const recording = await extractToRecording(client, doc, () => new Date(), model);
  writeFileSync(join(RECORDINGS_DIR, `${doc.id}.json`), serializeRecording(recording));
  console.info(`recorded ${doc.id} with ${recording.model ?? 'unknown model'}`);
}
