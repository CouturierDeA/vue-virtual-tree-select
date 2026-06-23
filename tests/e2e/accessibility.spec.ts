import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { gotoTreeView } from './helpers'

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => node.target.join(' ')),
  }))

  expect(violations).toEqual([])
}

test.describe('TreeSelectHost accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
    await expect(page.getByRole('main', { name: 'Virtual Tree Select' })).toBeVisible()
  })

  test('has no axe violations in the default and filtered states', async ({ page }) => {
    await expectNoAxeViolations(page)

    await page.getByLabel('Filter / Search').fill('coffee')
    await expect(page.locator('[data-qa-id="nav"]')).toHaveAttribute('data-qa-visible')
    await expectNoAxeViolations(page)
  })

  test('exposes labels and accessible names for form and row controls', async ({ page }) => {
    await expect(page.getByLabel('Selection', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Nodes', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Filter / Search', { exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Expand all' })).toBeVisible()

    await expect(page.getByRole('region', { name: 'Tree options' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: /Selected:/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Expand|Collapse) / }).first()).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /^Select / }).first()).toBeVisible()
  })

  test('supports keyboard operation for toolbar, search, rows, and selected-item removal', async ({
    page,
  }) => {
    const expandAll = page.getByRole('checkbox', { name: 'Expand all' })
    await expandAll.focus()
    await expect(expandAll).toBeFocused()
    await page.keyboard.press('Space')
    await expect(expandAll).toHaveAttribute('aria-checked', 'true')

    const search = page.getByLabel('Filter / Search')
    await search.focus()
    await search.fill('roof')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-qa-id="nav-count"]')).not.toContainText('0 / 0')

    const nextMatch = page.getByRole('button', { name: 'Next match' })
    await nextMatch.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-qa-id="tree-row"][data-qa-active]').first()).toBeVisible()

    const rowToggle = page.getByRole('button', { name: /^(Expand|Collapse) / }).first()
    await rowToggle.focus()
    await page.keyboard.press('Enter')
    await expect(rowToggle).toBeFocused()

    const rowCheckbox = page.getByRole('checkbox', { name: /^Select / }).first()
    await rowCheckbox.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('[data-qa-id="selected-item"]').first()).toBeVisible()

    const removeButton = page.getByRole('button', { name: /^Remove .+$/ }).first()
    const removeName = await removeButton.getAttribute('aria-label')
    expect(removeName).not.toBeNull()
    await removeButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: removeName as string })).toHaveCount(0)
  })

  test('does not render custom dialogs or menus that require focus management', async ({ page }) => {
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('menu')).toHaveCount(0)
  })
})
