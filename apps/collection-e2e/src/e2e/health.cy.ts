import { HealthPage } from '../page-objects/health.po';

describe('Health page', () => {
  it('shows public status and login actions when signed out', () => {
    HealthPage.visit();
    cy.clearCookies();
    HealthPage.visit();
    HealthPage.getLoginLink().should('be.visible').and('have.attr', 'href', '/login/');
    HealthPage.getStatusBanner()
      .should('be.visible')
      .invoke('attr', 'data-status')
      .should('match', /^(ok|warn|error)$/);
    HealthPage.getMetricsGrid().should('not.exist');
    HealthPage.getDiagnosticsUnauthorized().should('be.visible');
  });

  describe('authenticated diagnostics', () => {
    beforeEach(() => {
      cy.autoLogin();
      HealthPage.visit();
    });

    it('shows the status banner with a valid status', () => {
      HealthPage.getStatusBanner()
        .should('be.visible')
        .invoke('attr', 'data-status')
        .should('match', /^(ok|warn|error)$/);
    });

    it('shows the metrics grid', () => {
      HealthPage.getMetricsGrid().should('be.visible');
    });

    it('shows memory usage in the memory card', () => {
      HealthPage.getMemoryCard().should('be.visible').and('contain.text', '%');
    });

    it('shows CPU usage in the CPU card', () => {
      HealthPage.getCpuCard().should('be.visible').and('contain.text', '%');
    });

    it('shows the metadata status card', () => {
      HealthPage.getMetadataCard().should('be.visible');
      HealthPage.getMetadataStatus().should('have.attr', 'data-status').and('match', /^(up|down)$/);
    });

    it('shows the AI status card', () => {
      HealthPage.getAiCard().should('be.visible');
      HealthPage.getAiStatus().should('have.attr', 'data-status').and('match', /^(up|down)$/);
    });
  });
});
