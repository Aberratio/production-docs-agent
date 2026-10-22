import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const DOCUMENTS_DIR = join(root, 'documents');
export const PDF_DIR = join(root, 'public', 'documents');
export const RECORDINGS_DIR = join(root, 'recordings');

/** Source text of a sample document, read from disk (Node only: tests, scripts, live server). */
export function readDocumentText(id: string): string {
  return readFileSync(join(DOCUMENTS_DIR, `${id}.txt`), 'utf8');
}
