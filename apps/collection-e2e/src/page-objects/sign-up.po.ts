import type { Page } from '@playwright/test';

export const createSignUpPage = (page: Page) => {
  const getUsernameInput = () => page.getByTestId('sign-up-username').locator('input');
  const getSubmitButton = () => page.getByTestId('sign-up-submit');

  return {
    visit: async () => {
      await page.context().clearCookies();
      await page.addInitScript(() => window.localStorage.removeItem('CT.LoggedIn'));
      await page.goto('/login/#/sign-up');
    },

    getUsernameInput,
    getSubmitButton,
    getSecretValue: () => page.getByTestId('sign-up-secret-value'),
    getSignInLink: () => page.getByTestId('sign-in-link'),

    fillUsername: async (username: string) => {
      await getUsernameInput().fill(username);
    },
    submit: async () => {
      await getSubmitButton().click();
    },
  };
};
