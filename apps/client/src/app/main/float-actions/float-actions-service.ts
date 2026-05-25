import { Injectable, signal, TemplateRef, Type } from '@angular/core';
import { initialConfig } from './float-actions-const';
import { FloatActionsConfig } from './float-actions-model';

@Injectable({ providedIn: 'root' })
export class FloatActionsService {
  private readonly _config = signal<FloatActionsConfig>(initialConfig);
  private readonly _searchTemplate = signal<TemplateRef<unknown> | null>(null);
  private readonly _actionsComponent = signal<Type<unknown> | null>(null);
  private readonly _actionButtonsVisible = signal(false);

  public readonly config = this._config.asReadonly();
  public readonly searchTemplate = this._searchTemplate.asReadonly();
  public readonly actionsComponent = this._actionsComponent.asReadonly();
  public readonly actionButtonsVisible = this._actionButtonsVisible.asReadonly();

  private scrollToTopCallback = (): void => void 0;

  public updateConfig(config: Partial<FloatActionsConfig>): void {
    this._config.update((currentConfig) => ({ ...currentConfig, ...config }));
  }

  public setScrollToTopCallback(callback: () => void): void {
    this.scrollToTopCallback = callback;
  }

  public resetActions(): void {
    this._config.set(initialConfig);
    this._actionsComponent.set(null);
    this._actionButtonsVisible.set(false);
    this.scrollToTopCallback = (): void => void 0;
  }

  public setSearchTemplate(template: TemplateRef<unknown> | null): void {
    this._searchTemplate.set(template);
  }

  public setActionsComponent(component: Type<unknown> | null): void {
    this._actionsComponent.set(component);
  }

  public setActionButtonsVisible(visible: boolean): void {
    this._actionButtonsVisible.set(visible);
  }

  public scrollToTop(): void {
    this.scrollToTopCallback();
  }
}
