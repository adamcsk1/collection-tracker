import { expect, test } from '../support/test';
import { createAboutPage } from '../page-objects/about.po';

test.describe('About page', () => {
  test.beforeEach(async ({ page, autoLogin }) => {
    await autoLogin();
    const aboutPage = createAboutPage(page);
    await aboutPage.visit();
  });

  test('renders the page contract', async ({ page }) => {
    const aboutPage = createAboutPage(page);
    await expect(aboutPage.getTitle()).toBeVisible();
    await expect(aboutPage.getTitle()).not.toBeEmpty();
    await expect(page).toHaveURL(/#\/about/);
    await expect(page).not.toHaveURL(/#\/collection\/library/);
    await expect(aboutPage.getBuild()).toBeVisible();
    await expect(aboutPage.getBuild()).not.toBeEmpty();
    await expect(aboutPage.getVersion()).toBeVisible();
    await expect(aboutPage.getVersion()).not.toBeEmpty();
    await expect(aboutPage.getGithubLink()).toBeVisible();
    await expect(aboutPage.getGithubLink()).toHaveAttribute('href', 'https://github.com/adamcsk1/collection-tracker');
    await expect(aboutPage.getHealthLink()).toBeVisible();
    await expect(aboutPage.getHealthLink()).toHaveAttribute('href', '/health/');
    await expect(aboutPage.getApiDocsLink()).toBeVisible();
    await expect(aboutPage.getApiDocsLink()).toHaveAttribute('href', '/api/docs');
  });
});
