import { DOCUMENTS, findDocument, type SampleDocument } from '../documents/catalog.ts';
import { documentText, recordedRun } from '../documents/browser.ts';
import { renderDocumentHtml } from '../documents/render.ts';
import {
  resolveFields,
  validateDecision,
  type Decision,
  type ResolvedField,
} from '../domain/decisions.ts';
import {
  ORDER_COLUMNS,
  QUALITY_COLUMNS,
  toErpRecord,
  toSheetRows,
  type ErpRecord,
} from '../domain/mapping.ts';
import { extractionOf, type Recording } from '../domain/recording.ts';
import {
  labelKey,
  LINES_PLACEHOLDER,
  reviewExtraction,
  type ReviewItem,
} from '../domain/review.ts';
import { buildWorkbookSheets } from '../domain/workbook.ts';
import type { MessageKey } from '../i18n/en.ts';
import {
  format,
  LANGS,
  t,
  tPlural,
  type Lang,
  type Msg,
  type Params,
  type PluralKey,
} from '../i18n/index.ts';
import logoUrl from '../assets/brand/logo.svg';
import { download, h } from './dom.ts';
import { readExtractResponse } from './live-client.ts';
import { matchQuote } from './highlight.ts';

const LIVE = import.meta.env.MODE === 'live';

interface State {
  lang: Lang;
  docId: string;
  runs: Map<string, Recording>;
  decisions: Map<string, Record<string, Decision>>;
  selected: string | null;
  editing: string | null;
  editError: Msg | null;
  /** What the user typed into a correction that failed validation (kept across re-render). */
  editDraft: string | null;
  /** Element to focus after the next render (the editor it replaced is gone). */
  focusAfter: string | null;
  /** Why the last export failed (the browser's message), shown under the export buttons. */
  exportError: string | null;
  /** Whether the ERP JSON panel is expanded (kept across re-renders). */
  jsonOpen: boolean;
  live: { busy: boolean; error: string | null };
}

/** Upper-cases the first letter (line field labels are lower case after "Line n ·"). */
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface View {
  doc: SampleDocument;
  run: Recording;
  items: ReviewItem[];
  fields: ResolvedField[];
  record: ErpRecord;
}

export interface AppOptions {
  docId: string | null;
  lang: Lang;
  /** Called after the reader switches language (e.g. to keep `?lang=` in the address bar). */
  onLangChange?: (lang: Lang) => void;
}

export function startApp(root: HTMLElement, options: AppOptions): void {
  const initialDocId = options.docId;
  const state: State = {
    lang: options.lang,
    docId: initialDocId && findDocument(initialDocId) ? initialDocId : (DOCUMENTS[0]?.id ?? ''),
    runs: new Map(DOCUMENTS.map((d) => [d.id, recordedRun(d.id)])),
    decisions: new Map(),
    selected: null,
    editing: null,
    editError: null,
    editDraft: null,
    focusAfter: null,
    exportError: null,
    jsonOpen: false,
    live: { busy: false, error: null },
  };

  const tr = (key: MessageKey, params?: Params) => t(state.lang, key, params);
  const trPlural = (key: PluralKey, count: number) => tPlural(state.lang, key, count);
  const docKey = (id: string, part: 'title' | 'scenario') => `docs.${id}.${part}` as MessageKey;
  const statusLabel = (status: ResolvedField['status']) => tr(`status.${status}`);

  /** The field's label in the reader's language, from its review path. */
  const fieldLabel = (kind: Recording['kind'], path: string): string => {
    const line = /^lines\.(\d+)\.(\w+)$/.exec(path);
    if (line) {
      return tr('field.line.label', {
        n: Number(line[1]) + 1,
        field: tr(labelKey('line', line[2] ?? '')),
      });
    }
    return tr(labelKey(kind, path));
  };

  const viewOf = (docId: string): View => {
    const doc = findDocument(docId);
    const run = state.runs.get(docId);
    if (!doc || !run) throw new Error(`Unknown document ${docId}`);
    const extraction = extractionOf(run);
    const items = reviewExtraction(extraction, documentText(docId));
    const fields = resolveFields(items, state.decisions.get(docId) ?? {});
    return { doc, run, items, fields, record: toErpRecord(docId, extraction, fields) };
  };

  const decide = (path: string, decision: Decision | null) => {
    const others = Object.entries(state.decisions.get(state.docId) ?? {}).filter(
      ([p]) => p !== path,
    );
    state.decisions.set(
      state.docId,
      Object.fromEntries(decision ? [...others, [path, decision]] : others),
    );
    state.editing = null;
    state.editError = null;
    state.editDraft = null;
    state.focusAfter = `field:${path}`;
    render();
  };

  const currentDecisions = () => state.decisions.get(state.docId) ?? {};

  const closeEditor = (path: string) => {
    state.editing = null;
    state.editError = null;
    state.editDraft = null;
    state.focusAfter = `edit:${path}`;
    render();
  };

  const selectField = (path: string) => {
    if (state.selected === path) return;
    state.selected = path;
    highlightSource(viewOf(state.docId));
    markSelected();
  };

  const runExport = (task: () => Promise<void>) => {
    const hadError = state.exportError !== null;
    state.exportError = null;
    task().then(
      () => {
        if (hadError) render();
      },
      (error: unknown) => {
        state.exportError = error instanceof Error ? error.message : String(error);
        render();
      },
    );
  };

  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    const focusKey = state.focusAfter ?? active?.dataset['focus'];
    state.focusAfter = null;
    const view = viewOf(state.docId);
    document.documentElement.lang = state.lang;
    document.title = tr('app.pageTitle');
    root.replaceChildren(header(), tabs(), workspace(view), footer());
    highlightSource(view);
    revealActiveTab();
    if (focusKey) {
      root
        .querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  /** Keeps the active tab visible in the horizontally scrolling strip (narrow screens). */
  function revealActiveTab(): void {
    const strip = root.querySelector<HTMLElement>('.doc-tabs');
    const tab = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    // Not scrollIntoView: inside the case-study iframe that would also scroll the host page.
    strip.scrollLeft =
      tab.offsetLeft - strip.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
  }

  function header(): HTMLElement {
    return h(
      'header',
      { class: 'topbar' },
      h(
        'div',
        { class: 'brand' },
        h('img', { class: 'brand-mark', src: logoUrl, alt: 'kokot.it' }),
        h('span', { class: 'brand-sep', 'aria-hidden': 'true' }, '/'),
        h('h1', {}, tr('app.title')),
      ),
      h('p', { class: 'tagline' }, tr('app.tagline')),
      h(
        'span',
        {
          class: `mode mode-${LIVE ? 'live' : 'recorded'}`,
          title: tr(LIVE ? 'mode.live.hint' : 'mode.recorded.hint'),
        },
        tr(LIVE ? 'mode.live' : 'mode.recorded'),
      ),
      languageSwitch(),
    );
  }

  function languageSwitch(): HTMLElement {
    return h(
      'div',
      { class: 'lang-switch', role: 'group', 'aria-label': tr('lang.label') },
      ...LANGS.map((lang) =>
        h(
          'button',
          {
            class: 'lang-option',
            type: 'button',
            lang,
            'aria-pressed': lang === state.lang ? 'true' : 'false',
            'data-focus': `lang:${lang}`,
            title: lang === 'pl' ? 'Polski' : 'English',
            onClick: () => {
              if (state.lang === lang) return;
              state.lang = lang;
              options.onLangChange?.(lang);
              render();
            },
          },
          lang.toUpperCase(),
        ),
      ),
    );
  }

  function tabs(): HTMLElement {
    return h(
      'nav',
      { class: 'doc-tabs', 'aria-label': tr('tabs.label') },
      ...DOCUMENTS.map((d) => {
        const v = viewOf(d.id);
        const open = v.record.review.open_fields.length;
        return h(
          'button',
          {
            class: 'doc-tab',
            type: 'button',
            'aria-current': d.id === state.docId ? 'true' : undefined,
            'data-focus': `tab:${d.id}`,
            onClick: () => {
              state.docId = d.id;
              state.selected = null;
              state.editing = null;
              state.live.error = null;
              state.exportError = null;
              render();
            },
          },
          h(
            'span',
            { class: 'doc-tab-top' },
            h('span', { class: 'doc-id' }, d.id),
            h('span', { class: 'doc-format' }, tr(`tabs.format.${d.format}`)),
          ),
          h('span', { class: 'doc-tab-title' }, tr(docKey(d.id, 'title'))),
          h(
            'span',
            { class: `pill ${open ? 'pill-warn' : 'pill-ok'}` },
            open ? tr('tabs.toReview', { count: open }) : tr('tabs.ready'),
          ),
        );
      }),
    );
  }

  function workspace(view: View): HTMLElement {
    return h('main', { class: 'workspace' }, documentPane(view), dataPane(view));
  }

  function documentPane(view: View): HTMLElement {
    const { doc } = view;
    const original = `./documents/${doc.id}.${doc.format === 'pdf' ? 'pdf' : 'txt'}`;
    const paper = h('article', {
      class: `paper paper-${doc.format}`,
      'aria-label': tr('doc.aria', { title: tr(docKey(doc.id, 'title')) }),
    });
    // Safe: renderDocumentHtml escapes all document text.
    paper.innerHTML = renderDocumentHtml(documentText(doc.id));
    return h(
      'section',
      { class: 'pane doc-pane', 'aria-labelledby': 'doc-title' },
      h(
        'div',
        { class: 'pane-head' },
        h(
          'div',
          {},
          h('p', { class: 'eyebrow' }, tr(`doc.kind.${doc.kind}`)),
          h('h2', { id: 'doc-title' }, tr(docKey(doc.id, 'title'))),
          h('p', { class: 'scenario' }, tr(docKey(doc.id, 'scenario'))),
        ),
        h(
          'div',
          { class: 'pane-actions' },
          h(
            'a',
            { class: 'btn btn-ghost', href: original, target: '_blank', rel: 'noopener' },
            tr(`doc.open.${doc.format}`),
          ),
          LIVE
            ? h(
                'button',
                {
                  class: 'btn btn-primary',
                  type: 'button',
                  disabled: state.live.busy,
                  'data-focus': 'live',
                  onClick: () => void runLive(doc.id),
                },
                tr(state.live.busy ? 'doc.extracting' : 'doc.extract'),
              )
            : null,
        ),
      ),
      state.live.error
        ? h(
            'p',
            { class: 'alert', role: 'alert' },
            tr('doc.liveFailed', { error: state.live.error }),
          )
        : null,
      paper,
    );
  }

  function dataPane(view: View): HTMLElement {
    const { record, run, fields } = view;
    const open = record.review.open_fields.length;
    const decided = record.review.approved_fields.length + record.review.corrected_fields.length;
    const runInfo =
      run.source === 'live'
        ? tr('data.run.live', {
            model: run.model ?? tr('data.run.unknownModel'),
            at: run.recorded_at ?? '',
          })
        : tr('data.run.recorded');
    return h(
      'section',
      { class: 'pane data-pane', 'aria-labelledby': 'data-title' },
      h(
        'div',
        { class: 'pane-head' },
        h(
          'div',
          {},
          h('p', { class: 'eyebrow' }, tr(`data.eyebrow.${record.record_type}`)),
          h('h2', { id: 'data-title' }, tr('data.title')),
          h('p', { class: 'run-info' }, runInfo),
        ),
        h(
          'div',
          { class: `summary ${open ? 'summary-warn' : 'summary-ok'}`, 'aria-live': 'polite' },
          h('strong', {}, open ? String(open) : '✓'),
          h('span', {}, open ? trPlural('data.summary.open', open) : tr('data.summary.ready')),
          decided
            ? h('span', { class: 'summary-sub' }, tr('data.summary.decided', { count: decided }))
            : null,
        ),
      ),
      h('div', { class: 'fields' }, ...fieldGroups(view)),
      exportBar(view, fields),
    );
  }

  function fieldGroups(view: View): HTMLElement[] {
    const byPath = new Map(view.fields.map((f) => [f.path, f]));
    const itemByPath = new Map(view.items.map((i) => [i.path, i]));
    const row = (path: string) => {
      const f = byPath.get(path);
      const item = itemByPath.get(path);
      return f && item ? fieldRow(f, item, view.items, view.run.kind) : null;
    };
    const header = view.fields.filter((f) => !f.path.startsWith('lines.')).map((f) => f.path);
    const groups = [
      h(
        'div',
        { class: 'group' },
        h('h3', { class: 'group-title' }, tr('data.group.header')),
        ...header.map(row),
      ),
    ];
    if (view.run.kind === 'purchase_order') {
      view.run.extraction.lines.forEach((line, i) => {
        const code = line.item_code.value ?? tr('data.group.noCode');
        groups.push(
          h(
            'div',
            { class: 'group group-line' },
            h('h3', { class: 'group-title' }, tr('data.group.line', { n: i + 1, code })),
            ...['item_code', 'description', 'quantity', 'unit', 'unit_price'].map((k) =>
              row(`lines.${i}.${k}`),
            ),
          ),
        );
      });
    }
    return groups;
  }

  function display(f: { type: string }, value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (f.type === 'money' && typeof value === 'number') return value.toFixed(2);
    return String(value);
  }

  function fieldRow(
    f: ResolvedField,
    item: ReviewItem,
    items: ReviewItem[],
    kind: Recording['kind'],
  ): HTMLElement {
    const editing = state.editing === f.path;
    const shown = f.status === 'needs_review' ? f.proposed : f.value;
    const fullLabel = fieldLabel(kind, f.path);
    const lineKey = /^lines\.\d+\.(\w+)$/.exec(f.path)?.[1];
    // Inside a line group the "Line n ·" prefix is already in the group title.
    const label = capitalize(lineKey ? tr(labelKey('line', lineKey)) : fullLabel);
    const conf = item.field.confidence;
    const children: (HTMLElement | null)[] = [
      h(
        'div',
        { class: 'field-head' },
        h('span', { class: 'field-label' }, label),
        h(
          'span',
          { class: `conf conf-${conf}`, title: tr('field.confidence') },
          tr(`conf.${conf}`),
        ),
        h('span', { class: `status status-${f.status}` }, statusLabel(f.status)),
      ),
      h(
        'div',
        { class: 'field-value' },
        h('span', { class: shown === null ? 'value value-empty' : 'value' }, display(f, shown)),
        f.status === 'corrected'
          ? h('span', { class: 'was' }, tr('field.was', { value: display(f, f.proposed) }))
          : null,
      ),
    ];
    if (f.issues.length) {
      children.push(
        h(
          'ul',
          { class: 'issues' },
          ...f.issues.map((i) =>
            h(
              'li',
              { class: `issue issue-${i.code}` },
              h('span', { class: 'issue-code' }, tr(`issueCode.${i.code}`)),
              h('span', {}, format(state.lang, i.msg)),
            ),
          ),
        ),
      );
    }
    if (editing) {
      const input = h('input', {
        class: 'input',
        type: 'text',
        value: state.editDraft ?? (shown === null ? '' : String(shown)),
        'aria-label': tr('field.correctAria', { label: fullLabel }),
        'data-focus': `input:${f.path}`,
        placeholder: f.type === 'date' ? tr('field.datePlaceholder') : '',
      }) as HTMLInputElement;
      const save = () => {
        const decision: Decision = { action: 'correct', value: input.value };
        const error = validateDecision(item, decision, items, currentDecisions());
        if (error) {
          state.editError = error;
          state.editDraft = input.value;
          render();
          return;
        }
        decide(f.path, decision);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') closeEditor(f.path);
      });
      children.push(
        h(
          'div',
          { class: 'editor' },
          input,
          h(
            'button',
            { class: 'btn btn-primary', type: 'button', onClick: save },
            tr('action.save'),
          ),
          h(
            'button',
            {
              class: 'btn btn-ghost',
              type: 'button',
              onClick: () => closeEditor(f.path),
            },
            tr('action.cancel'),
          ),
        ),
        state.editError
          ? h('p', { class: 'edit-error', role: 'alert' }, format(state.lang, state.editError))
          : null,
      );
      queueMicrotask(() => {
        if (document.activeElement === document.body) input.focus();
      });
    } else {
      const actions: HTMLElement[] = [];
      if (
        f.status === 'needs_review' &&
        validateDecision(item, { action: 'approve' }, items, currentDecisions()) === null
      ) {
        actions.push(
          h(
            'button',
            {
              class: 'btn btn-approve',
              type: 'button',
              'data-focus': `approve:${f.path}`,
              onClick: () => decide(f.path, { action: 'approve' }),
            },
            tr('action.approve'),
          ),
        );
      }
      // The missing-lines placeholder can only be fixed at the source, never typed in here.
      if (f.path !== LINES_PLACEHOLDER) {
        actions.push(
          h(
            'button',
            {
              class: f.status === 'needs_review' ? 'btn btn-ghost' : 'btn btn-quiet',
              type: 'button',
              'data-focus': `edit:${f.path}`,
              onClick: () => {
                state.editing = f.path;
                state.editError = null;
                state.editDraft = null;
                state.selected = f.path;
                render();
              },
            },
            tr(f.status === 'needs_review' ? 'action.correct' : 'action.edit'),
          ),
        );
      }
      if (f.status === 'approved' || f.status === 'corrected') {
        actions.push(
          h(
            'button',
            {
              class: 'btn btn-quiet',
              type: 'button',
              'data-focus': `undo:${f.path}`,
              onClick: () => decide(f.path, null),
            },
            tr('action.undo'),
          ),
        );
      }
      children.push(h('div', { class: 'field-actions' }, ...actions));
    }
    return h(
      'div',
      {
        class: [
          'field',
          `field-${f.status}`,
          f.issues.length || editing ? 'field-wide' : '',
          state.selected === f.path ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' '),
        'data-path': f.path,
        role: 'group',
        'aria-label': tr('field.aria', { label: fullLabel, status: statusLabel(f.status) }),
        // Focusable so keyboard users can select a field and see its source highlighted.
        tabindex: '0',
        'data-focus': `field:${f.path}`,
        onFocus: (e: Event) => {
          if (e.target === e.currentTarget) selectField(f.path);
        },
        onClick: () => selectField(f.path),
      },
      ...children,
    );
  }

  /** Scrolls only the document pane — never the page, and never the host page around an iframe. */
  function revealInPaper(paper: HTMLElement, target: HTMLElement | undefined): void {
    if (!target) return;
    const box = paper.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    if (t.top >= box.top && t.bottom <= box.bottom) return;
    paper.scrollTop += t.top - box.top - box.height / 3;
  }

  function markSelected(): void {
    root.querySelectorAll('.field.is-selected').forEach((el) => el.classList.remove('is-selected'));
    if (state.selected) {
      root
        .querySelector(`.field[data-path="${CSS.escape(state.selected)}"]`)
        ?.classList.add('is-selected');
    }
  }

  function highlightSource(view: View): void {
    const paper = root.querySelector('.paper');
    if (!paper) return;
    paper.querySelectorAll('.hl').forEach((el) => el.classList.remove('hl'));
    const item = view.items.find((i) => i.path === state.selected);
    const lines = [...paper.querySelectorAll<HTMLElement>('.ln, tbody tr, h1')];
    const groups = [...paper.querySelectorAll<HTMLElement>('p, table')];
    const text = (el: HTMLElement) =>
      el.tagName === 'TR'
        ? [...el.children].map((c) => c.textContent ?? '').join(' | ')
        : (el.textContent ?? '');
    const match = matchQuote(
      lines.map(text),
      item?.field.source_text ?? null,
      groups.map((g) => g.innerText || g.textContent || ''),
    );
    const targets = [
      ...match.lines.map((i) => lines[i]),
      ...match.groups.map((i) => groups[i]),
    ].filter((el): el is HTMLElement => el !== undefined);
    targets.forEach((el) => el.classList.add('hl'));
    revealInPaper(paper as HTMLElement, targets[0]);
  }

  function exportBar(view: View, fields: ResolvedField[]): HTMLElement {
    const open = view.record.review.open_fields.length;
    const json = JSON.stringify(view.record, null, 2);
    return h(
      'div',
      { class: 'export' },
      h(
        'div',
        { class: 'export-actions' },
        h(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            'data-focus': 'csv',
            onClick: () => runExport(() => exportCsv(view)),
          },
          tr('export.csv'),
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost',
            type: 'button',
            'data-focus': 'xlsx',
            onClick: () => runExport(exportXlsx),
          },
          tr('export.xlsx'),
        ),
      ),
      state.exportError
        ? h(
            'p',
            { class: 'alert', role: 'alert' },
            tr('export.failed', { error: state.exportError }),
          )
        : null,
      h(
        'p',
        { class: 'export-note' },
        open ? trPlural('export.open', open) : tr('export.allResolved', { count: fields.length }),
      ),
      h(
        'details',
        {
          class: 'json',
          open: state.jsonOpen,
          onToggle: (e: Event) => {
            state.jsonOpen = (e.currentTarget as HTMLDetailsElement).open;
          },
        },
        h('summary', {}, tr('export.json')),
        h('pre', {}, h('code', {}, json)),
      ),
    );
  }

  async function exportCsv(view: View): Promise<void> {
    const { toCsv } = await import('../domain/export.ts');
    const columns = view.record.record_type === 'sales_order' ? ORDER_COLUMNS : QUALITY_COLUMNS;
    const csv = toCsv(columns, toSheetRows(view.record), { bom: true });
    download(`${view.doc.id}-${view.record.record_type}.csv`, csv, 'text/csv;charset=utf-8');
  }

  async function exportXlsx(): Promise<void> {
    const { toXlsx } = await import('../domain/export.ts');
    const entries = DOCUMENTS.map((d) => {
      const v = viewOf(d.id);
      return { documentId: d.id, extraction: extractionOf(v.run), fields: v.fields };
    });
    const bytes = toXlsx(buildWorkbookSheets(entries));
    download(
      'production-docs-export.xlsx',
      bytes as Uint8Array<ArrayBuffer>,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }

  async function runLive(docId: string): Promise<void> {
    state.live = { busy: true, error: null };
    render();
    try {
      const res = await fetch('./api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });
      state.runs.set(docId, await readExtractResponse(res));
      state.decisions.delete(docId);
      state.live = { busy: false, error: null };
    } catch (error) {
      state.live = {
        busy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    render();
  }

  function footer(): HTMLElement {
    return h(
      'footer',
      { class: 'foot' },
      h('p', { class: 'foot-note' }, tr('foot.note')),
      h(
        'a',
        { class: 'by', href: 'https://kokot.it', target: '_blank', rel: 'noopener' },
        '© 2026 kokot.it',
      ),
    );
  }

  render();
}
