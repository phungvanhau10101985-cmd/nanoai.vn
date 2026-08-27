import { defineConfig, devices } from '@playwright/test'

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  testDir: './tests/partner-website',
  testMatch: /editor-live-parity\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  forbidOnly: isCi,
  retries: 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    browserName: 'chromium',
    ...(isCi ? {} : { channel: 'msedge' as const }),
    headless: true,
    locale: 'vi-VN',
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results/partner-website-parity',
})
