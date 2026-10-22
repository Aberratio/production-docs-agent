/**
 * Fails (exit 1) if the word "demo" appears in anything a person can read: the built app in
 * `dist/` (html, js, css, json, svg, txt and the text inside the PDFs), the README, `docs/**`
 * Markdown, the source documents, the generated PDFs and the recorded runs.
 * Usage: npm run build && npm run check:wording
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { findForbiddenWording } from './wording.ts';

const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.md', '.map']);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

async function pdfText(path: string): Promise<string> {
  const task = getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 });
  const pdf = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  await task.destroy();
  return pages.join('\n');
}

async function main(): Promise<void> {
  if (!existsSync('dist/index.html')) {
    console.error('dist/ not found: run `npm run build` first.');
    process.exit(1);
  }
  const files = [
    ...walk('dist'),
    'README.md',
    ...walk('docs').filter((f) => f.endsWith('.md')),
    ...walk('documents'),
    ...walk('public'),
    ...walk('recordings'),
  ];
  let scanned = 0;
  const problems: string[] = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    let text: string;
    if (ext === '.pdf') text = await pdfText(file);
    else if (TEXT.has(ext)) text = readFileSync(file, 'utf8');
    else continue;
    scanned++;
    for (const hit of findForbiddenWording(text)) {
      problems.push(`${relative('.', file)}:${hit.line}: …${hit.excerpt}…`);
    }
  }
  if (problems.length) {
    console.error(`Forbidden wording ("demo") in ${problems.length} place(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.info(`wording check passed: ${scanned} files scanned, no "demo".`);
}

await main();
