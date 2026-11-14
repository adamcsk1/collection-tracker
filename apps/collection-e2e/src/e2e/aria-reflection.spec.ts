import { expect, test } from '@playwright/test';

test('ARIA references remain readable from page and locator worlds', async ({ page }) => {
  await page.setContent(`
    <span id="action-label">Save</span>
    <button data-test-id="action" aria-labelledby="action-label"></button>
  `);
  const action = page.getByTestId('action');
  const getLabelIds = () => action.evaluate((element) => element.ariaLabelledByElements?.map((label) => label.id));

  expect(await getLabelIds()).toEqual(['action-label']);
  await expect(action).toHaveAccessibleName('Save');
  expect(await getLabelIds()).toEqual(['action-label']);
});
