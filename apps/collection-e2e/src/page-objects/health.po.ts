import type { Page } from '@playwright/test';

export const createHealthPage = (page: Page) => ({
  visit: async () => {
    await page.goto('/health/');
  },

  getLoginLink: () => page.getByTestId('health-login-link'),
  getDiagnosticsUnauthorized: () => page.getByTestId('health-diagnostics-unauthorized'),
  getStatusBanner: () => page.getByTestId('health-status-banner'),
  getMetricsGrid: () => page.getByTestId('health-metrics-grid'),
  getMemoryCard: () => page.getByTestId('health-memory-card'),
  getCpuCard: () => page.getByTestId('health-cpu-card'),
  getMetadataCard: () => page.getByTestId('health-metadata-card'),
  getMetadataStatus: () => page.getByTestId('health-metadata-status'),
  getAiCard: () => page.getByTestId('health-ai-card'),
  getAiStatus: () => page.getByTestId('health-ai-status'),
});
