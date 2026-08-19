export const HealthPage = {
  visit: () => cy.visit('/health/'),

  getLoginLink: () => cy.getByTestId('health-login-link'),
  getDiagnosticsUnauthorized: () => cy.getByTestId('health-diagnostics-unauthorized'),
  getStatusBanner: () => cy.getByTestId('health-status-banner'),
  getMetricsGrid: () => cy.getByTestId('health-metrics-grid'),
  getMemoryCard: () => cy.getByTestId('health-memory-card'),
  getCpuCard: () => cy.getByTestId('health-cpu-card'),
  getAiCard: () => cy.getByTestId('health-ai-card'),
  getAiStatus: () => cy.getByTestId('health-ai-status'),
};
