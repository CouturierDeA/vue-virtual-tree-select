import { expect, test } from '@playwright/test'
import { gotoTreeView } from './helpers'

const TREE_VIEWPORT = '[data-qa-id="tree"] [data-qa-id="vl-viewport"]'

test.describe('TreeSelectHost: resize jitter (regression)', () => {
  test.use({ viewport: { width: 300, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
  })

  test('wheeling up after narrowing the viewport keeps visible rows steady (no jitter)', async ({
    page,
  }) => {
    const viewport = page.locator(TREE_VIEWPORT)

    await page.getByRole('checkbox', { name: 'Expand all' }).click()
    await page.locator('[data-qa-id="filter-input"]').fill('Not elsewhere classified')
    await expect(page.locator('[data-qa-id="nav-count"]')).not.toContainText('0 / 0')
    await page.locator('[data-qa-id="nav-next"]').click()
    await page.waitForTimeout(300)

    await viewport.evaluate((el) => ((el as HTMLElement).scrollTop -= 500))
    await page.waitForTimeout(150)
    await page.setViewportSize({ width: 280, height: 800 })
    await page.waitForTimeout(300)

    await viewport.hover()

    const before = await viewport.evaluate((el) => (el as HTMLElement).scrollTop)
    await page.mouse.wheel(0, -240)
    await page.waitForTimeout(200)
    const after = await viewport.evaluate((el) => (el as HTMLElement).scrollTop)
    expect(after, 'wheel must drive the list scroll').not.toBe(before)

    const trackIndex = await page.evaluate((selector) => {
      const v = document.querySelector(selector)!
      const viewportTop = v.getBoundingClientRect().top
      const rows = [...v.querySelectorAll('[data-vl-idx]')]
        .map((row) => ({
          index: Number((row as HTMLElement).dataset.vlIdx),
          top: row.getBoundingClientRect().top,
        }))
        .filter((row) => row.top >= viewportTop - 1)
        .sort((a, b) => a.top - b.top)
      return rows[Math.min(2, rows.length - 1)]?.index ?? null
    }, TREE_VIEWPORT)
    expect(trackIndex).not.toBeNull()

    await page.evaluate(
      ({ selector, index }) => {
        const v = document.querySelector(selector)!
        const w = window as unknown as { __rec: number[]; __raf: number }
        w.__rec = []
        const tick = () => {
          const el = v.querySelector(`[data-vl-idx="${index}"]`)
          if (el) {
            const vRect = v.getBoundingClientRect()
            const rect = el.getBoundingClientRect()
            const overlapsViewport = rect.bottom > vRect.top && rect.top < vRect.bottom
            if (overlapsViewport) w.__rec.push(rect.top)
          }
          w.__raf = requestAnimationFrame(tick)
        }
        tick()
      },
      { selector: TREE_VIEWPORT, index: trackIndex },
    )

    for (let step = 0; step < 10; step++) {
      await page.mouse.wheel(0, -120)
      await page.waitForTimeout(50)
    }
    await page.waitForTimeout(200)

    const tops = await page.evaluate(() => {
      const w = window as unknown as { __rec: number[]; __raf: number }
      cancelAnimationFrame(w.__raf)
      return w.__rec
    })

    let reversals = 0
    let previousDirection = 0
    for (let i = 1; i < tops.length; i++) {
      const delta = tops[i] - tops[i - 1]
      if (Math.abs(delta) <= 1) continue
      const direction = Math.sign(delta)
      if (previousDirection && direction !== previousDirection) reversals++
      previousDirection = direction
    }

    expect(tops.length, 'tracked row must stay visible for a meaningful span').toBeGreaterThan(8)
    expect(reversals, `visible row-top reversals (frames ${tops.length})`).toBeLessThanOrEqual(3)
  })
})
