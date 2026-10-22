import { describe, expect, it } from 'vitest';
import { parentOrigin } from '../src/ui/embed.ts';

describe('parentOrigin — where the embed posts its height', () => {
  it('prefers the browser-reported ancestor origin', () => {
    expect(parentOrigin(['https://kokot.it'], 'https://other.example/page')).toBe(
      'https://kokot.it',
    );
  });

  it('falls back to the origin of the referrer', () => {
    expect(parentOrigin(undefined, 'https://kokot.it/realizacje/agent-dokumentow')).toBe(
      'https://kokot.it',
    );
  });

  it("falls back to '*' only when nothing identifies the parent (payload is just a height)", () => {
    expect(parentOrigin(undefined, '')).toBe('*');
    expect(parentOrigin([], 'not a url')).toBe('*');
  });

  it("ignores an opaque 'null' ancestor origin", () => {
    expect(parentOrigin(['null'], 'https://kokot.it/x')).toBe('https://kokot.it');
  });
});
