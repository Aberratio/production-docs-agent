/**
 * Renders a sample document's source text as HTML. The same markup feeds the generated PDFs and the
 * document pane in the UI, so what the reviewer reads is what the model was given.
 *
 * Syntax: `# ` starts the heading, lines starting with `|` form a table (first row = header),
 * blank lines separate paragraphs.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => escapeHtml(c.trim()));
}

function table(rows: string[]): string {
  const [head = '', ...body] = rows;
  const th = cells(head)
    .map((c) => `<th>${c}</th>`)
    .join('');
  const trs = body
    .map(
      (r) =>
        `<tr>${cells(r)
          .map((c) => `<td>${c}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function renderDocumentHtml(text: string): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let rows: string[] = [];
  const flush = () => {
    if (paragraph.length)
      out.push(
        `<p>${paragraph.map((l) => `<span class="ln">${escapeHtml(l)}</span>`).join('<br>')}</p>`,
      );
    if (rows.length) out.push(table(rows));
    paragraph = [];
    rows = [];
  };
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('# ')) {
      flush();
      out.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
    } else if (line.trimStart().startsWith('|')) {
      if (paragraph.length) flush();
      rows.push(line);
    } else if (line.trim() === '') {
      flush();
    } else {
      if (rows.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return out.join('');
}
