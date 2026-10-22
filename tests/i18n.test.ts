import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCUMENTS } from '../src/documents/catalog.ts';
import { parseRecording } from '../src/domain/recording.ts';
import { en } from '../src/i18n/en.ts';
import { DICTIONARIES, LANGS, resolveLang, t, tPlural } from '../src/i18n/index.ts';
import { pl } from '../src/i18n/pl.ts';
import { RECORDED_NOTES_PL } from '../src/i18n/recorded-notes.pl.ts';

const PLURAL = /\.(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(PLURAL, '');
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('UI dictionaries', () => {
  it('define the same keys in Polish and English (plural forms aside)', () => {
    const keys = (dict: Record<string, string>) => [...new Set(Object.keys(dict).map(base))].sort();
    expect(keys(pl)).toEqual(keys(en));
  });

  it('have every plural form each language needs', () => {
    for (const lang of LANGS) {
      const dict = DICTIONARIES[lang];
      const plurals = new Set(
        Object.keys(dict)
          .filter((k) => PLURAL.test(k))
          .map(base),
      );
      const forms = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
      for (const key of plurals) {
        for (const form of forms)
          expect(dict, `${lang} ${key}.${form}`).toHaveProperty(`${key}.${form}`);
      }
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, text] of Object.entries(pl)) {
      const ref = en[key as keyof typeof en] ?? en[`${base(key)}.other` as keyof typeof en];
      expect(placeholders(text), key).toEqual(placeholders(ref));
    }
  });

  it('have no empty or untranslated Polish entries', () => {
    const sameOnPurpose = new Set([
      'tabs.format.pdf',
      'tabs.format.email',
      'docs.po-005.title',
      'status.auto',
      'field.was',
      'field.aria',
      'issue.modelNote',
    ]);
    for (const [key, text] of Object.entries(pl)) {
      expect(text.trim(), key).not.toBe('');
      if (!sameOnPurpose.has(key) && key in en) {
        expect(text, key).not.toBe(en[key as keyof typeof en]);
      }
    }
  });

  it('name and describe every sample document', () => {
    for (const doc of DOCUMENTS) {
      for (const lang of LANGS) {
        expect(DICTIONARIES[lang]).toHaveProperty(`docs.${doc.id}.title`);
        expect(DICTIONARIES[lang]).toHaveProperty(`docs.${doc.id}.scenario`);
      }
    }
  });

  it('pick Polish plural forms by count', () => {
    expect(tPlural('pl', 'data.summary.open', 1)).toBe(pl['data.summary.open.one']);
    expect(tPlural('pl', 'data.summary.open', 3)).toBe(pl['data.summary.open.few']);
    expect(tPlural('pl', 'data.summary.open', 5)).toBe(pl['data.summary.open.many']);
    expect(tPlural('pl', 'data.summary.open', 22)).toBe(pl['data.summary.open.few']);
    expect(tPlural('en', 'data.summary.open', 1)).toBe('field needs review');
    expect(tPlural('en', 'data.summary.open', 5)).toBe('fields need review');
  });

  it('fills placeholders', () => {
    expect(t('en', 'tabs.toReview', { count: 4 })).toBe('4 to review');
    expect(t('pl', 'tabs.toReview', { count: 4 })).toBe(
      pl['tabs.toReview'].replace('{count}', '4'),
    );
  });
});

describe('recorded model notes', () => {
  const notes = readdirSync('recordings').flatMap((file) => {
    const rec = parseRecording(JSON.parse(readFileSync(join('recordings', file), 'utf8')));
    const found: string[] = [];
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'note' && typeof child === 'string') found.push(child);
        else walk(child);
      }
    };
    walk(rec.extraction);
    return found;
  });

  it('have a Polish translation for every note', () => {
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(RECORDED_NOTES_PL, note).toHaveProperty([note]);
  });

  it('are shown translated in Polish and as written in English', () => {
    const note = 'Not stated in the document.';
    expect(t('pl', 'issue.modelNote', { note })).toBe(RECORDED_NOTES_PL[note]);
    expect(RECORDED_NOTES_PL[note]).not.toBe(note);
    expect(t('en', 'issue.modelNote', { note })).toBe(note);
    expect(t('pl', 'issue.modelNote', { note: 'A live note.' })).toBe('A live note.');
  });
});

describe('resolveLang', () => {
  it.each([
    ['?lang=pl', ['en-US'], 'pl'],
    ['?lang=EN', ['pl-PL'], 'en'],
    ['?doc=po-002&lang=pl&embed=1', [], 'pl'],
    ['', ['pl-PL', 'en'], 'pl'],
    ['', ['de-DE', 'pl'], 'pl'],
    ['', ['en-GB'], 'en'],
    ['', ['de-DE', 'fr'], 'en'],
    ['', [], 'en'],
    ['?lang=de', ['pl'], 'pl'],
  ])('%s with browser %j → %s', (search, browser, expected) => {
    expect(resolveLang(search, browser)).toBe(expected);
  });
});
