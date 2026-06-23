import { expect, test } from '@playwright/test'
import { gotoTreeView } from './helpers'

test.describe('TreeSelectHost: toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
  })

  test('expand-all checkbox expands all parents when checked', async ({ page }) => {
    const rowsBefore = await page.locator('[data-qa-id="tree-row"]').count()

    await page.getByRole('checkbox', { name: 'Expand all' }).click()

    const rowsAfter = await page.locator('[data-qa-id="tree-row"]').count()

    expect(rowsAfter).toBeGreaterThan(rowsBefore)
  })

  test('expand-all toggles off via checkbox and collapses everything', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: 'Expand all' })
    await checkbox.click()
    const rowsExpanded = await page.locator('[data-qa-id="tree-row"]').count()

    await checkbox.click()
    const rowsCollapsed = await page.locator('[data-qa-id="tree-row"]').count()

    expect(rowsCollapsed).toBeLessThan(rowsExpanded)
  })

  test('Nav block is hidden (faded) when there is no query, visible when query exists', async ({
    page,
  }) => {
    const nav = page.locator('[data-qa-id="nav"]')
    await expect(nav).not.toHaveAttribute('data-qa-visible')

    await page.locator('[data-qa-id="filter-input"]').fill('03111')
    await expect(nav).toHaveAttribute('data-qa-visible')

    await page.locator('[data-qa-id="filter-input"]').fill('')
    await expect(nav).not.toHaveAttribute('data-qa-visible')
  })

  test('selection-strategy dropdown holds value across other interactions', async ({ page }) => {
    const selection = page.getByLabel('Selection')

    await selection.selectOption({ label: 'All selected nodes' })
    await expect(selection).toHaveValue('cascadeAll')

    await page.locator('[data-qa-id="view-tree"]').click()
    await page.locator('[data-qa-id="filter-input"]').fill('03111')
    await page.locator('[data-qa-id="filter-input"]').fill('')

    await expect(selection).toHaveValue('cascadeAll')
  })

  test('filter input updates query immediately (no debounce)', async ({ page }) => {
    const input = page.locator('[data-qa-id="filter-input"]')
    await input.fill('03111100')

    await expect(page.locator('[data-qa-id="nav-count"]')).not.toContainText('0 / 0')
  })
})
