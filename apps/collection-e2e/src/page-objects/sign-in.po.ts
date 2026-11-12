import type { Page } from '@playwright/test';

export const createSignInPage = (page: Page) => {
  const getUsernameInput = () => page.getByTestId('sign-in-username').locator('input');
  const getTokenInput = () => page.getByTestId('sign-in-token').locator('input');
  const getSubmitButton = () => page.getByTestId('sign-in-submit');

  const fillUsername = async (username: string) => {
    await getUsernameInput().fill(username);
  };
  const fillToken = async (token: string) => {
    await getTokenInput().fill(token);
  };
  const submit = async () => {
    await getSubmitButton().click();
  };

  return {
    visit: async () => {
      await page.context().clearCookies();
      await page.addInitScript(() => window.localStorage.removeItem('CT.LoggedIn'));
      await page.goto('/login/#/sign-in');
    },

    getUsernameInput,
    getTokenInput,
    getSubmitButton,
    getToggleSecretButton: () => page.getByTestId('sign-in-toggle-secret'),
    getChangeApiUrlButton: () => page.getByTestId('sign-in-change-api-url'),
    getApiUrlInput: () => page.getByTestId('sign-in-api-url').locator('input'),
    getLanguageSelect: () => page.getByTestId('sign-in-language').locator('select'),
    getThemeSelect: () => page.getByTestId('sign-in-theme').locator('select'),
    getSignUpLink: () => page.getByTestId('sign-up-link'),

    fillUsername,
    fillToken,
    submit,

    fillAndSubmit: async (username: string, token: string) => {
      await fillUsername(username);
      await fillToken(token);
      await submit();
    },
  };
};
