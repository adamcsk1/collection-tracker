import { Injectable, signal, TemplateRef, Type } from '@angular/core';
import { initialConfig } from './float-actions-const';
import { FloatActionsConfig } from './float-actions-model';

@Injectable({ providedIn: 'root' })
export class FloatActionsService {
  private readonly _config = signal<FloatActionsConfig>(initialConfig);
  private readonly _searchTemplate = signal<TemplateRef<unknown> | null>(null);
  private readonly _searchActionAvailable = signal(false);
  private readonly _aiSearchAvailable = signal(false);
  private readonly _aiSearchActive = signal(false);
  private readonly _actionsComponent = signal<Type<unknown> | null>(null);
  private readonly _actionButtonsVisible = signal(false);

  public readonly config = this._config.asReadonly();
  public readonly searchTemplate = this._searchTemplate.asReadonly();
  public readonly searchActionAvailable = this._searchActionAvailable.asReadonly();
  public readonly aiSearchAvailable = this._aiSearchAvailable.asReadonly();
  public readonly aiSearchActive = this._aiSearchActive.asReadonly();
  public readonly actionsComponent = this._actionsComponent.asReadonly();
  public readonly actionButtonsVisible = this._actionButtonsVisible.asReadonly();

  private scrollToTopCallback = (): void => void 0;
  private searchActionCallback = (): void => void 0;
  private aiSearchActionCallback = (): void => void 0;

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
    this._searchActionAvailable.set(false);
    this._aiSearchAvailable.set(false);
    this._aiSearchActive.set(false);
    this.scrollToTopCallback = (): void => void 0;
    this.searchActionCallback = (): void => void 0;
    this.aiSearchActionCallback = (): void => void 0;
  }

  public setSearchTemplate(template: TemplateRef<unknown> | null, searchActionCallback?: () => void): void {
    this._searchTemplate.set(template);
    this.searchActionCallback = searchActionCallback ?? (() => void 0);
    this._searchActionAvailable.set(!!searchActionCallback);
  }

  public setAiSearchAction(available: boolean, active: boolean, callback?: () => void): void {
    this._aiSearchAvailable.set(available);
    this._aiSearchActive.set(active);
    this.aiSearchActionCallback = callback ?? (() => void 0);
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

  public triggerSearchAction(): void {
    this.searchActionCallback();
  }

  public triggerAiSearchAction(): void {
    this.aiSearchActionCallback();
  }
}
