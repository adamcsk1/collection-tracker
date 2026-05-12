// Global support for Cypress e2e tests
import './commands';

// Suppress uncaught Angular HttpErrorResponse exceptions so that server errors
// triggered by the app (e.g. a 404 on a stale item) do not fail unrelated tests.
Cypress.on('uncaught:exception', (error) => {
  if (error.name === 'HttpErrorResponse' || error.message.includes('HttpErrorResponse')) return false;
});
