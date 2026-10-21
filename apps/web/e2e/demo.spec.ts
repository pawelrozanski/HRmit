import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Critical and serious axe violations only; the rest is reported in docs/ACCESSIBILITY.md. */
async function expectNoSeriousA11y(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

test('landing renders and leads to the demo', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'HRmit' })).toBeVisible()
  await expect(page.getByText('Your recruitment data stays home.')).toBeVisible()
  await page.getByRole('link', { name: 'Try the demo' }).click()
  await expect(page.getByRole('status')).toContainText('Demo mode')
  await expect(page.getByRole('link', { name: /Frontend Developer/ })).toBeVisible()
  await expectNoSeriousA11y(page)
})

test('kanban, drawer, reset and language', async ({ page }) => {
  await page.goto('./demo')
  await page.getByRole('link', { name: /Frontend Developer/ }).click()
  await expect(page.getByRole('heading', { name: 'Frontend Developer (React)' })).toBeVisible()
  for (const stage of ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'])
    await expect(page.getByRole('region', { name: stage })).toBeVisible()
  await expectNoSeriousA11y(page)

  // Keyboard path: the card is a button, the drawer's stage select moves the candidate.
  const card = page.getByRole('button', { name: 'Priya Lennox' })
  await card.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', { name: 'Priya Lennox' })).toBeVisible()
  await expect(drawer.getByText('AI assistant')).toBeVisible()
  await drawer.getByRole('combobox', { name: 'Move to stage' }).selectOption('offer')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Offer' }).getByText('Priya Lennox')).toBeVisible()

  // Persisted in localStorage, so it survives a reload and is gone after "Reset demo".
  await page.reload()
  await expect(page.getByRole('region', { name: 'Offer' }).getByText('Priya Lennox')).toBeVisible()
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(
    page.getByRole('region', { name: 'Applied' }).getByText('Priya Lennox'),
  ).toBeVisible()
})

test('settings: keyboard, theme, language, both themes pass axe', async ({ page }) => {
  await page.goto('./demo/settings')
  await expect(page).toHaveURL(/\/settings\/general$/)
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText(/Version \d+\.\d+\.\d+, demo mode/)).toBeVisible()
  await expectNoSeriousA11y(page)

  // Tab from the page start: skip link, demo banner, header links, then the selected tab.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Tab') // "Reset demo"
  await page.keyboard.press('Tab') // "HRmit"
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Jobs' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Teams' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Settings' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('tab', { name: 'General' })).toBeFocused()

  // Arrow keys move, activate and change the URL; Home/End jump; ArrowDown wraps.
  await page.keyboard.press('ArrowDown')
  await expect(page).toHaveURL(/\/settings\/ai$/)
  await expect(page.getByRole('tab', { name: 'AI settings' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'AI settings' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('heading', { name: 'AI settings' })).toBeVisible()
  await page.keyboard.press('End')
  await expect(page).toHaveURL(/\/settings\/templates$/)
  await page.keyboard.press('ArrowDown')
  await expect(page).toHaveURL(/\/settings\/general$/)

  // Theme select writes data-theme on <html>; axe passes in dark too.
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoSeriousA11y(page)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  // Language select switches the UI to Polish.
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pl')
  await expect(page.getByRole('link', { name: 'Stanowiska' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Tryb demo')
})

test('/templates redirects into settings', async ({ page }) => {
  await page.goto('./demo/templates')
  await expect(page).toHaveURL(/\/settings\/templates$/)
  await expect(page.getByRole('heading', { name: 'Email templates' })).toBeVisible()
})
