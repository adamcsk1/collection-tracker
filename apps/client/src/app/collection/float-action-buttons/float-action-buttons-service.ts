import { Injectable, signal } from '@angular/core';
import { FloatActionButtonsCallbacks, FloatActionButtonsConfig, FloatActionFilter } from './float-action-buttons-model';

const initialConfig: FloatActionButtonsConfig = {
  collectionLength: 0,
  showActions: false,
  showAddButton: true,
  showRandomPickButton: true,
  showOrderButtons: false,
  filterActions: [],
  activeFilterActions: [],
  orderBy: 'createdAt',
  orderDirection: 'desc',
};

const noopCallbacks: FloatActionButtonsCallbacks = {
  addNew: () => void 0,
  randomPick: () => void 0,
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
