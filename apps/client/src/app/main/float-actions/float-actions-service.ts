import { Injectable, signal, TemplateRef } from '@angular/core';
import { initialConfig, noopCallbacks } from './float-actions-const';
import { FloatActionsCallbacks, FloatActionsConfig } from './float-actions-model';

@Injectable({ providedIn: 'root' })
export class FloatActionsService {
  private readonly _config = signal<FloatActionsConfig>(initialConfig);
  private readonly _searchTemplate = signal<TemplateRef<unknown> | null>(null);

  public readonly config = this._config.asReadonly();
  public readonly searchTemplate = this._searchTemplate.asReadonly();

  private callbacks: FloatActionsCallbacks = noopCallbacks;

  public updateConfig(config: Partial<FloatActionsConfig>): void {
    this._config.update((currentConfig) => ({ ...currentConfig, ...config }));
  }

  public setCallbacks(callbacks: FloatActionsCallbacks): void {
    this.callbacks = callbacks;
  }

  public resetActions(): void {
    this._config.set(initialConfig);
    this.callbacks = noopCallbacks;
  }

  public setSearchTemplate(template: TemplateRef<unknown> | null): void {
    this._searchTemplate.set(template);
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

  public scrollToTop(): void {
    this.callbacks.scrollToTop();
  }

  public showFunctions(): void {
    this.callbacks.showFunctions();
  }
}
