/**
 * Captures README screenshots from the static build (recorded mode, no API calls), each view in
 * English and Polish (`<name>-en.png`, `<name>-pl.png`).
 * Usage: npm run build && npm run screenshots   (needs `npx playwright install chromium` once)
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { preview } from 'vite';
import type { Lang } from '../src/i18n/index.ts';

const OUT = 'docs/screenshots';
const LANGS: readonly Lang[] = ['en', 'pl'];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  // Any free port: other local dev servers may already hold the usual ones.
  const server = await preview({ preview: { port: 4321, strictPort: false } });
  const base = server.resolvedUrls?.local[0];
  if (!base) throw new Error('Preview server did not report a URL.');
  const browser = await chromium.launch();
  try {
    for (const lang of LANGS) await capture(browser, base, lang);
    console.info(`screenshots written to ${OUT}/`);
  } finally {
    await browser.close();
    await server.close();
  }
}

async function capture(browser: Browser, base: string, lang: Lang): Promise<void> {
  const shot = (page: Page, name: string) =>
    page.screenshot({ path: `${OUT}/${name}-${lang}.png` });
  const open = async (page: Page, query: string) => {
    await page.goto(`${base}?${query}&lang=${lang}`);
    await page.waitForSelector('.field');
    await page.evaluate(() => document.fonts.ready);
  };
  const select = async (page: Page, path: string) => {
    await page.click(`.field[data-path="${path}"] .field-label`);
    await page.waitForTimeout(400);
  };

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await open(page, 'doc=po-002');
  await select(page, 'delivery_date');
  await shot(page, 'review-email-po-002');

  await open(page, 'doc=po-004');
  await select(page, 'total_net');
  await shot(page, 'contradictions-po-004');

  await open(page, 'doc=qr-002');
  await select(page, 'decision');
  await shot(page, 'quality-report-qr-002');

  // Human in the loop: approve one value, correct another.
  await open(page, 'doc=po-002');
  await page.click('[data-focus="approve:order_date"]');
  await page.click('[data-focus="edit:payment_terms"]');
  await page.fill('.field[data-path="payment_terms"] input', 'przelew 14 dni');
  await page.press('.field[data-path="payment_terms"] input', 'Enter');
  await page.click('[data-focus="approve:delivery_date"]');
  await page.click('.field[data-path="delivery_date"] .field-label');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, 'human-decisions-po-002');
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await open(mobile, 'embed=1&doc=po-003');
  await shot(mobile, 'embed-mobile-po-003');

  await open(mobile, 'doc=po-002');
  await shot(mobile, 'mobile-po-002');
  await mobile.close();
}

await main();
