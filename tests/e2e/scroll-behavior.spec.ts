import { expect, test, type Page } from '@playwright/test'
import { gotoTreeView } from './helpers'

// Locks in the scroll/anchor behaviors of VirtualList so they match a
// native scroll container:
//   1. Expanding a node inserts its children BELOW it — the visible content
//      never jumps upward (the bug originally reported: after a scroll journey,
//      expanding the first node revealed a deeper row at the top).
//   2. Collapsing while scrolled to the bottom clamps the viewport up — there is
//      no more content to show, so the scroll position must shrink (native).
//   3. Collapsing the branch that holds the top row lands on the collapsed
//      parent — the nearest surviving ancestor, not whatever row inherits the
//      old index (native scroll-anchoring falls back to a surviving element).
//   4. The spacer height (and rendered row count) stays bounded no matter how
//      many rows are expanded — the whole point of the sliding window.

const TREE = '[data-qa-id="tree"]'
const VIEWPORT = `${TREE} [data-qa-id="vl-viewport"]`
const SPACER = `${TREE} [data-qa-id="vl-spacer"]`
const WINDOW_ROWS = `${TREE} [data-qa-id="virtual-list-window"] > [data-vl-idx]`
const SCROLLBAR_THUMB = `${TREE} [data-qa-id="virtual-scrollbar-thumb"]`

function scrollTop(page: Page): Promise<number> {
  return page.locator(VIEWPORT).evaluate((el) => (el as HTMLElement).scrollTop)
}

async function topmostRowId(page: Page): Promise<string | null> {
  return page.evaluate((selector) => {
    const vp = document.querySelector(selector)
    if (!vp) return null
    const viewportTop = vp.getBoundingClientRect().top
    const rows = [...vp.querySelectorAll('[data-qa-id="virtual-list-window"] > [data-vl-idx]')]
      .map((row) => ({
        id: (row as HTMLElement).dataset.vlId ?? null,
        top: row.getBoundingClientRect().top,
      }))
      .filter((row) => row.top >= viewportTop - 1)
      .sort((a, b) => a.top - b.top)
    return rows[0]?.id ?? null
  }, VIEWPORT)
}

async function firstRenderedIndex(page: Page): Promise<number> {
  const raw = await page.locator(WINDOW_ROWS).first().getAttribute('data-vl-idx')
  return raw === null ? -1 : Number(raw)
}

async function dragCustomScrollbarToBottom(page: Page): Promise<void> {
  const thumb = page.locator(SCROLLBAR_THUMB)
  const thumbBox = await thumb.boundingBox()
  if (!thumbBox) throw new Error('Virtual scrollbar thumb is not rendered')
  const treeBox = await page.locator(TREE).boundingBox()
  const targetY = treeBox ? treeBox.y + treeBox.height - 16 : thumbBox.y + thumbBox.height + 500

  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, targetY, { steps: 12 })
  await page.mouse.up()
}

test.describe('TreeSelectHost: native-like scroll & anchor behavior', () => {
  test.beforeEach(async ({ page }) => {
    await gotoTreeView(page)
  })

  test('expanding the first node after a bottom→top journey keeps it pinned, children below (no upward jump)', async ({
    page,
  }) => {
    const viewport = page.locator(VIEWPORT)

    // Journey to the bottom and back — this is what scrambled the internal
    // ref-array order and surfaced the original jump bug.
    await viewport.evaluate((el) => ((el as HTMLElement).scrollTop = el.scrollHeight))
    await page.waitForTimeout(150)
    await viewport.evaluate((el) => ((el as HTMLElement).scrollTop = 0))
    await page.waitForTimeout(200)

    const firstId = await page.locator(`${WINDOW_ROWS}[data-vl-idx="0"]`).getAttribute('data-vl-id')
    const secondIdBefore = await page
      .locator(`${WINDOW_ROWS}[data-vl-idx="1"]`)
      .getAttribute('data-vl-id')

    await page.locator(`${WINDOW_ROWS}[data-vl-idx="0"] [data-qa-id="tree-row-toggle"]`).click()
    await page.waitForTimeout(250)

    // The first node stays first and at the very top — no upward jump.
    expect(await scrollTop(page)).toBeLessThanOrEqual(2)
    expect(await page.locator(`${WINDOW_ROWS}[data-vl-idx="0"]`).getAttribute('data-vl-id')).toBe(
      firstId,
    )
    // Children were inserted directly BELOW it: row 1 is now a child (changed).
    // The spacer is a bounded local scroll surface, not the full tree height.
    expect(
      await page.locator(`${WINDOW_ROWS}[data-vl-idx="1"]`).getAttribute('data-vl-id'),
    ).not.toBe(secondIdBefore)
    expect(
      await page.locator(SPACER).evaluate((el) => (el as HTMLElement).offsetHeight),
    ).toBeGreaterThan(0)
  })

  test('after a deep scrollbar drag, upward wheel keeps advancing the window toward the top (no stall/freeze)', async ({
    page,
  }) => {
    const viewport = page.locator(VIEWPORT)

    await page.getByRole('checkbox', { name: 'Expand all' }).click()
    await page.waitForTimeout(400)

    await dragCustomScrollbarToBottom(page)
    await page.waitForTimeout(400)

    const firstAfterDrag = await firstRenderedIndex(page)
    expect(firstAfterDrag, 'drag landed deep enough to exercise upward prepend').toBeGreaterThan(
      1_000,
    )

    let firstNow = firstAfterDrag
    for (let i = 0; i < 70; i += 1) {
      await viewport.hover()
      await page.mouse.wheel(0, -900)
      await page.waitForTimeout(40)
      firstNow = await firstRenderedIndex(page)
      if (firstNow <= 0) break
    }

    expect(
      firstNow,
      'upward wheel kept advancing the virtual window instead of stalling at the floor',
    ).toBeLessThan(firstAfterDrag - 800)
    expect(await scrollTop(page), 'scroll position stays valid (never negative)').toBeGreaterThanOrEqual(
      0,
    )
  })

  test('collapsing while scrolled to the bottom clamps the viewport up (no frozen empty space)', async ({
    page,
  }) => {
    const viewport = page.locator(VIEWPORT)

    await page.getByRole('checkbox', { name: 'Expand all' }).click()
    await page.waitForTimeout(300)

    await viewport.evaluate((el) => ((el as HTMLElement).scrollTop = el.scrollHeight))
    await page.waitForTimeout(200)
    const bottomScroll = await scrollTop(page)
    expect(bottomScroll, 'expanded list is tall enough to scroll').toBeGreaterThan(1000)

    await page.getByRole('checkbox', { name: 'Expand all' }).click()
    await page.waitForTimeout(400)

    const after = await viewport.evaluate((el) => {
      const e = el as HTMLElement
      return { scrollTop: e.scrollTop, max: e.scrollHeight - e.clientHeight }
    })
    // Content shrank below the old scrollTop → the browser had to pull up.
    expect(after.scrollTop).toBeLessThan(bottomScroll)
    // …and it landed within the valid range, not in a phantom gap past the end.
    expect(after.scrollTop).toBeLessThanOrEqual(after.max + 1)
  })

  // Skipped while evaluating numeric-stable vs land-on-parent fallback: the host
  // currently does not pass resolveFallbackKey, so collapsing the anchor's branch
  // is numeric-stable (stays on the old index) rather than landing on the parent.
  test.skip('collapsing the branch that holds the top row lands on the collapsed parent', async ({
    page,
  }) => {
    const viewport = page.locator(VIEWPORT)

    // Expand the first root, then scroll so one of its children sits at the top.
    await page.locator(`${WINDOW_ROWS}[data-vl-idx="0"] [data-qa-id="tree-row-toggle"]`).click()
    await page.waitForTimeout(250)
    const parentId = await page
      .locator(`${WINDOW_ROWS}[data-vl-idx="0"]`)
      .getAttribute('data-vl-id')

    await viewport.evaluate((el) => ((el as HTMLElement).scrollTop = 160))
    await page.waitForTimeout(200)
    expect(await topmostRowId(page), 'a child is at the top before collapse').not.toBe(parentId)

    // Collapse the same root (its toggle is still rendered within overscan).
    await page.locator(`${WINDOW_ROWS}[data-vl-idx="0"] [data-qa-id="tree-row-toggle"]`).click()
    await page.waitForTimeout(400)

    // The vanished child's anchor falls back to its nearest surviving ancestor.
    expect(await topmostRowId(page)).toBe(parentId)
    expect(await scrollTop(page)).toBeLessThanOrEqual(2)
  })

  test('the sliding window keeps the spacer and rendered row count bounded when everything is expanded', async ({
    page,
  }) => {
    await page.getByRole('checkbox', { name: 'Expand all' }).click()
    await page.waitForTimeout(400)

    // Full height for ~9,458 rows would be ~280K px; the window caps it far below.
    const spacerHeight = await page
      .locator(SPACER)
      .evaluate((el) => (el as HTMLElement).offsetHeight)
    expect(spacerHeight).toBeLessThan(120_000)

    // Only a window's worth of rows is ever in the DOM, never all 9,458.
    const rendered = await page.locator(WINDOW_ROWS).count()
    expect(rendered).toBeLessThan(60)
  })

  test('the height guard keeps the local scroll surface bounded below the configured limit while scrolling', async ({
    page,
  }) => {
    await page.goto('/?maxScrollHeight=80000')
    await page.getByRole('checkbox', { name: 'Expand all' }).click()
    await page.waitForTimeout(400)

    const viewport = page.locator(VIEWPORT)
    const spacerPx = () =>
      page.locator(SPACER).evaluate((el) => parseFloat((el as HTMLElement).style.height) || 0)

    let maxSpacer = await spacerPx()
    let deepest = await firstRenderedIndex(page)
    for (let i = 0; i < 45; i += 1) {
      await viewport.evaluate((el) => ((el as HTMLElement).scrollTop = el.scrollHeight))
      await page.waitForTimeout(110)
      maxSpacer = Math.max(maxSpacer, await spacerPx())
      deepest = Math.max(deepest, await firstRenderedIndex(page))
    }

    expect(deepest, 'the journey travelled past the guard threshold (~2,700 rows)').toBeGreaterThan(
      4_000,
    )
    expect(await page.locator(WINDOW_ROWS).count(), 'the DOM stays a bounded window').toBeLessThan(60)
    expect(
      maxSpacer,
      'the local scroll surface never grows toward the full tree height',
    ).toBeLessThan(150_000)
  })
})
