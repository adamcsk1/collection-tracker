/// <reference types="cypress" />

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      /**
       * Signs up a fresh unique user and signs in — no mocks needed.
       * The real server is used for all /api/v1/ calls.
       */
      autoLogin(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-test-id="${testId}"]`);
});

Cypress.Commands.add('autoLogin', () => {
  const username = `cy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  cy.visit('/login/#/sign-up');
  cy.getByTestId('sign-up-username').find('input').type(username);
  cy.getByTestId('sign-up-submit').click();
  cy.getByTestId('sign-up-secret-value')
    .should('be.visible')
    .invoke('text')
    .then((secret) => {
      cy.visit('/login/#/sign-in');
      cy.window().then((win) => win.localStorage.setItem('CT.AppMode', 'full'));
      cy.getByTestId('sign-in-username').find('input').type(username);
      cy.getByTestId('sign-in-token').find('input').type(secret.toString().trim(), { delay: 0 });
      cy.getByTestId('sign-in-submit').click();
      cy.url().should('include', '/client/');
    });

  cy.visit('/client/#/collection');
});
