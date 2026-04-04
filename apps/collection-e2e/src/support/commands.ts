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
  const username = 'cypress';
  const token =
    'few deal cave wagon only forget frame food exchange swung steam by stick proud produce give naturally accept combine breath handsome freedom firm market is helpful special matter powder machine known lovely quickly require mission grandfather larger next stick lay best opposite good apple diameter pitch mysterious range hole whom raw country studying structure serious cost glad series black detail quickly happy arrive stand harbor middle affect around sand related told suddenly even leather deal design get shape noise space six calm root recall against shelf cookies enemy birth count even hungry image liquid rhythm mark express where color contain further end easy slightly observe barn something slide factor spell arrange piano paid still hill those parent health baby along upward upper spin circle firm fifth completely drop nothing detail difficult combine putting';

  cy.visit('/login/#/sign-in');
  cy.window().then((win) => win.localStorage.setItem('CT.AppMode', 'full'));
  cy.getByTestId('sign-in-username').find('input').type(username);
  cy.getByTestId('sign-in-token').find('input').type(token, { delay: 0 });
  cy.getByTestId('sign-in-submit').click();
  cy.url().should('include', '/client/');

  cy.request('GET', '/api/v1/get-all?limit=1000&offset=0').then((response) => {
    const items = response.body as Array<{ name: string; hash: string }>;
    items.forEach((item) => {
      cy.request('DELETE', `/api/v1/delete/${encodeURIComponent(item.name)}?hash=${encodeURIComponent(item.hash)}`);
    });
  });

  cy.visit('/client/#/collection');
});
