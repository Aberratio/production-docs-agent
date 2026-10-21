/**
 * Captures README screenshots from the static build (recorded mode, no API calls).
 * Usage: npm run build && npm run screenshots   (needs `npx playwright install chromium` once)
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { preview } from 'vite';

const OUT = 'docs/screenshots';

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  // Any free port: other local dev servers may already hold the usual ones.
  const server = await preview({ preview: { port: 4300, strictPort: false } });
  const base = server.resolvedUrls?.local[0];
  if (!base) throw new Error('Preview server did not report a URL.');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const open = async (query: string) => {
      await page.goto(`${base}?${query}`);
      await page.waitForSelector('.field');
      await page.evaluate(() => document.fonts.ready);
    };
    const select = async (p: Page, path: string) => {
      await p.click(`.field[data-path="${path}"] .field-label`);
      await p.waitForTimeout(400);
    };

    await open('doc=po-002');
    await select(page, 'delivery_date');
    await page.screenshot({ path: `${OUT}/review-email-po-002.png` });

    await open('doc=po-004');
    await select(page, 'total_net');
    await page.screenshot({ path: `${OUT}/contradictions-po-004.png` });

    await open('doc=qr-002');
    await select(page, 'decision');
    await page.screenshot({ path: `${OUT}/quality-report-qr-002.png` });

    // Human in the loop: approve one value, correct another.
    await open('doc=po-002');
    await page.click('.field[data-path="order_date"] .btn-approve');
    await page.click('.field[data-path="payment_terms"] button:has-text("Correct")');
    await page.fill('.field[data-path="payment_terms"] input', 'przelew 14 dni');
    await page.press('.field[data-path="payment_terms"] input', 'Enter');
    await page.click('.field[data-path="delivery_date"] .btn-approve');
    await page.click('.field[data-path="delivery_date"] .field-label');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/human-decisions-po-002.png` });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${base}?embed=1&doc=po-003`);
    await mobile.waitForSelector('.field');
    await mobile.evaluate(() => document.fonts.ready);
    await mobile.screenshot({ path: `${OUT}/embed-mobile-po-003.png` });

    console.info(`screenshots written to ${OUT}/`);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
