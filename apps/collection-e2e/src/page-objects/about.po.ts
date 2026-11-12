import type { Page } from '@playwright/test';
import { createCommonPage } from './common.po';

export const createAboutPage = (page: Page) => {
  const commonPage = createCommonPage(page);

  return {
    visit: async () => {
      await page.goto('/client/#/collection/library');
      await commonPage.openMenu();
      await commonPage.getNavAboutLink().click();
    },
    getTitle: () => page.getByTestId('about-title'),
    getBuild: () => page.getByTestId('about-build'),
    getVersion: () => page.getByTestId('about-version'),
    getGithubLink: () => page.getByTestId('about-github-link'),
    getHealthLink: () => page.getByTestId('about-health-link'),
    getApiDocsLink: () => page.getByTestId('about-api-docs-link'),
  };
};
