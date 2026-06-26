import { Injectable, signal } from '@angular/core';
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

const initialConfig: FloatActionButtonsConfig = {
  collectionLength: 0,
  showActions: false,
  showAddButton: true,
  showAiSearchButton: true,
  showRandomPickButton: true,
  showOrderButtons: false,
  filterActions: [],
  activeFilterActions: [],
  useAiSearch: false,
  orderBy: 'createdAt',
  orderDirection: 'desc',
};

const noopCallbacks: FloatActionButtonsCallbacks = {
  addNew: () => void 0,
  randomPick: () => void 0,
  toggleAiSearch: () => void 0,
  toggleOrderBy: () => void 0,
  toggleOrderDirection: () => void 0,
  applyFilter: () => void 0,
  showFunctions: () => void 0,
};

@Injectable({ providedIn: 'root' })
export class FloatActionButtonsService {
  private readonly _config = signal<FloatActionButtonsConfig>(initialConfig);

  public readonly config = this._config.asReadonly();

  private callbacks: FloatActionButtonsCallbacks = noopCallbacks;

  public updateConfig(config: Partial<FloatActionButtonsConfig>): void {
    this._config.update((currentConfig) => ({ ...currentConfig, ...config }));
  }

  public setCallbacks(callbacks: FloatActionButtonsCallbacks): void {
    this.callbacks = callbacks;
  }

  public reset(): void {
    this._config.set(initialConfig);
    this.callbacks = noopCallbacks;
  }

  public addNew(): void {
    this.callbacks.addNew();
  }

  public randomPick(): void {
    this.callbacks.randomPick();
  }

  public toggleAiSearch(): void {
    this.callbacks.toggleAiSearch();
  }

  public toggleOrderBy(): void {
    this.callbacks.toggleOrderBy();
  }

  public toggleOrderDirection(): void {
    this.callbacks.toggleOrderDirection();
  }

  public applyFilter(filter: FloatActionFilter): void {
    this.callbacks.applyFilter(filter);
  }

  public showFunctions(): void {
    this.callbacks.showFunctions();
  }
}
