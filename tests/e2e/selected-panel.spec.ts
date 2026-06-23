import { expect, test, type Page } from '@playwright/test'
import { gotoTreeView } from './helpers'

async function selectedCount(page: Page): Promise<number> {
  const text = await page.locator('[data-qa-id="selected-title"]').textContent()
  const match = text?.match(/Selected:\s*(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

async function clearSelection(page: Page): Promise<void> {
  if ((await selectedCount(page)) === 0) return
  await expect(page.locator('[data-qa-id="selected-remove"]').first()).toBeVisible()
  while ((await page.locator('[data-qa-id="selected-remove"]').count()) > 0) {
    await page.locator('[data-qa-id="selected-remove"]').first().click()
    await expect(page.locator('[data-qa-id="selected-title"]')).toHaveText('Selected: 0')
    await expect(page.locator('[data-qa-id="selected-item"]')).toHaveCount(0)
  }
}

async function waitForVueFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

test.describe('TreeSelectHost: Selected panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
  })

  test('starts with the demo preset selected', async ({ page }) => {
    await expect(page.locator('[data-qa-id="selected-title"]')).toHaveText('Selected: 1')
    await expect(page.locator('[data-qa-id="selected-item"]')).toHaveCount(1)
  })

  test('checking a leaf increments counter and adds the item to the panel', async ({ page }) => {
    await page.locator('[data-qa-id="tree-row-toggle"]').first().click()
    await page.locator('[data-qa-id="tree-row-toggle"]').first().click()
    await page.locator('[data-qa-id="tree-row-toggle"]').first().click()

    const firstCheckbox = page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox')
    await firstCheckbox.click()

    expect(await selectedCount(page)).toBe(1)
    await expect(page.locator('[data-qa-id="selected-item"]')).toHaveCount(1)
  })

  test('unchecking removes the item and decrements counter', async ({ page }) => {
    const firstCheckbox = page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox')

    await firstCheckbox.click()
    expect(await selectedCount(page)).toBe(1)

    await firstCheckbox.click()
    expect(await selectedCount(page)).toBe(0)
    await expect(page.locator('[data-qa-id="selected-item"]')).toHaveCount(0)
  })

  test('removing via the panel × button unchecks the node and empties the panel', async ({
    page,
  }) => {
    const firstCheckbox = page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox')
    await firstCheckbox.click()
    expect(await selectedCount(page)).toBe(1)

    await page.locator('[data-qa-id="selected-remove"]').first().click()

    expect(await selectedCount(page)).toBe(0)
    await expect(page.locator('[data-qa-id="selected-item"]')).toHaveCount(0)
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'false')
  })

  test('panel rows display id (strong) and description (span)', async ({ page }) => {
    await page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox').click()

    const item = page.locator('[data-qa-id="selected-item"]').first()
    await expect(item).toBeVisible()

    await expect(item.locator('strong')).toBeVisible()
    await expect(item.locator('strong')).not.toBeEmpty()

    await expect(item.locator('span')).toBeVisible()
    await expect(item.locator('span')).not.toBeEmpty()
  })

  test('cascadeCompact emits only the root of a fully-checked subtree', async ({ page }) => {
    const firstRowCheckbox = page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox')
    await firstRowCheckbox.click()

    expect(await selectedCount(page)).toBe(1)
    await expect(page.locator('[data-qa-id="selected-item"]')).toHaveCount(1)
  })

  test('cascadeAll emits the whole subtree (parent + all descendants)', async ({ page }) => {
    await page.getByLabel('Selection').selectOption({ label: 'All selected nodes' })

    await page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox').click()

    const count = await selectedCount(page)
    expect(count).toBeGreaterThan(1)
  })

  test('independent strategy: clicking a parent does NOT cascade down', async ({ page }) => {
    await clearSelection(page)
    await waitForVueFrame(page)
    const selection = page.getByLabel('Selection')
    await selection.selectOption({ label: 'Independent nodes' })
    await expect(selection).toHaveValue('independent')
    await waitForVueFrame(page)

    await page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox').click()

    await expect(page.locator('[data-qa-id="selected-title"]')).toHaveText('Selected: 1')
  })

  test('selection persists when view mode changes', async ({ page }) => {
    await page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox').click()
    expect(await selectedCount(page)).toBe(1)

    await page.locator('[data-qa-id="view-tree-filter"]').click()
    expect(await selectedCount(page)).toBe(1)

    await page.locator('[data-qa-id="view-tree"]').click()
    expect(await selectedCount(page)).toBe(1)
  })

  test('counter and panel update reactively without page reload', async ({ page }) => {
    const firstCheckbox = page.locator('[data-qa-id="tree-row"]').first().getByRole('checkbox')
    await firstCheckbox.click()
    await expect(page.locator('[data-qa-id="selected-title"]')).toHaveText('Selected: 1')

    await firstCheckbox.click()
    await expect(page.locator('[data-qa-id="selected-title"]')).toHaveText('Selected: 0')

    await firstCheckbox.click()
    await expect(page.locator('[data-qa-id="selected-title"]')).toHaveText('Selected: 1')
  })
})
