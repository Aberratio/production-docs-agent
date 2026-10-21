import { describe, expect, it } from 'vitest';
import { renderDocumentHtml } from '../src/documents/render';

describe('renderDocumentHtml', () => {
  it('renders a "# " line as the document heading', () => {
    expect(renderDocumentHtml('# ZAMÓWIENIE NR 1')).toBe('<h1>ZAMÓWIENIE NR 1</h1>');
  });

  it('renders consecutive pipe rows as a table with the first row as header', () => {
    const html = renderDocumentHtml('| Lp. | Ilość |\n| 1 | 400 |');
    expect(html).toBe(
      '<table><thead><tr><th>Lp.</th><th>Ilość</th></tr></thead>' +
        '<tbody><tr><td>1</td><td>400</td></tr></tbody></table>',
    );
  });

  it('keeps empty table cells', () => {
    expect(renderDocumentHtml('| a | b |\n| 1 | |')).toContain('<td>1</td><td></td>');
  });

  it('groups other lines into paragraphs separated by blank lines, keeping line breaks', () => {
    expect(renderDocumentHtml('Od: A\nDo: B\n\nTreść')).toBe('<p>Od: A<br>Do: B</p><p>Treść</p>');
  });

  it('escapes HTML in the document text', () => {
    expect(renderDocumentHtml('Od: Anna <a@b.example> & "x"')).toBe(
      '<p>Od: Anna &lt;a@b.example&gt; &amp; &quot;x&quot;</p>',
    );
  });
});
