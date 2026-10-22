import { en, type MessageKey } from './en.ts';
import { pl } from './pl.ts';
import { RECORDED_NOTES_PL } from './recorded-notes.pl.ts';

export type Lang = 'en' | 'pl';
export const LANGS: readonly Lang[] = ['en', 'pl'];

export type Params = Readonly<Record<string, string | number>>;

/** A message that is rendered in the reader's language: a dictionary key plus its values. */
export interface Msg {
  key: MessageKey;
  params?: Params;
}

export const DICTIONARIES: Readonly<Record<Lang, Readonly<Record<string, string>>>> = { en, pl };

/** Keys that take a count and pick a plural form (`<base>.one`, `.few`, `.many`, `.other`). */
export type PluralKey = 'data.summary.open' | 'export.open';

const isLang = (value: unknown): value is Lang => value === 'en' || value === 'pl';

/**
 * The UI language: `?lang=pl|en` wins (used when embedding), then the first browser language we
 * support, then English.
 */
export function resolveLang(search: string, browserLanguages: readonly string[]): Lang {
  const param = new URLSearchParams(search).get('lang')?.toLowerCase();
  if (isLang(param)) return param;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

function fill(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const template = DICTIONARIES[lang][key] ?? en[key];
  if (key === 'issue.modelNote' && lang === 'pl' && params) {
    const note = String(params['note']);
    return RECORDED_NOTES_PL[note] ?? note;
  }
  return fill(template, params);
}

export function tPlural(lang: Lang, base: PluralKey, count: number, params?: Params): string {
  const dict = DICTIONARIES[lang];
  const form = new Intl.PluralRules(lang).select(count);
  const template = dict[`${base}.${form}`] ?? dict[`${base}.other`] ?? '';
  return fill(template, { count, ...params });
}

export function format(lang: Lang, msg: Msg): string {
  return t(lang, msg.key, msg.params);
}

/** English rendering — what exports and logs carry, whatever the UI language. */
export const english = (msg: Msg): string => format('en', msg);
