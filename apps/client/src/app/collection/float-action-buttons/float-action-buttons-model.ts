import { CollectionItemOrderBy, CollectionItemOrderDirection } from '@shared/models/api-model';

export type FloatActionFilter =
  'movie' | 'series' | 'book' | 'unwatched' | 'favorite' | 'completed' | 'uncompleted' | 'sharedMine' | 'sharedOnly';

export interface FloatActionButtonsConfig {
  collectionLength: number;
  showActions: boolean;
  showAddButton: boolean;
  showRandomPickButton: boolean;
  showOrderButtons: boolean;
  filterActions: FloatActionFilter[];
  activeFilterActions: FloatActionFilter[];
  orderBy: CollectionItemOrderBy;
  orderDirection: CollectionItemOrderDirection;
}

export interface FloatActionButtonsCallbacks {
  addNew: () => void;
  randomPick: () => void;
  toggleOrderBy: () => void;
  toggleOrderDirection: () => void;
  applyFilter: (filter: FloatActionFilter) => void;
  showFunctions: () => void;
}
