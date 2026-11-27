import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173', channel: process.env.IOT_TEST_BROWSER },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --bypass-lock', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1024 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})

