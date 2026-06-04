export const SignUpPage = {
  visit: () => {
    cy.clearCookies({ log: false });
    cy.visit('/login/#/sign-up', {
      onBeforeLoad: (window) => window.localStorage.removeItem('CT.LoggedIn'),
    });
  },

  getUsernameInput: () => cy.getByTestId('sign-up-username').find('input'),
  getSubmitButton: () => cy.getByTestId('sign-up-submit'),
  getSecretValue: () => cy.getByTestId('sign-up-secret-value'),
  getSignInLink: () => cy.getByTestId('sign-in-link'),

  fillUsername: (username: string) => SignUpPage.getUsernameInput().clear().type(username),
  submit: () => SignUpPage.getSubmitButton().click(),
};
