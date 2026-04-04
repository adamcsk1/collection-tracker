export const buildHealthResponse = () => ({
  status: 'ok' as const,
  memory: { usedPercent: 42 },
  cpu: { usagePercent: 15 },
  disk: { usedPercent: 60 },
  load: { avg1m: 0.5, avg5m: 0.8, avg15m: 1.0 },
  frontend: { status: 'up' as const },
});
