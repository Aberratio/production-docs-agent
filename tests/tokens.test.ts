import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLES = join(import.meta.dirname, '..', 'src', 'styles');
const tokensCss = readFileSync(join(STYLES, 'tokens.css'), 'utf8');

/** A token's value, with var(--…) references resolved (the brand maps semantics onto primitives). */
function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss);
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  const value = m[1].replace(/\s+/g, ' ').trim();
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  return ref?.[1] ? token(ref[1]) : value;
}

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)(%?)\)$/.exec(value);
  if (rgb) {
    const alpha = Number(rgb[4]) / (rgb[5] === '%' ? 100 : 1);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
  }
  throw new Error(`unsupported colour ${value}`);
}

/** Alpha-composites `top` over an opaque `bottom`. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a)).concat(1) as Rgba;
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: Rgba, bg: Rgba): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const c = (name: string) => parseColor(token(`color-${name}`));
const tinted = (soft: string, base = 'surface') => over(c(soft), c(base));

describe('design tokens', () => {
  it('carry the kokot.it brand values', () => {
    expect(token('color-bg')).toBe('#0b0d12');
    expect(token('color-bg-deep')).toBe('#07080b');
    expect(token('color-surface')).toBe('#11141b');
    expect(token('color-surface-raised')).toBe('#181c25');
    expect(token('color-line')).toBe('#2a303c');
    expect(token('color-line-strong')).toBe('#3d4452');
    expect(token('color-text')).toBe('#eceef3');
    expect(token('color-text-muted')).toBe('#a3a9b7');
    expect(token('color-text-subtle')).toBe('#7f8697');
    expect(token('color-accent')).toBe('#ffb547');
    expect(token('color-accent-2')).toBe('#8fb3ff');
    expect(token('color-success')).toBe('#4fd1a1');
    expect(token('color-warning')).toBe('#ffd166');
    expect(token('color-danger')).toBe('#ff7a7a');
    expect(token('font-sans')).toMatch(/^'Schibsted Grotesk'/);
    expect(token('font-mono')).toMatch(/^'JetBrains Mono'/);
  });

  it('load fonts self-hosted, never from a third-party server', () => {
    const fonts = readFileSync(join(STYLES, 'fonts.css'), 'utf8');
    expect(tokensCss).toContain("@import url('./fonts.css')");
    expect(tokensCss + fonts).not.toMatch(/fonts\.googleapis|fonts\.gstatic|https?:\/\//);
    const files = [...fonts.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
    expect(files).toHaveLength(4);
    for (const file of files) {
      expect(existsSync(join(STYLES, '..', 'assets', 'fonts', file!)), file).toBe(true);
    }
  });

  it('are the only place with colours or font values — other stylesheets use var(--…)', () => {
    for (const file of readdirSync(STYLES).filter(
      (f) => !['tokens.css', 'fonts.css'].includes(f),
    )) {
      const css = readFileSync(join(STYLES, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css, file).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(css, file).not.toMatch(/font-(size|weight|family):(?!\s*var\()[^;]*;/);
      expect(css, file).not.toMatch(/line-height:\s*[\d.]+;/);
    }
  });

  // [foreground, background, minimum ratio] — every pairing the stylesheet uses for text.
  const pairs: [string, () => Rgba, () => Rgba, number][] = [
    ['text on bg', () => c('text'), () => c('bg'), 4.5],
    ['text on surface', () => c('text'), () => c('surface'), 4.5],
    ['text on surface-raised', () => c('text'), () => c('surface-raised'), 4.5],
    ['muted on bg', () => c('text-muted'), () => c('bg'), 4.5],
    ['muted on surface', () => c('text-muted'), () => c('surface'), 4.5],
    ['muted on surface-raised', () => c('text-muted'), () => c('surface-raised'), 4.5],
    ['accent-2 (eyebrows) on surface', () => c('accent-2'), () => c('surface'), 4.5],
    ['on-accent on accent (primary buttons)', () => c('on-accent'), () => c('accent'), 4.5],
    ['success on surface-raised', () => c('success'), () => c('surface-raised'), 4.5],
    ['success on success-soft', () => c('success'), () => tinted('success-soft'), 4.5],
    ['warning on surface-raised', () => c('warning'), () => c('surface-raised'), 4.5],
    ['danger on surface-raised', () => c('danger'), () => c('surface-raised'), 4.5],
    ['text on warning-soft', () => c('text'), () => tinted('warning-soft'), 4.5],
    ['muted on warning-soft', () => c('text-muted'), () => tinted('warning-soft'), 4.5],
    ['warning on warning-soft', () => c('warning'), () => tinted('warning-soft'), 4.5],
    ['danger on warning-soft', () => c('danger'), () => tinted('warning-soft'), 4.5],
    ['success (approve) on warning-soft', () => c('success'), () => tinted('warning-soft'), 4.5],
    ['danger on danger-soft', () => c('danger'), () => tinted('danger-soft'), 4.5],
    ['text on highlight', () => c('text'), () => tinted('highlight', 'bg'), 4.5],
    ['input and button border on bg (non-text)', () => c('border-input'), () => c('bg'), 3],
    ['input border on surface (non-text)', () => c('border-input'), () => c('surface'), 3],
    [
      'input border on surface-raised (non-text)',
      () => c('border-input'),
      () => c('surface-raised'),
      3,
    ],
    ['highlight outline on bg (non-text)', () => c('warning'), () => c('bg'), 3],
    ['focus ring on bg (non-text)', () => c('focus'), () => c('bg'), 3],
    [
      'active tab border on surface-raised (non-text)',
      () => c('accent'),
      () => c('surface-raised'),
      3,
    ],
  ];

  it.each(pairs)('meet WCAG AA contrast: %s', (_name, fg, bg, min) => {
    expect(contrast(fg(), bg())).toBeGreaterThanOrEqual(min);
  });
});
