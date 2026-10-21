import { defineConfig } from 'vitest/config';

// Browser tests against the static build; run via `npm run test:e2e` (builds first).
export default defineConfig({
  test: { include: ['e2e/**/*.e2e.ts'], testTimeout: 30_000, fileParallelism: false },
});
