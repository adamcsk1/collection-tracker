import { Injectable, signal } from '@angular/core';

export interface FloatActionButtonsConfig {
  collectionLength: number;
  showActions: boolean;
  showAddButton: boolean;
  showAiSearchButton: boolean;
  showRandomPickButton: boolean;
  useAiSearch: boolean;
}

export interface FloatActionButtonsCallbacks {
  addNew: () => void;
  randomPick: () => void;
  toggleAiSearch: () => void;
  showFunctions: () => void;
}

const initialConfig: FloatActionButtonsConfig = {
  collectionLength: 0,
  showActions: false,
  showAddButton: true,
  showAiSearchButton: true,
  showRandomPickButton: true,
  useAiSearch: false,
};

const noopCallbacks: FloatActionButtonsCallbacks = {
  addNew: () => void 0,
  randomPick: () => void 0,
  toggleAiSearch: () => void 0,
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

  public showFunctions(): void {
    this.callbacks.showFunctions();
  }
}
