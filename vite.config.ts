/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import { liveExtractionPlugin } from './src/live/vite-plugin';

export default defineConfig(({ mode }) => {
  // Live mode only: read .env in Node. No VITE_ prefix, so nothing reaches the browser bundle.
  const env = mode === 'live' ? loadEnv(mode, process.cwd(), '') : {};
  return {
    base: './',
    build: { target: 'es2022' },
    server: { host: 'localhost' },
    plugins:
      mode === 'live'
        ? [liveExtractionPlugin({ apiKey: env['ANTHROPIC_API_KEY'], model: env['CLAUDE_MODEL'] })]
        : [],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
