import { describe, expect, it } from 'vitest';
import { findForbiddenWording } from '../scripts/wording.ts';

describe('wording guard', () => {
  it.each([
    'Production docs agent — demo',
    'Demo by kokot.it',
    'DEMO MODE',
    'recorded demo',
    'dane demonstracyjne',
    'a demonstration of the pattern',
    'zakupy@demo-maszyny.example',
    'const isDemo = true',
    'prezentacja demo',
    'demographic data',
    'Demographics',
    'demotest',
    'the demoted build',
    'predemo',
  ])('flags %j', (text) => {
    expect(findForbiddenWording(text)).toHaveLength(1);
  });

  it.each([
    '`DEMOTE`,204:`SHOW.DETAIL`',
    'demote',
    'O(`$ZodEmoji`,(e,t)=>{})',
    'Recorded run · Sample data · fictional companies',
  ])('allows %j', (text) => {
    expect(findForbiddenWording(text)).toEqual([]);
  });

  it('reports the line of each hit', () => {
    expect(findForbiddenWording('ok\nok\na demo here').map((h) => h.line)).toEqual([3]);
  });
});
