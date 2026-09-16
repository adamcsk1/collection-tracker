import { AboutPage } from '../page-objects/about.po';

describe('About page', () => {
  beforeEach(() => {
    cy.autoLogin();
    AboutPage.visit();
  });

  it('renders the page contract', () => {
    AboutPage.getTitle().should('be.visible').and('not.be.empty');
    cy.url().should('include', '#/about');
    cy.url().should('not.include', '#/collection/library');
    AboutPage.getBuild().should('be.visible').and('not.be.empty');
    AboutPage.getVersion().should('be.visible').and('not.be.empty');
    AboutPage.getGithubLink()
      .should('be.visible')
      .and('have.attr', 'href', 'https://github.com/adamcsk1/collection-tracker');
    AboutPage.getHealthLink().should('be.visible').and('have.attr', 'href', '/health/');
    AboutPage.getApiDocsLink().should('be.visible').and('have.attr', 'href', '/api/docs');
  });
});
