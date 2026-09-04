import type { HealthDiagnosticsApiResponseModel } from '@shared/models/api-model';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { setTimeout } from 'node:timers/promises';
import { getArgv } from '../argv/argv';
import { getMetadataServiceUrl } from '../external-metadata/external-metadata-provider-factory';
import { validateOllamaConnection } from '../ollama/ollama';

const HEALTH_CACHE_TTL_MS = 5_000;

let cachedHealth: { expiresAt: number; value: HealthDiagnosticsApiResponseModel } | undefined;
let pendingHealthCheck: Promise<HealthDiagnosticsApiResponseModel> | undefined;

const getCpuUsagePercent = async (): Promise<number> => {
  const startTimes = os.cpus().map((cpu) => ({ ...cpu.times }));
  await setTimeout(1000);
  let totalIdle = 0;
  let totalTick = 0;
  for (const [index, cpu] of os.cpus().entries()) {
    const start = startTimes[index];
    totalIdle += cpu.times.idle - start.idle;
    totalTick +=
      cpu.times.user -
      start.user +
      cpu.times.nice -
      start.nice +
      cpu.times.sys -
      start.sys +
      cpu.times.idle -
      start.idle +
      cpu.times.irq -
      start.irq;
  }
  return totalTick === 0 ? 0 : Math.round(((totalTick - totalIdle) / totalTick) * 1000) / 10;
};

const checkFrontendStatus = async (): Promise<HealthDiagnosticsApiResponseModel['frontend']> => {
  try {
    const healthCheckUrl = process.env['HEALTH_CHECK_URL'] || 'http://127.0.0.1:3001/';
    const response = await fetch(healthCheckUrl, { signal: AbortSignal.timeout(3000) });
    await response.body?.cancel();
    return { status: response.ok ? 'up' : 'down' };
  } catch {
    return { status: 'down' };
  }
};

const checkAiStatus = async (): Promise<HealthDiagnosticsApiResponseModel['ai']> => {
  try {
    await validateOllamaConnection();
    return { status: 'up' };
  } catch {
    return { status: 'down' };
  }
};

const checkMetadataStatus = async (): Promise<HealthDiagnosticsApiResponseModel['metadata']> => {
  try {
    const response = await fetch(new URL('health', getMetadataServiceUrl()), {
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    await response.body?.cancel();
    return { status: response.ok ? 'up' : 'down' };
  } catch {
    return { status: 'down' };
  }
};

const getDiskUsedPercent = (): HealthDiagnosticsApiResponseModel['disk'] => {
  try {
    const stats = fs.statfsSync(getArgv().dataFolder);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    return { usedPercent: total === 0 ? 0 : Math.round(((total - free) / total) * 1000) / 10 };
  } catch {
    return null;
  }
};

const deriveStatus = (
  memoryUsedPercent: number,
  cpuUsagePercent: number,
  disk: HealthDiagnosticsApiResponseModel['disk'],
  frontendStatus: HealthDiagnosticsApiResponseModel['frontend']['status'],
  metadataStatus: HealthDiagnosticsApiResponseModel['metadata']['status']
): HealthDiagnosticsApiResponseModel['status'] => {
  if (frontendStatus === 'down' || metadataStatus === 'down') return 'error';
  if (memoryUsedPercent > 95 || cpuUsagePercent > 95 || (disk !== null && disk.usedPercent > 95)) return 'error';
  if (memoryUsedPercent > 80 || cpuUsagePercent > 80 || (disk !== null && disk.usedPercent > 80)) return 'warn';
  return 'ok';
};

const collectHealth = async (): Promise<HealthDiagnosticsApiResponseModel> => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const [avg1m, avg5m, avg15m] = os.loadavg();
  const [cpuUsagePercent, frontend, metadata, ai] = await Promise.all([
    getCpuUsagePercent(),
    checkFrontendStatus(),
    checkMetadataStatus(),
    checkAiStatus(),
  ]);
  const memoryUsedPercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 1000) / 10;
  const disk = getDiskUsedPercent();

  return {
    status: deriveStatus(memoryUsedPercent, cpuUsagePercent, disk, frontend.status, metadata.status),
    memory: { usedPercent: memoryUsedPercent },
    cpu: { usagePercent: cpuUsagePercent },
    disk,
    load: {
      avg1m: Math.round(avg1m * 100) / 100,
      avg5m: Math.round(avg5m * 100) / 100,
      avg15m: Math.round(avg15m * 100) / 100,
    },
    frontend,
    metadata,
    ai,
  };
};

export const getHealth = (): Promise<HealthDiagnosticsApiResponseModel> => {
  if (cachedHealth && cachedHealth.expiresAt > Date.now()) return Promise.resolve(cachedHealth.value);

  pendingHealthCheck ??= collectHealth()
    .then((value) => {
      cachedHealth = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, value };
      return value;
    })
    .finally(() => {
      pendingHealthCheck = undefined;
    });

  return pendingHealthCheck;
};
