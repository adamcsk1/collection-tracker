import { API_PREFIX } from '@shared/constants/api-const';
import type { HealthApiResponseModel } from '@shared/models/api-model';
import type { Application } from 'express';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { setTimeout } from 'node:timers/promises';

const getCpuUsagePercent = async (): Promise<number> => {
  const startTimes = os.cpus().map((cpu) => ({ ...cpu.times }));
  await setTimeout(1000);
  let totalIdle = 0;
  let totalTick = 0;
  for (const [index, cpu] of os.cpus().entries()) {
    const start = startTimes[index];
    totalIdle += cpu.times.idle - start.idle;
    totalTick += cpu.times.user
      - start.user
      + cpu.times.nice
      - start.nice
      + cpu.times.sys
      - start.sys
      + cpu.times.idle
      - start.idle
      + cpu.times.irq
      - start.irq;
  }
  return totalTick === 0 ? 0 : Math.round(((totalTick - totalIdle) / totalTick) * 1000) / 10;
};

const checkFrontendStatus = async (): Promise<HealthApiResponseModel['frontend']> => {
  try {
    const response = await fetch('http://127.0.0.1:3001/', { signal: AbortSignal.timeout(3000) });
    await response.body?.cancel();
    return { status: 'up' };
  } catch {
    return { status: 'down' };
  }
};

const getDiskUsedPercent = (): HealthApiResponseModel['disk'] => {
  try {
    const stats = fs.statfsSync(process.cwd());
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
  disk: HealthApiResponseModel['disk'],
  frontendStatus: HealthApiResponseModel['frontend']['status'],
): HealthApiResponseModel['status'] => {
  if (frontendStatus === 'down') return 'error';
  if (memoryUsedPercent > 95 || cpuUsagePercent > 95 || (disk !== null && disk.usedPercent > 95)) return 'error';
  if (memoryUsedPercent > 80 || cpuUsagePercent > 80 || (disk !== null && disk.usedPercent > 80)) return 'warn';
  return 'ok';
};

export const register = (app: Application): void => {
  app.get(`${API_PREFIX}/health`, async (_request, response) => {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const [avg1m, avg5m, avg15m] = os.loadavg();

    const [cpuUsagePercent, frontend] = await Promise.all([getCpuUsagePercent(), checkFrontendStatus()]);

    const memoryUsedPercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 1000) / 10;
    const disk = getDiskUsedPercent();

    const result: HealthApiResponseModel = {
      status: deriveStatus(memoryUsedPercent, cpuUsagePercent, disk, frontend.status),
      memory: { usedPercent: memoryUsedPercent },
      cpu: { usagePercent: cpuUsagePercent },
      disk,
      load: {
        avg1m: Math.round(avg1m * 100) / 100,
        avg5m: Math.round(avg5m * 100) / 100,
        avg15m: Math.round(avg15m * 100) / 100,
      },
      frontend,
    };

    response.send(result);
  });
};
