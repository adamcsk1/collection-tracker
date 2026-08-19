import { createInjectionToken } from 'ngx-simple-signal-store';
import type { CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import type { CollectionMediaChip } from '../collection/media-chips/media-chips-model';

export type StatisticsLoadStatus = 'pending' | 'finished' | 'error';

export interface StatisticsState {
  selectedScope: CollectionMediaChip;
  statistics: CollectionStatisticsApiResponseModel | null;
  loadStatus: StatisticsLoadStatus;
  reloadVersion: number;
  cache: Partial<Record<CollectionMediaChip, CollectionStatisticsApiResponseModel>>;
}

export const initialStatisticsState: StatisticsState = {
  selectedScope: 'all',
  statistics: null,
  loadStatus: 'pending',
  reloadVersion: 0,
  cache: {},
};

export const statisticsStateToken = createInjectionToken<StatisticsState>('statisticsState');
