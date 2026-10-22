import { describe, expect, it } from 'vitest';
import { renderDocumentHtml } from '../src/documents/render.ts';

describe('renderDocumentHtml', () => {
  it('renders a "# " line as the document heading', () => {
    expect(renderDocumentHtml('# PURCHASE ORDER NO 1')).toBe('<h1>PURCHASE ORDER NO 1</h1>');
  });

  it('renders consecutive pipe rows as a table with the first row as header', () => {
    const html = renderDocumentHtml('| No. | Qty |\n| 1 | 400 |');
    expect(html).toBe(
      '<table><thead><tr><th>No.</th><th>Qty</th></tr></thead>' +
        '<tbody><tr><td>1</td><td>400</td></tr></tbody></table>',
    );
  });

  it('keeps empty table cells', () => {
    expect(renderDocumentHtml('| a | b |\n| 1 | |')).toContain('<td>1</td><td></td>');
  });

  it('groups other lines into paragraphs separated by blank lines, keeping line breaks', () => {
    expect(renderDocumentHtml('Od: A\nDo: B\n\nBody')).toBe(
      '<p><span class="ln">Od: A</span><br><span class="ln">Do: B</span></p>' +
        '<p><span class="ln">Body</span></p>',
    );
  });

  it('escapes HTML in headings and table cells too', () => {
    expect(renderDocumentHtml('# A <b>&')).toBe('<h1>A &lt;b&gt;&amp;</h1>');
    expect(renderDocumentHtml('| <x> |\n| "&" |')).toContain('<th>&lt;x&gt;</th>');
    expect(renderDocumentHtml('| <x> |\n| "&" |')).toContain('<td>&quot;&amp;&quot;</td>');
  });

  it('escapes HTML in the document text', () => {
    expect(renderDocumentHtml('Od: Anna <a@b.example> & "x"')).toBe(
      '<p><span class="ln">Od: Anna &lt;a@b.example&gt; &amp; &quot;x&quot;</span></p>',
    );
  });
});
