import { createInjectionToken } from 'ngx-simple-signal-store';
import type { CollectionItemApiModel } from '@shared/models/api-model';

export interface StatisticsItemsState {
  items: CollectionItemApiModel[];
  cursor: string | null;
  nextCursor: string | null;
  status: 'pending' | 'finished' | 'error';
  revision: number;
  restoreCount: number;
}
export const initialItemsState: StatisticsItemsState = {
  items: [],
  cursor: null,
  nextCursor: null,
  status: 'pending',
  revision: 0,
  restoreCount: 50,
};
export const itemsStateToken = createInjectionToken<StatisticsItemsState>('statisticsItems');
