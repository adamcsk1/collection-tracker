import { CollectionItemOrderBy, CollectionItemOrderDirection } from '@shared/models/api-model';

export type FloatActionFilter = 'movie' | 'series' | 'unwatched' | 'favorite' | 'completed' | 'uncompleted';

export interface FloatActionButtonsConfig {
  collectionLength: number;
  showActions: boolean;
  showAddButton: boolean;
  showAiSearchButton: boolean;
  showRandomPickButton: boolean;
  showOrderButtons: boolean;
  filterActions: FloatActionFilter[];
  activeFilterActions: FloatActionFilter[];
  useAiSearch: boolean;
  orderBy: CollectionItemOrderBy;
  orderDirection: CollectionItemOrderDirection;
}

export interface FloatActionButtonsCallbacks {
  addNew: () => void;
  randomPick: () => void;
  toggleAiSearch: () => void;
  toggleOrderBy: () => void;
  toggleOrderDirection: () => void;
  applyFilter: (filter: FloatActionFilter) => void;
  showFunctions: () => void;
}
