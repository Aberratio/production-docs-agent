import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLES = join(import.meta.dirname, '..', 'src', 'styles');
const tokensCss = readFileSync(join(STYLES, 'tokens.css'), 'utf8');

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss);
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  return m[1].trim();
}

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4]) / 100];
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
  it('keep the agreed temporary brand values', () => {
    expect(token('color-bg')).toBe('#0b0f14');
    expect(token('color-surface')).toBe('#121821');
    expect(token('color-text')).toBe('#e6edf3');
    expect(token('color-text-muted')).toBe('#9aa7b4');
    expect(token('color-accent')).toBe('#5eead4');
    expect(token('color-warning')).toBe('#f59e0b');
    expect(token('color-danger')).toBe('#f87171');
    expect(token('font-sans')).toMatch(/^'Inter'/);
    expect(token('font-mono')).toMatch(/^'JetBrains Mono'/);
  });

  it('are the only place with colours or font values — other stylesheets use var(--…)', () => {
    for (const file of readdirSync(STYLES).filter((f) => f !== 'tokens.css')) {
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
    ['text on surface-2', () => c('text'), () => c('surface-2'), 4.5],
    ['muted on bg', () => c('text-muted'), () => c('bg'), 4.5],
    ['muted on surface', () => c('text-muted'), () => c('surface'), 4.5],
    ['muted on surface-2', () => c('text-muted'), () => c('surface-2'), 4.5],
    ['accent on surface', () => c('accent'), () => c('surface'), 4.5],
    ['warning on surface-2', () => c('warning'), () => c('surface-2'), 4.5],
    ['danger on surface-2', () => c('danger'), () => c('surface-2'), 4.5],
    ['on-accent on accent', () => c('on-accent'), () => c('accent'), 4.5],
    ['text on warning-soft', () => c('text'), () => tinted('warning-soft'), 4.5],
    ['muted on warning-soft', () => c('text-muted'), () => tinted('warning-soft'), 4.5],
    ['warning on warning-soft', () => c('warning'), () => tinted('warning-soft'), 4.5],
    ['danger on warning-soft', () => c('danger'), () => tinted('warning-soft'), 4.5],
    ['accent on accent-soft', () => c('accent'), () => tinted('accent-soft'), 4.5],
    ['danger on danger-soft', () => c('danger'), () => tinted('danger-soft'), 4.5],
    ['text on highlight', () => c('text'), () => tinted('highlight', 'bg'), 4.5],
  ];

  it.each(pairs)('meet WCAG AA contrast: %s', (_name, fg, bg, min) => {
    expect(contrast(fg(), bg())).toBeGreaterThanOrEqual(min);
  });
});
