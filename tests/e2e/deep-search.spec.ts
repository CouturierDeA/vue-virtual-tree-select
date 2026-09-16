import { expect, test } from '@playwright/test'
import { gotoTreeView } from './helpers'

test('typing searches through two million deep nodes completes with and without Expand all', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Inject deep data only into this test browser. The regression must also run
  // against the committed preview, whose normal scaling can remain horizontal.
  await page.route('**/src/preview/data/treeData.ts*', async (route) => {
    const response = await route.fetch()
    const original = await response.text()
    const renamed = original.replace(
      'export async function loadTreeData(',
      'async function loadOriginalTreeData(',
    )
    expect(renamed).not.toBe(original)
    await route.fulfill({
      response,
      body: `${renamed}
export async function loadTreeData(target, ...options) {
  if (target !== 2000000) return loadOriginalTreeData(target, ...options)
  const roots = []
  for (let rootIndex = 0; rootIndex < 10; rootIndex++) {
    const root = { id: 'chain-' + rootIndex, description: 'category' }
    roots.push(root)
    let parent = root
    for (let depth = 1; depth < 200000; depth++) {
      const child = { id: root.id + '-deep-' + depth, description: 'category' }
      parent.children = [child]
      parent = child
    }
  }
  return roots
}
`,
    })
  })
  await gotoTreeView(page)
  const countInput = page.locator('[data-qa-id="node-count-input"]')
  await countInput.fill('2000000')
  await countInput.press('Enter')
  await expect(page.locator('.tree-select-host-header__badge')).toHaveText(
    '9,458 original · 2,000,000 total',
    { timeout: 30_000 },
  )

  const input = page.locator('[data-qa-id="filter-input"]')
  const counter = page.locator('[data-qa-id="nav-count"]')
  const expandAll = page.getByRole('checkbox', { name: 'Expand all' })
  const rows = page.locator('[data-qa-id="tree-row"]')

  // Intermediate c/a queries match large branches even though the full words do not.
  // This is a typing delay in the test, not throttling in the application.
  await input.pressSequentially('c')
  await expect(counter).toHaveText('1 / 2000000', { timeout: 10_000 })
  await input.pressSequentially('offe', { delay: 100 })
  await expect(counter).toHaveText('0 / 0')
  await input.fill('')
  await expandAll.check()
  await input.pressSequentially('asdasdas', { delay: 100 })
  await expect(counter).toHaveText('0 / 0')

  // A single request with nearly two million results also exercises path collection.
  await input.fill('deep')
  await expect(counter).toHaveText('1 / 1999990', { timeout: 10_000 })
  await page.locator('[data-qa-id="nav-next"]').click()
  await expect(counter).toHaveText('2 / 1999990')

  await input.fill('')
  await expandAll.uncheck()
  await expect(rows).toHaveCount(10)
  await page.locator('[data-qa-id="view-tree-filter"]').click()
  await input.fill('deep-199999')
  await expect(counter).toHaveText('1 / 10', { timeout: 10_000 })
  await expect(page.locator('[data-qa-id="tree-row"][data-qa-active]')).toContainText('deep-199999')
  await page.locator('[data-qa-id="nav-next"]').click()
  await expect(counter).toHaveText('2 / 10')

  await input.fill('')
  await input.pressSequentially('coffe', { delay: 100 })
  await expect(counter).toHaveText('0 / 0')
  await expect(rows).toHaveCount(0)
  await input.fill('')
  await expect.poll(() => rows.count()).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
