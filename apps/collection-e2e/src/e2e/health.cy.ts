import { HealthPage } from '../page-objects/health.po';

describe('Health page', () => {
  beforeEach(() => {
    HealthPage.visit();
  });

  it('shows the login link', () => {
    HealthPage.getLoginLink().should('be.visible').and('have.attr', 'href', '/login/');
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

  it('shows the AI status card', () => {
    HealthPage.getAiCard().should('be.visible');
    HealthPage.getAiCard().find('[data-status]').should('have.attr', 'data-status').and('match', /^(up|down)$/);
  });
});
