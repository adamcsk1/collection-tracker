import { createInjectionToken } from 'ngx-simple-signal-store';
import type { CollectionActivityApiModel, CollectionActivityStatus } from '@shared/models/api-model';

export interface StatisticsActivityState {
  data: CollectionActivityApiModel | null;
  status: 'pending' | 'finished' | 'error';
  selected: CollectionActivityStatus;
  month: number | null;
  revision: number;
}
export const initialActivityState: StatisticsActivityState = {
  data: null,
  status: 'pending',
  selected: 'completed',
  month: null,
  revision: 0,
};
export const activityStateToken = createInjectionToken<StatisticsActivityState>('statisticsActivity');
