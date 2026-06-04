export const SignInPage = {
  visit: () => {
    cy.clearCookies({ log: false });
    cy.visit('/login/#/sign-in', {
      onBeforeLoad: (window) => window.localStorage.removeItem('CT.LoggedIn'),
    });
  },

  getUsernameInput: () => cy.getByTestId('sign-in-username').find('input'),
  getTokenInput: () => cy.getByTestId('sign-in-token').find('input'),
  getSubmitButton: () => cy.getByTestId('sign-in-submit'),
  getToggleSecretButton: () => cy.getByTestId('sign-in-toggle-secret'),
  getChangeApiUrlButton: () => cy.getByTestId('sign-in-change-api-url'),
  getApiUrlInput: () => cy.getByTestId('sign-in-api-url').find('input'),
  getLanguageSelect: () => cy.getByTestId('sign-in-language').find('select'),
  getThemeSelect: () => cy.getByTestId('sign-in-theme').find('select'),
  getSignUpLink: () => cy.getByTestId('sign-up-link'),

  fillUsername: (username: string) => SignInPage.getUsernameInput().clear().type(username),
  fillToken: (token: string) => SignInPage.getTokenInput().clear().type(token),
  submit: () => SignInPage.getSubmitButton().click(),

  fillAndSubmit: (username: string, token: string) => {
    SignInPage.fillUsername(username);
    SignInPage.fillToken(token);
    SignInPage.submit();
  },
};
