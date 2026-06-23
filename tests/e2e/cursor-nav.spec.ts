import { expect, test, type Page } from '@playwright/test'
import { gotoTreeView } from './helpers'

const TREE_VIEWPORT = '[data-qa-id="tree"] [data-qa-id="vl-viewport"]'

async function scrollVlb(page: Page, offset: number) {
  await page.locator(TREE_VIEWPORT).evaluate((el, off) => {
    ;(el as HTMLElement).scrollTop = off
  }, offset)
}

async function vlScrollTop(page: Page): Promise<number> {
  return await page.locator(TREE_VIEWPORT).evaluate((el) => (el as HTMLElement).scrollTop)
}

test.describe('TreeSelectHost: cursor navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
  })

  test('counter "X / N" shows match position', async ({ page }) => {
    await page.locator('[data-qa-id="view-tree"]').click()
    await page.locator('[data-qa-id="filter-input"]').fill('03111')

    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText('1 / ')

    const counter = await page.locator('[data-qa-id="nav-count"]').textContent()
    const match = counter?.match(/(\d+)\s*\/\s*(\d+)/)
    const n = match ? parseInt(match[2], 10) : 0
    expect(n).toBeGreaterThanOrEqual(2)

    await page.locator('[data-qa-id="nav-next"]').click()
    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText('2 / ')

    await page.locator('[data-qa-id="nav-prev"]').click()
    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText('1 / ')
  })

  test('counter wraps at boundaries', async ({ page }) => {
    await page.locator('[data-qa-id="view-tree"]').click()
    const input = page.locator('[data-qa-id="filter-input"]')
    await input.fill('03111')

    const counter = await page.locator('[data-qa-id="nav-count"]').textContent()
    const match = counter?.match(/(\d+)\s*\/\s*(\d+)/)
    const n = match ? parseInt(match[2], 10) : 0

    await page.locator('[data-qa-id="nav-prev"]').click()
    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText(`${n} / ${n}`)

    await page.locator('[data-qa-id="nav-next"]').click()
    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText(`1 / ${n}`)
  })

  test('nav buttons are disabled when there are no matches', async ({ page }) => {
    const input = page.locator('[data-qa-id="filter-input"]')
    await input.fill('nothingmatcheshereforsure')

    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText('0 / 0')
    await expect(page.locator('[data-qa-id="nav-next"]')).toBeDisabled()
    await expect(page.locator('[data-qa-id="nav-prev"]')).toBeDisabled()
  })

  test('single match: ▼ scrolls back to match after manual scroll-away', async ({ page }) => {
    await page.locator('[data-qa-id="view-tree"]').click()

    await page.locator('[data-qa-id="filter-input"]').fill('03111100-3')

    await expect(page.locator('[data-qa-id="nav-count"]')).toContainText('1 / 1')

    const activeRow = page.locator('[data-qa-id="tree-row"][data-qa-active]')
    await expect(activeRow).toBeVisible()

    await scrollVlb(page, 5000)
    const scrolledAway = await vlScrollTop(page)
    expect(scrolledAway).toBeGreaterThan(100)

    await page.locator('[data-qa-id="nav-next"]').click()

    await page.waitForTimeout(300)

    const scrolledBack = await vlScrollTop(page)

    expect(scrolledBack).toBeLessThan(scrolledAway)

    await expect(page.locator('[data-qa-id="tree-row"][data-qa-active]')).toBeVisible()
  })
})
