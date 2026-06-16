import { AboutPage } from '../page-objects/about.po';

describe('About page', () => {
  beforeEach(() => {
    cy.autoLogin();
    AboutPage.visit();
    AboutPage.getDialog().should('be.visible');
  });

  it('opens as a dialog over the collection page', () => {
    AboutPage.getDialog().should('be.visible');
    cy.url().should('include', '#/collection/library');
    cy.url().should('not.include', '#/about');
  });

  it('shows the app title', () => {
    AboutPage.getTitle().should('be.visible').and('not.be.empty');
  });

  it('shows the build info', () => {
    AboutPage.getBuild().should('be.visible').and('not.be.empty');
  });

  it('shows the app version', () => {
    AboutPage.getVersion().should('be.visible').and('not.be.empty');
  });

  it('has a GitHub link pointing to the correct repository', () => {
    AboutPage.getGithubLink()
      .should('be.visible')
      .and('have.attr', 'href', 'https://github.com/adamcsk1/collection-tracker');
  });

  it('has a link to the server health page', () => {
    AboutPage.getHealthLink().should('be.visible').and('have.attr', 'href', '/health/');
  });

  it('has a link to the API docs', () => {
    AboutPage.getApiDocsLink().should('be.visible').and('have.attr', 'href', '/api/docs');
  });
});
