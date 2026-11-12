import { createCommonPage } from '../page-objects/common.po';
import { createSignInPage } from '../page-objects/sign-in.po';
import { createSignUpPage } from '../page-objects/sign-up.po';
import { expect, test } from '../support/test';

let commonPage: ReturnType<typeof createCommonPage>;
let signInPage: ReturnType<typeof createSignInPage>;
let signUpPage: ReturnType<typeof createSignUpPage>;

test.beforeEach(async ({ page }) => {
  commonPage = createCommonPage(page);
  signInPage = createSignInPage(page);
  signUpPage = createSignUpPage(page);
});

test.describe('Auth — Sign-up', () => {
  test.beforeEach(async () => {
    await signUpPage.visit();
  });

  test('submit is enabled once a valid username is entered', async () => {
    await signUpPage.fillUsername('newuser123');
    await expect(signUpPage.getSubmitButton()).toBeEnabled();
  });

  test('reveals the generated secret after successful sign-up', async () => {
    await signUpPage.fillUsername(`signup_test_${Date.now()}`);
    await signUpPage.submit();
    await expect(signUpPage.getSecretValue()).toBeVisible();
    await expect(signUpPage.getSecretValue()).not.toBeEmpty();
  });

  test('navigates to sign-in via the back link', async ({ page }) => {
    await signUpPage.getSignInLink().click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('Auth — Sign-in', () => {
  test.beforeEach(async () => {
    await signInPage.visit();
  });

  test('submit becomes enabled when both fields are filled', async () => {
    await signInPage.fillUsername('testuser');
    await signInPage.fillToken('testtoken');
    await expect(signInPage.getSubmitButton()).toBeEnabled();
  });

  test('toggles secret visibility', async () => {
    await expect(signInPage.getTokenInput()).toHaveAttribute('type', 'password');
    await signInPage.getToggleSecretButton().click();
    await expect(signInPage.getTokenInput()).toHaveAttribute('type', 'text');
    await signInPage.getToggleSecretButton().click();
    await expect(signInPage.getTokenInput()).toHaveAttribute('type', 'password');
  });

  test('signs in with a freshly created user and navigates to the client', async ({ autoLogin, page }) => {
    await autoLogin();
    await expect(page).toHaveURL(/\/client\//);
  });

  test('navigates to sign-up page via link', async ({ page }) => {
    await signInPage.getSignUpLink().click();
    await expect(page).toHaveURL(/\/sign-up/);
  });
});

test.describe('Auth — API URL switch', () => {
  test('reveals the API URL input when "Change API URL" is clicked', async () => {
    await signInPage.visit();
    await expect(signInPage.getApiUrlInput()).toHaveCount(0);
    await signInPage.getChangeApiUrlButton().click();
    await expect(signInPage.getApiUrlInput()).toBeVisible();
  });
});

test.describe('Auth — Language and theme override from login', () => {
  test.beforeEach(async () => {
    await signInPage.visit();
  });

  test('language selection persists across page reload', async () => {
    const languageSelect = signInPage.getLanguageSelect();
    const options = languageSelect.locator('option');
    await expect(options.first()).toBeAttached();
    const selectedOption = options.nth((await options.count()) > 1 ? 1 : 0);
    const selectedValue = await selectedOption.evaluate((option: HTMLOptionElement) => option.value);
    await languageSelect.selectOption(selectedValue);
    await signInPage.visit();
    await expect(languageSelect).toHaveValue(selectedValue);
  });

  test('theme selection persists across page reload', async () => {
    const themeSelect = signInPage.getThemeSelect();
    const options = themeSelect.locator('option');
    await expect(options.nth(1)).toBeAttached();
    const secondValue = await options.nth(1).evaluate((option: HTMLOptionElement) => option.value);
    await themeSelect.selectOption(secondValue);
    await signInPage.visit();
    await expect(themeSelect).toHaveValue(secondValue);
  });
});

test.describe('Auth - Logout', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('logs the user out and redirects to the login page', async ({ page }) => {
    const logoutResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/auth/session') && response.request().method() === 'DELETE'
    );

    await commonPage.openMenu();
    await commonPage.getNavLogoutLink().click();

    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBe(204);
    await expect(page).toHaveURL(/\/login\//);
  });
});
