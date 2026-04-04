export const HealthPage = {
  visit: () => cy.visit('/health/'),

  getLoginLink: () => cy.getByTestId('health-login-link'),
  getStatusBanner: () => cy.getByTestId('health-status-banner'),
  getMetricsGrid: () => cy.getByTestId('health-metrics-grid'),
  getMemoryCard: () => cy.getByTestId('health-memory-card'),
  getCpuCard: () => cy.getByTestId('health-cpu-card'),
};
