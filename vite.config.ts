/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type PluginOption } from 'vite';

/**
 * Live mode only: read .env in Node and add the extraction endpoint. No VITE_ prefix, so nothing
 * reaches the browser bundle. Imported lazily so recorded mode never loads the server code.
 */
async function livePlugins(mode: string): Promise<PluginOption[]> {
  if (mode !== 'live') return [];
  const env = loadEnv(mode, process.cwd(), '');
  const { liveExtractionPlugin } = await import('./src/live/vite-plugin.ts');
  return [liveExtractionPlugin({ apiKey: env['ANTHROPIC_API_KEY'], model: env['CLAUDE_MODEL'] })];
}

export default defineConfig(async ({ mode }) => ({
  base: './',
  build: { target: 'es2022' },
  server: { host: 'localhost' },
  plugins: await livePlugins(mode),
  test: { include: ['tests/**/*.test.ts'] },
}));
