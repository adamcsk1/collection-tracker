import {
  CollectionItemOrderBy,
  CollectionItemOrderDirection,
  CollectionItemsPageModel,
} from '@shared/models/api-model';
import { Observable } from 'rxjs';

export type { CollectionItemModel, CollectionModel } from '@shared/models/collection-item-model';

export interface CollectionListDataSourceRequest {
  reset: boolean;
  cursor: string | null;
  limit: number;
  searchText: string;
  orderBy: CollectionItemOrderBy;
  orderDirection: CollectionItemOrderDirection;
}

export interface CollectionListOrderPreference {
  orderBy: CollectionItemOrderBy;
  orderDirection: CollectionItemOrderDirection;
}

export type CollectionListDataSource = (
  request: CollectionListDataSourceRequest
) => Observable<CollectionItemsPageModel>;
