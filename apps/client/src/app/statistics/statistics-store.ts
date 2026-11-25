import { createInjectionToken } from 'ngx-simple-signal-store';
import type { CollectionMediaChip } from '../collection/media-chips/media-chips-model';

export interface StatisticsState {
  selectedScope: CollectionMediaChip;
  view: 'year' | 'collection';
  year: number;
}

export const initialStatisticsState: StatisticsState = {
  selectedScope: 'all',
  view: 'year',
  year: new Date().getFullYear(),
};

export const statisticsStateToken = createInjectionToken<StatisticsState>('statisticsState');
