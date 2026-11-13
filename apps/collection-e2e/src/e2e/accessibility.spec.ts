import AxeBuilder from '@axe-core/playwright';
import { createSignInPage } from '../page-objects/sign-in.po';
import { createSignUpPage } from '../page-objects/sign-up.po';
import { expect, test } from '../support/test';

test.describe('Accessibility', () => {
  for (const pageName of ['sign-in', 'sign-up'] as const) {
    test(`${pageName} has no automated accessibility violations`, async ({ page }, testInfo) => {
      const loginPage = pageName === 'sign-in' ? createSignInPage(page) : createSignUpPage(page);
      await loginPage.visit();
      await expect(loginPage.getUsernameInput()).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      await testInfo.attach('axe-results', {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });
      expect(results.violations).toEqual([]);
    });
  }
});
