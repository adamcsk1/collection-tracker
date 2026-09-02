// Global support for Cypress e2e tests
import './commands';

Cypress.Keyboard.defaults({ keystrokeDelay: 10 });

afterEach(() => {
  cy.document({ log: false, timeout: 5000 }).then((document) => {
    const view = document.defaultView;
    if (!view) return;
    document.dispatchEvent(
      new view.PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true })
    );
    document.dispatchEvent(
      new view.PointerEvent('pointercancel', { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true })
    );
  });
});

// Suppress uncaught Angular HttpErrorResponse exceptions so that server errors
// triggered by the app (e.g. a 404 on a stale item) do not fail unrelated tests.
Cypress.on('uncaught:exception', (error) => {
  if (error.name === 'HttpErrorResponse' || error.message.includes('HttpErrorResponse')) return false;
});
