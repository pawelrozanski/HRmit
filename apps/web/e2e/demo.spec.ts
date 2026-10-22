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
  await expect(page.getByRole('link', { name: 'Recruitments' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Employees' })).toBeFocused()
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
  await expect(page.getByRole('link', { name: 'Rekrutacje' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Tryb demo')
})

test('AI settings: provider chooser, cloud consent, local switch, axe on the dialog', async ({
  page,
}) => {
  await page.goto('./demo/settings/ai')
  const tile = page.getByRole('button', { name: /^Choose a provider/ })
  await expect(tile).toContainText('Ollama')
  await expect(page.getByLabel('API key')).toHaveCount(0)

  // A cloud provider asks for consent first; cancelling keeps Ollama.
  await tile.click()
  const chooser = page.getByRole('dialog', { name: 'Choose a provider' })
  await expect(chooser.getByRole('button', { name: /^Ollama/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expectNoSeriousA11y(page)
  await chooser.getByRole('button', { name: /^OpenAI/ }).click()
  const consent = page.getByRole('dialog', { name: /Send anonymized data to OpenAI/ })
  await expect(consent).toContainText('api.openai.com')
  await consent.getByRole('button', { name: 'Cancel' }).click()
  await expect(consent).toBeHidden()
  await expect(tile).toContainText('Ollama')
  await expect(page.getByLabel('Base URL')).toHaveValue('http://localhost:11434/v1')

  // Escape closes the chooser; a local provider switches without consent.
  await tile.click()
  await page.keyboard.press('Escape')
  await expect(chooser).toBeHidden()
  await tile.click()
  await chooser.getByRole('button', { name: /^LM Studio/ }).click()
  await expect(tile).toContainText('LM Studio')
  await expect(page.getByLabel('Base URL')).toHaveValue('http://localhost:1234/v1')
  await expect(page.getByLabel('API key')).toHaveCount(0)
  await expectNoSeriousA11y(page)
})

test('/templates redirects into settings', async ({ page }) => {
  await page.goto('./demo/templates')
  await expect(page).toHaveURL(/\/settings\/templates$/)
  await expect(page.getByRole('heading', { name: 'Email templates' })).toBeVisible()
})

test('/jobs/:id redirects to the recruitment', async ({ page }) => {
  await page.goto('./demo/jobs/1')
  await expect(page).toHaveURL(/\/recruitments\/1$/)
  await expect(page.getByRole('heading', { name: 'Frontend Developer (React)' })).toBeVisible()
})

test('employees and teams: create a team, add two members, assign a recruitment', async ({
  page,
}) => {
  await page.goto('./demo/employees')
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search by name or position' }).fill('support')
  await expect(page.getByRole('button', { name: /Zofia Mazur/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Hanna Sorlie/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Zofia Mazur/ }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', { name: 'Zofia Mazur' })).toBeVisible()
  await expect(drawer.getByText('Escalates product bugs to engineering.')).toBeVisible()
  await expect(drawer.getByText('No notes yet.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Add note' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Add note' })
  await addDialog.getByRole('textbox', { name: 'Note' }).fill('Prefers afternoon panels.')
  await expectNoSeriousA11y(page)
  await addDialog.getByRole('button', { name: 'Save' }).click()
  await expect(addDialog).toHaveCount(0)
  const today = new Date().toLocaleDateString('en', { dateStyle: 'medium' })
  const untitled = drawer.getByRole('button', { name: /Untitled note/ })
  await expect(untitled).toContainText(today)
  await expect(drawer.getByText('No notes yet.')).toHaveCount(0)
  await untitled.click()
  const readDialog = page.getByRole('dialog', { name: 'Untitled note' })
  await expect(readDialog.getByText('Prefers afternoon panels.')).toBeVisible()
  await expect(readDialog).toHaveCSS('opacity', '1') // let the fade-in finish before axe
  await expectNoSeriousA11y(page)
  page.once('dialog', (d) => d.accept())
  await readDialog.getByRole('button', { name: 'Delete' }).click()
  await expect(readDialog).toHaveCount(0)
  await expect(drawer.getByText('No notes yet.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Add note' }).click()
  await addDialog.getByRole('textbox', { name: 'Title (optional)' }).fill('Panels')
  await addDialog.getByRole('textbox', { name: 'Note' }).fill('Afternoons only.')
  await addDialog.getByRole('textbox', { name: 'Note' }).press('Control+Enter')
  await expect(drawer.getByRole('button', { name: /Panels/ })).toContainText(today)
  await page.keyboard.press('Escape')

  await page.goto('./demo/teams')
  await expect(page.getByRole('link', { name: /Marketing/ })).toContainText('2 members')
  await expectNoSeriousA11y(page)
  await page.getByRole('button', { name: 'New team' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Legal')
  await page.getByRole('textbox', { name: 'Description' }).fill('Contracts and compliance.')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: /Legal/ }).click()
  await expect(page.getByRole('heading', { name: 'Legal' })).toBeVisible()
  await expect(page.getByText('No members yet.')).toBeVisible()

  // Keyboard path through the add-members dialog: search, Tab to the boxes, Space, Enter.
  await page.getByRole('button', { name: 'Add members' }).click()
  const search = page.getByRole('searchbox', { name: 'Search employees' })
  await expect(search).toBeFocused()
  await search.fill('ma')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Add 2' })).toBeEnabled()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Members (2)' })).toBeVisible()
  await page.getByRole('button', { name: 'Make lead: Elena Castellanos' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Elena Castellanos' })).toContainText(
    'Lead',
  )
  await expectNoSeriousA11y(page)

  // Assign a recruitment to the new team and see it on the team page and in the filter.
  await page.goto('./demo/recruitments')
  await page.getByRole('button', { name: 'Edit recruitment' }).nth(1).click()
  await page.getByRole('combobox', { name: 'Team' }).selectOption({ label: 'Legal' })
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('combobox', { name: 'Filter by team' }).selectOption({ label: 'Legal' })
  await expect(page.getByRole('link', { name: /HR Business Partner/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Frontend Developer/ })).toHaveCount(0)
  await page.goto('./demo/teams')
  await expect(page.getByRole('link', { name: /Legal/ })).toContainText('2 members')
  await expect(page.getByRole('link', { name: /Legal/ })).toContainText('1 open recruitment')
})
