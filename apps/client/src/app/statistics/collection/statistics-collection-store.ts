import { createInjectionToken } from 'ngx-simple-signal-store';
import type { CollectionItemFiltersApiModel, CollectionStatisticsApiResponseModel } from '@shared/models/api-model';

export interface StatisticsCollectionState {
  data: CollectionStatisticsApiResponseModel | null;
  status: 'pending' | 'finished' | 'error';
  filters: CollectionItemFiltersApiModel | null;
  title: string;
  revision: number;
}
export const initialCollectionState: StatisticsCollectionState = {
  data: null,
  status: 'pending',
  filters: null,
  title: '',
  revision: 0,
};
export const collectionStatisticsStateToken = createInjectionToken<StatisticsCollectionState>('collectionStatistics');
