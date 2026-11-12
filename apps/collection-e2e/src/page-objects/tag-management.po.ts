import type { Page } from '@playwright/test';

export const createTagManagementPage = (page: Page) => ({
  visit: async () => {
    await page.goto('/client/#/settings/tag-management');
  },

  getResetButton: () => page.getByTestId('tag-management-reset'),
  getList: () => page.getByTestId('tag-management-list'),
  getColorButton: (tag: string) => page.getByTestId(`tag-management-color-${tag}`),
  findRenameInputHost: (tag: string) =>
    page.getByTestId('tag-management-list').locator(`[data-test-id="tag-management-rename-input-${tag}"]`),
  getRenameInput: (tag: string) => page.getByTestId(`tag-management-rename-input-${tag}`).locator('input'),
  getRenameButton: (tag: string) => page.getByTestId(`tag-management-rename-${tag}`),
  getWeightInput: (tag: string) => page.getByTestId(`tag-management-weight-${tag}`).locator('input'),
  getImageBorderCheckbox: (tag: string) =>
    page.getByTestId(`tag-management-image-border-${tag}`).locator('input[type="checkbox"]'),
  getTextColorCheckbox: (tag: string) =>
    page.getByTestId(`tag-management-text-color-${tag}`).locator('input[type="checkbox"]'),
  getImageBadgeCheckbox: (tag: string) =>
    page.getByTestId(`tag-management-image-badge-${tag}`).locator('input[type="checkbox"]'),
});
