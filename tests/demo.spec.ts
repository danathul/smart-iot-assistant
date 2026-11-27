import { expect, test } from '@playwright/test'

test('all simulator scenarios propagate to the dashboard and alerts', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome to NEST AI' })).toBeVisible()
  await page.getByRole('link', { name: 'Open dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Everything is safe' })).toBeVisible()
  await expect(page.locator('.hero')).toHaveCSS('background-color', 'rgb(221, 240, 227)')
  for (const [label, value, status] of [
    ['Gas Leak', '860 ppm', 'Gas Leak detected'],
    ['High Temp', '38.2 °C', 'High Temp detected'],
    ['High Energy', '1,450 W', 'High Energy detected'],
    ['Normal', '120 ppm', 'Everything is safe'],
  ]) {
    await page.getByRole('link', { name: 'Simulator', exact: true }).last().click()
    await page.getByRole('button', { name: new RegExp(label) }).click()
    await expect(page.getByText(value, { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'View dashboard' }).click()
    await expect(page.getByRole('heading', { name: status })).toBeVisible()
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Alerts' }).click()
  await page.getByRole('button', { name: 'Warning' }).click()
  await expect(page.getByRole('heading', { name: 'High energy usage' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gas level above threshold' })).toHaveCount(0)
})

test('analytics supports all sensors and mobile layout stays within the viewport', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()) })
  await page.goto('/#analytics')
  for (const sensor of ['Temperature', 'Humidity', 'Gas Level', 'Energy']) {
    await page.getByRole('button', { name: sensor, exact: true }).click()
    await expect(page.getByRole('img', { name: sensor + ' history chart' })).toBeVisible()
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(9)
    await expect(page.getByText('Last updated')).toBeVisible()
  }
  await page.goto('/#overview')
  await expect(page.getByRole('heading', { name: 'Everything is safe' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({ path: info.outputPath('overview.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('assistant replies use the current reading and work offline in demo mode', async ({ page, context }) => {
  await page.goto('/#simulator')
  await page.getByRole('button', { name: /Gas Leak/ }).click()
  await page.getByRole('navigation').locator('a[href="#assistant"]').click()
  await page.getByText('Response settings', { exact: true }).click()
  await page.getByRole('button', { name: 'Cloud', exact: true }).click()
  await page.getByRole('button', { name: 'Is the gas level safe?' }).click()
  await expect(page.getByText(/Gas Level is 860 ppm/)).toBeVisible()
  await expect(page.getByText(/Last response · IN CLOUD/)).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText(/Offline · simulation is available/)).toBeVisible()
  await page.getByRole('button', { name: 'On-device' }).click()
  await page.getByRole('textbox', { name: 'Message' }).fill('humidity')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(/Humidity is 48 %/)).toBeVisible()
  await expect(page.getByText(/Last response · ON DEVICE/)).toBeVisible()
})

