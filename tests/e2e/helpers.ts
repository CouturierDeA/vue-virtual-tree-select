import type { Page } from '@playwright/test'

export async function gotoTreeView(page: Page): Promise<void> {
  await page.goto('/')
}
