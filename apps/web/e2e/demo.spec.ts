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
  // The dashboard is the first screen (0.5.0): tiles from the fixtures, every row a link.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Interviews in the next 7 days' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Frontend Developer/ }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Recruitments', exact: true }).click()
  // The h2 renders once the list has loaded ("Open recruitments" on the dashboard is not it).
  await expect(page.getByRole('heading', { name: 'Recruitments', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Frontend Developer/ })).toBeVisible()
  await expectNoSeriousA11y(page)
})

test('kanban, drawer, reset and language', async ({ page }) => {
  await page.goto('./demo/recruitments')
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
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Recruitments' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Employees' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Teams' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Settings' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'AI assistant' })).toBeFocused()
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

test('email templates: tiles, dialog, custom template in the send dialog', async ({ page }) => {
  await page.goto('./demo/templates')
  await expect(page).toHaveURL(/\/settings\/templates$/)
  await expect(page.getByRole('heading', { name: 'Email templates' })).toBeVisible()
  const invite = page.getByRole('button', { name: /Interview invitation/ })
  await expect(invite).toContainText('Invitation to an online interview')
  await expectNoSeriousA11y(page)

  // Escape closes the editor and hands focus back to the tile that opened it.
  await invite.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Edit: Interview invitation' })).toBeVisible()
  await expect(dialog.getByLabel('Subject')).toHaveValue(/Interview invitation/)
  await expect(dialog.getByText('{{jitsiUrl}}')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await expectNoSeriousA11y(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(invite).toBeFocused()

  // A built-in can be renamed and restored; the confirm is a native dialog.
  page.on('dialog', (d) => d.accept())
  await invite.click()
  await dialog.getByLabel('Name').fill('Invite v2')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Invite v2/ })).toBeVisible()
  await page.getByRole('button', { name: /Invite v2/ }).click()
  await dialog.getByRole('button', { name: 'Restore default' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(invite).toBeVisible()

  // A custom template: required fields, then a tile after the built-ins.
  await page.getByRole('button', { name: 'New template' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('This field is required.').first()).toBeVisible()
  await dialog.getByLabel('Name').fill('Offer')
  await dialog.getByLabel('Description').fill('Goes with the offer letter')
  await dialog.getByLabel('Subject').fill('Offer: {{jobTitle}}')
  await dialog.getByLabel('Body').fill('Hello {{firstName}}, your offer is attached.')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveCount(0)
  const offer = page.getByRole('button', { name: /^Offer/ })
  await expect(offer).toContainText('Goes with the offer letter')

  // The send dialog lists it and renders its placeholders.
  await page.goto('./demo/recruitments/1')
  await page.getByRole('button', { name: 'Priya Lennox' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Send email' }).click()
  const send = page.getByRole('dialog', { name: /Send email to/ })
  await send.getByRole('combobox', { name: 'Template' }).selectOption({ label: 'Offer' })
  await expect(send.getByLabel('Subject')).toHaveValue('Offer: Frontend Developer (React)')
  await expect(send.getByLabel('Body')).toHaveValue(/Hello Priya/)
  await send.getByRole('button', { name: 'Cancel' }).click()

  // Deleting it asks first and removes the tile.
  await page.goto('./demo/settings/templates')
  await offer.click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(offer).toHaveCount(0)
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

test('messages: to an employee from the drawer, to picked team members from the team page', async ({
  page,
}) => {
  await page.goto('./demo/employees')
  await page.getByRole('button', { name: /Hanna Sorlie/ }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('No messages yet.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Send message' }).click()
  const dialog = page.getByRole('dialog', { name: 'Send message' })
  await expect(dialog.getByRole('textbox', { name: 'To' })).toHaveValue('hanna.sorlie@example.com')
  await dialog.getByRole('button', { name: 'Send message' }).click()
  await expect(dialog.getByText('This field is required.')).toHaveCount(2)
  await dialog.getByRole('textbox', { name: 'Subject' }).fill('Panel on Thursday, {{firstName}}')
  await dialog.getByRole('textbox', { name: 'Body' }).fill('See you at 10:00.')
  await expectNoSeriousA11y(page)
  await dialog.getByRole('textbox', { name: 'Body' }).press('Control+Enter')
  await expect(dialog).toHaveCount(0)
  await expect(drawer.getByRole('status')).toHaveText('Message sent.')
  const row = drawer.getByRole('listitem').filter({ hasText: 'Panel on Thursday, Hanna' })
  await expect(row).toContainText('Outbox (demo)')
  await page.keyboard.press('Escape')

  await page.goto('./demo/teams')
  await page.getByRole('link', { name: /^IT/ }).click()
  await expect(page.getByRole('heading', { name: 'Members (4)' })).toBeVisible()
  await expect(page.getByText('No messages yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Send message' }).click()
  const team = page.getByRole('dialog', { name: 'Send message' })
  await expect(team.getByText('4 selected')).toBeVisible()
  await team.getByRole('button', { name: 'Leads only' }).click()
  await expect(team.getByText('1 selected')).toBeVisible()
  await expect(team.getByRole('checkbox', { name: 'Hanna Sorlie' })).toBeChecked()
  await team.getByRole('button', { name: 'Clear' }).click()
  await expect(team.getByText('0 selected')).toBeVisible()
  await expect(team.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await team.getByRole('button', { name: 'Select all' }).click()
  await expect(team.getByText('4 selected')).toBeVisible()
  await team.getByRole('textbox', { name: 'Subject' }).fill('Interview training')
  await team.getByRole('textbox', { name: 'Body' }).fill('Friday, {{firstName}}.')
  await expectNoSeriousA11y(page)
  await team.getByRole('button', { name: 'Send message' }).click()
  await expect(team).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Sent to 4 of 4')
  const send = page.getByRole('listitem').filter({ hasText: 'Interview training' })
  await expect(send).toContainText('4 recipients')
  await expect(send).toContainText('Outbox (demo) 4')
})
