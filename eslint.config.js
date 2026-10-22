import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // zod is configured once (jitless, for a strict CSP) in src/domain/zod.ts; import it from there.
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    ignores: ['src/domain/zod.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'zod', message: 'Import z from src/domain/zod.ts (jitless config).' }] },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
