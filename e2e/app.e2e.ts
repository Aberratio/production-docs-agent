/**
 * Browser test of the static build (recorded mode): the review flow a visitor of the case study
 * goes through, the export, and the embed switch. Run with `npm run test:e2e` (builds first).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { chromium, type Browser, type Page } from 'playwright';
import { preview, type PreviewServer } from 'vite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let server: PreviewServer;
let browser: Browser;
let page: Page;
let base: string;
let errors: string[];

beforeAll(async () => {
  server = await preview({ logLevel: 'silent', preview: { port: 4400, strictPort: false } });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('preview server has no URL');
  base = url;
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser.close();
  await server.close();
});

beforeEach(async () => {
  page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
});

const field = (label: string) => page.getByRole('group', { name: new RegExp(`^${label}:`) });

describe('static build', () => {
  it('contains no API key material or server code', () => {
    const files = readdirSync('dist/assets').map((f) =>
      readFileSync(join('dist/assets', f), 'utf8'),
    );
    for (const text of files) {
      expect(text).not.toMatch(/ANTHROPIC_API_KEY|sk-ant-|@anthropic-ai\/sdk|api\.anthropic\.com/);
    }
  });

  it('uses relative asset paths so it works under any sub-path', () => {
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).toMatch(/src="\.\/assets\//);
    expect(html).not.toMatch(/(src|href)="\/assets\//);
  });
});

describe('review flow (recorded mode)', () => {
  it('shows a flagged field with its reason and highlights its source line', async () => {
    await page.goto(`${base}?doc=po-002`);
    const delivery = field('Delivery date');
    await expect
      .poll(() => delivery.getAttribute('aria-label'))
      .toBe('Delivery date: needs review');
    expect(await delivery.textContent()).toContain('has no year');
    await delivery.click();
    await expect.poll(() => page.locator('.paper .hl').first().textContent()).toContain('03/11');
    expect(errors).toEqual([]);
  });

  it('lets a human approve one field and correct another', async () => {
    await page.goto(`${base}?doc=po-002`);
    await expect.poll(() => page.locator('.summary strong').textContent()).toBe('5');

    await field('Order date').getByRole('button', { name: 'Approve' }).click();
    await expect
      .poll(() => field('Order date').getAttribute('aria-label'))
      .toBe('Order date: approved');

    const terms = field('Payment terms');
    await terms.getByRole('button', { name: 'Correct…' }).click();
    const input = page.getByRole('textbox', { name: 'Correct Payment terms' });
    await input.fill('   ');
    await input.press('Enter');
    await expect.poll(() => page.getByRole('alert').textContent()).toContain('non-empty');
    await input.fill('przelew 14 dni');
    await input.press('Enter');
    await expect
      .poll(() => field('Payment terms').getAttribute('aria-label'))
      .toBe('Payment terms: corrected');
    expect(await page.locator('.summary strong').textContent()).toBe('3');
    expect(errors).toEqual([]);
  });

  it('exports unresolved fields empty and lists them as open', async () => {
    await page.goto(`${base}?doc=po-002`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('po-002-sales_order.csv');
    const path = await download.path();
    const [header, first] = readFileSync(path, 'utf8')
      .trimStart() /* drops the BOM */
      .split('\r\n');
    const cols = header?.split(',') ?? [];
    const cells = first?.split(',') ?? [];
    expect(cells[cols.indexOf('delivery_date')]).toBe('');
    expect(cells[cols.indexOf('order_number')]).toBe('DM-7781');
    expect(first).toContain('needs_review');
  });

  it('exports human decisions: approved and corrected values reach the CSV and XLSX', async () => {
    await page.goto(`${base}?doc=po-002`);
    await field('Delivery date').getByRole('button', { name: 'Approve' }).click();
    await field('Payment terms').getByRole('button', { name: 'Correct…' }).click();
    const input = page.getByRole('textbox', { name: 'Correct Payment terms' });
    await input.fill('przelew 14 dni');
    await input.press('Enter');
    await expect
      .poll(() => field('Payment terms').getAttribute('aria-label'))
      .toBe('Payment terms: corrected');

    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    const [header, row] = readFileSync(await csv.path(), 'utf8')
      .trimStart()
      .split('\r\n');
    const cols = header?.split(',') ?? [];
    const cells = row?.split(',') ?? [];
    expect(cells[cols.indexOf('delivery_date')]).toBe('2026-11-03');
    expect(cells[cols.indexOf('payment_terms')]).toBe('przelew 14 dni');

    const [xlsx] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export XLSX (all documents)' }).click(),
    ]);
    const wb = XLSX.read(readFileSync(await xlsx.path()));
    expect(wb.SheetNames).toEqual(['orders', 'quality', 'review_log']);
    const log = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets['review_log']!);
    expect(log).toContainEqual(
      expect.objectContaining({
        source_document: 'po-002',
        field: 'payment_terms',
        status: 'corrected',
      }),
    );
    expect(errors).toEqual([]);
  });

  it('hides the header and footer when embedded', async () => {
    await page.goto(`${base}?embed=1&doc=qr-002`);
    await expect
      .poll(() => field('Decision').getAttribute('aria-label'))
      .toBe('Decision: needs review');
    expect(await page.locator('.topbar').isVisible()).toBe(false);
    expect(await page.locator('.foot').isVisible()).toBe(false);
  });

  it('shows the header outside the embed', async () => {
    await page.goto(`${base}?doc=po-001`);
    await expect.poll(() => page.locator('.topbar').isVisible()).toBe(true);
    expect(await page.locator('.summary').textContent()).toContain('ready for ERP');
  });
});
