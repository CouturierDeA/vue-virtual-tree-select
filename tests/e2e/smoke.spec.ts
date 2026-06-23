import { expect, test } from '@playwright/test'
import { gotoTreeView } from './helpers'

test.describe('TreeSelectHost smoke', () => {
  test('loads, renders toolbar and tree', async ({ page }) => {
    await gotoTreeView(page)

    await expect(page.getByText('Selection', { exact: true })).toBeVisible()
    await expect(page.getByText('Expand all', { exact: true })).toBeVisible()
    await expect(page.locator('[data-qa-id="filter-input"]')).toBeVisible()

    await expect(page.locator('[data-qa-id="view-tree"]')).toBeVisible()
    await expect(page.locator('[data-qa-id="view-tree-filter"]')).toBeVisible()

    await expect(page.getByText('Selected: 1')).toBeVisible()

    const firstRow = page.locator('[data-qa-id="tree-row"]').first()
    await expect(firstRow).toBeVisible()
  })

  test('filter input narrows visible rows', async ({ page }) => {
    await gotoTreeView(page)

    const input = page.locator('[data-qa-id="filter-input"]')
    await expect(page.locator('[data-qa-id="tree-row"]').first()).toBeVisible()
    const rowsBefore = await page.locator('[data-qa-id="tree-row"]').count()
    expect(rowsBefore).toBeGreaterThan(0)

    await input.fill('03111100')

    await expect(page.locator('[data-qa-id="nav"][data-qa-visible]')).toBeVisible()

    await expect(page.locator('[data-qa-id="tree-row"]').first()).toBeVisible()
    await expect(page.getByText('03111100', { exact: false }).first()).toBeVisible()
  })
})
