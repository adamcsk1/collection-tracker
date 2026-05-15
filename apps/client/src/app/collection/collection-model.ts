import { CollectionItemsApiResponseModel } from '@shared/models/api-model';
import { Observable } from 'rxjs';

export type { CollectionItemModel, CollectionModel } from '@shared/models/collection-item-model';

export interface CollectionListDataSourceRequest {
  reset: boolean;
  offset: number;
  limit: number;
  searchText: string;
}

export type CollectionListDataSource = (
  request: CollectionListDataSourceRequest
) => Observable<CollectionItemsApiResponseModel>;
