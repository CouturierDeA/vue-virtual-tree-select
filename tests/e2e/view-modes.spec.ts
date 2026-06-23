import { expect, test } from '@playwright/test'
import { gotoTreeView } from './helpers'

test.describe('TreeSelectHost: view modes', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
  })

  test('tree-filter view + non-empty query shows the hierarchical path (ancestor rows visible)', async ({
    page,
  }) => {
    await page.locator('[data-qa-id="view-tree-filter"]').click()
    await page.locator('[data-qa-id="filter-input"]').fill('03111100')

    await expect(
      page.locator('[data-qa-id="tree-row"]', { hasText: '03111100' }).first(),
    ).toBeVisible()
    await expect(
      page.locator('[data-qa-id="tree-row"]', { hasText: '03000000' }).first(),
    ).toBeVisible()
  })

  test('tree (navigate) view + non-empty query reveals the matched path', async ({ page }) => {
    await page.locator('[data-qa-id="view-tree"]').click()
    await page.locator('[data-qa-id="filter-input"]').fill('03111100')

    const matchRow = page.locator('[data-qa-id="tree-row"]', { hasText: '03111100' }).first()
    await expect(matchRow).toBeVisible()
    await expect(matchRow).toHaveAttribute('data-qa-match')

    await expect(
      page.locator('[data-qa-id="tree-row"][data-qa-match-ancestor]').first(),
    ).toBeVisible()
  })

  test('switching the query opens only the new matches, with no accumulation from the previous query', async ({
    page,
  }) => {
    const input = page.locator('[data-qa-id="filter-input"]')
    const navCount = page.locator('[data-qa-id="nav-count"]')
    const treeHeight = () =>
      page
        .locator('[data-qa-id="tree"] [data-qa-id="vl-viewport"]')
        .evaluate((el) => el.scrollHeight)

    await input.fill('snail')
    await expect(navCount).not.toHaveText('0 / 0')
    const snailNav = (await navCount.textContent()) ?? ''
    const snailHeight = await treeHeight()

    await input.fill('coffee')
    await expect(navCount).not.toHaveText(snailNav)
    expect(await treeHeight()).toBeGreaterThan(snailHeight)

    await input.fill('snail')
    await expect(navCount).toHaveText(snailNav)
    // navCount above is the exact "no accumulation" guard. Height is a sanity bound:
    // accumulation would push it up toward coffee's; the sub-percent slack absorbs
    // unmeasured-row estimate drift (not pixel-exact in measure-on-demand virtualization).
    const backHeight = await treeHeight()
    expect(Math.abs(backHeight - snailHeight)).toBeLessThan(snailHeight * 0.05)
  })

  test('clearing the query restores the hierarchical view', async ({ page }) => {
    const input = page.locator('[data-qa-id="filter-input"]')
    await page.locator('[data-qa-id="view-tree-filter"]').click()
    await input.fill('03111100')

    await input.fill('')
    await expect(page.locator('[data-qa-id="tree-row-toggle"]').first()).toBeVisible()
  })
})
