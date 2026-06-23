import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'

// Two Vitest projects in one config:
// - "unit" - happy-dom, for pure logic and composables (fast).
// - "browser" - real Chromium via Playwright, for virtualization and
//   anything that depends on real layout / scroll / ResizeObserver.
// File convention:
//   *.spec.ts unit (happy-dom)
//   *.browser.spec.ts  → browser
// Run:
//   npm run test:unit - unit only
//   npm run test:browser - browser only
//   npm test - both projects
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['tests/unit/**/*.spec.ts'],
          exclude: ['node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.browser.spec.ts'],
          setupFiles: ['./tests/browser/setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            // Each test runs in chromium / firefox / webkit.
            // Install browsers once before the first run:
            //   npx playwright install chromium firefox webkit
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
            headless: true,
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        // Type-only files - coverage not applicable.
        'src/tree-builder-core/types.ts',
        // Demo host + glue - covered by E2E, not unit/browser.
        'src/preview/**',
        'src/App.vue',
        'src/main.ts',
      ],
    },
  },
})
