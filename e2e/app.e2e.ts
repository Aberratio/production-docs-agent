/**
 * Browser test of the static build (recorded mode): the review flow a visitor of the case study
 * goes through, the export, and the embed switch. Run with `npm run test:e2e` (builds first).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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

describe('embedding on another site (the README snippet)', () => {
  // The exact sandbox attribute the README tells kokot.it to use — docs and test cannot drift.
  const readme = readFileSync('README.md', 'utf8');
  const sandbox = /<iframe[\s\S]*?sandbox="([^"]+)"/.exec(readme)?.[1];
  // The host page is served by a real local server on another origin (127.0.0.1 vs localhost),
  // like kokot.it framing /demos/…: a routed fake page counts as a public origin to Chromium's
  // Local Network Access check, which would block the frame before the CORS behaviour under test.
  let hostServer: Server;
  let hostUrl: string;
  let sandboxAttr = '';

  beforeAll(async () => {
    hostServer = createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html><html><body>
        <iframe id="demo" src="${base}?embed=1&doc=po-002" title="Production docs agent — demo"
          style="width:1000px;height:600px;border:0" sandbox="${sandboxAttr}"></iframe>
        <script>
          window.heights = [];
          addEventListener('message', (e) => {
            if (e.data && e.data.type === 'production-docs-agent:height') window.heights.push(e.data.height);
          });
        </script></body></html>`);
    });
    await new Promise<void>((resolve) => hostServer.listen(0, '127.0.0.1', resolve));
    hostUrl = `http://127.0.0.1:${(hostServer.address() as AddressInfo).port}/case-study`;
  });

  afterAll(() => new Promise<void>((resolve) => hostServer.close(() => resolve())));

  /** Opens the host page, which embeds the built demo with the given sandbox attribute. */
  async function embedOnHost(sandboxValue: string) {
    sandboxAttr = sandboxValue;
    await page.goto(hostUrl);
    return page.frameLocator('#demo');
  }

  it('stays empty without allow-same-origin (the bug the README snippet must avoid)', async () => {
    const frame = await embedOnHost('allow-scripts allow-downloads allow-popups');
    await page.waitForTimeout(1500);
    expect(await frame.locator('.field').count()).toBe(0);
    expect(errors.join(' | ')).toMatch(/from origin 'null' has been blocked by CORS/);
  });

  it('renders the demo inside an iframe with the documented sandbox', async () => {
    expect(sandbox).toBeDefined();
    const frame = await embedOnHost(sandbox!);
    await expect
      .poll(() => frame.getByRole('group', { name: /^Delivery date:/ }).getAttribute('aria-label'))
      .toBe('Delivery date: needs review');
    expect(await frame.locator('.topbar').count()).toBe(1);
    expect(await frame.locator('.topbar').isVisible()).toBe(false);
  });

  it('reports its content height to the host page', async () => {
    await embedOnHost(sandbox!);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { heights: number[] }).heights.length))
      .toBeGreaterThan(0);
    const heights = await page.evaluate(() => (window as unknown as { heights: number[] }).heights);
    expect(Math.max(...heights)).toBeGreaterThan(300);
  });

  it('documents a sandbox that keeps the frame same-origin with its own assets', () => {
    // Without allow-same-origin the frame's origin is "null" and Vite's crossorigin assets are
    // blocked by CORS: the frame stays empty (reproduced in the fresh-session review).
    expect(sandbox?.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'allow-scripts',
        'allow-same-origin',
        'allow-downloads',
        'allow-popups',
      ]),
    );
  });
});
