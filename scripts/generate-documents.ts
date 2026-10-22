/**
 * Generates the sample PDFs from `documents/<id>.txt` into `public/documents/<id>.pdf`.
 * Usage: npm run docs:generate   (needs `npx playwright install chromium` once)
 *
 * The PDFs are committed, so the app and CI never run this. E-mails stay plain text and are
 * copied as `.txt` so the "open original" link works for every document.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { DOCUMENTS } from '../src/documents/catalog.ts';
import { renderDocumentHtml } from '../src/documents/render.ts';
import { DOCUMENTS_DIR, PDF_DIR, readDocumentText } from '../src/documents/node-io.ts';

const PAGE_CSS = `
  @page { size: A4; margin: 22mm 18mm 24mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.45; }
  h1 { font-size: 15pt; letter-spacing: .02em; border-bottom: 2px solid #111; padding-bottom: 6px; margin: 0 0 14px; }
  p { margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 9.5pt; }
  th, td { border: 1px solid #888; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
`;

const FOOTER = `<div style="width:100%;font-size:8px;color:#666;text-align:center;font-family:Arial,sans-serif">
  Dokument fikcyjny — dane przykładowe · Fictional sample document</div>`;

async function main(): Promise<void> {
  mkdirSync(PDF_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const doc of DOCUMENTS) {
      if (doc.format === 'email') {
        copyFileSync(join(DOCUMENTS_DIR, `${doc.id}.txt`), join(PDF_DIR, `${doc.id}.txt`));
        continue;
      }
      const body = renderDocumentHtml(readDocumentText(doc.id));
      await page.setContent(
        `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${PAGE_CSS}</style>
         <body>${body}</body></html>`,
      );
      await page.pdf({
        path: join(PDF_DIR, `${doc.id}.pdf`),
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: FOOTER,
      });
      console.info(`wrote ${doc.id}.pdf`);
    }
  } finally {
    await browser.close();
  }
}

await main();
