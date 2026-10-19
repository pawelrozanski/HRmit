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

  await page.getByRole('button', { name: 'pl' }).click()
  await expect(page.getByRole('link', { name: 'Stanowiska' })).toBeVisible()
  await expect(page.getByText('Tryb demo')).toBeVisible()
})

test('settings page', async ({ page }) => {
  await page.goto('./demo/settings')
  await expect(page.getByRole('heading', { name: 'AI settings' })).toBeVisible()
  await expectNoSeriousA11y(page)
})
