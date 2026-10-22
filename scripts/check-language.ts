/**
 * Fails (exit 1) if Polish text appears in a tracked file outside the allowed content paths
 * (scripts/language.ts lists them with the reason). Run with `npm run check:language`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findPolishText, isLanguageChecked, POLISH_ALLOWED } from './language.ts';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(isLanguageChecked);

const problems: string[] = [];
for (const file of files) {
  for (const hit of findPolishText(readFileSync(file, 'utf8'))) {
    problems.push(`${file}:${hit.line}: ${hit.excerpt}`);
  }
}

if (problems.length) {
  console.error(`Polish text outside the allowed paths in ${problems.length} line(s):`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `Move UI text to src/i18n/, keep sample data under: ${POLISH_ALLOWED.map((a) => a.prefix).join(', ')}`,
  );
  process.exit(1);
}
console.info(`language check passed: ${files.length} files scanned, no Polish outside content.`);
