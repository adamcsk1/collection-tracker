import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ImageIcon } from '@components/image-icon/image-icon';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { MenuDialog } from '../menu-dialog/menu-dialog';
import { mainStateToken } from '../main-store';
import { FloatActionsService } from './float-actions-service';

@Component({
  selector: 'ct-float-actions',
  templateUrl: './float-actions.html',
  styleUrl: './float-actions.css',
  imports: [NgTemplateOutlet, ImageIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatActions {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly portal = inject(PortalService);
  protected readonly service = inject(FloatActionsService);

  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    scrollToTop: computed(() => this.ngxSignalTranslate.translate('ScrollToTop')),
    addNew: computed(() => this.ngxSignalTranslate.translate('AddNew')),
    searchSwitchButtonLabel: computed(() =>
      this.useAiSearch()
        ? this.ngxSignalTranslate.translate('SwitchToStandardSearch')
        : this.aiAvailable()
          ? this.ngxSignalTranslate.translate('SwitchToAiSearch')
          : this.ngxSignalTranslate.translate('AiSearchOffline')
    ),
    aiSearchOffline: computed(() => this.ngxSignalTranslate.translate('AiSearchOffline')),
    aiSearch: computed(() => this.ngxSignalTranslate.translate('AiSearch')),
    randomPick: computed(() => this.ngxSignalTranslate.translate('RandomPick')),
    hideFunctions: computed(() => this.ngxSignalTranslate.translate('HideFunctions')),
    showFunctions: computed(() => this.ngxSignalTranslate.translate('ShowFunctions')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly aiAvailable = this.mainState.state.aiAvailable;
  protected readonly config = this.service.config;
  protected readonly useAiSearch = computed(() => this.config().useAiSearch);
  protected readonly searchTemplate = this.service.searchTemplate;
  protected readonly showFloatButtons = signal(false);
  protected readonly actionButtonsVisible = computed(() => this.config().showActions && this.showFloatButtons());
  protected readonly canShowActionButton = computed(() => {
    const config = this.config();
    return config.showAddButton || config.showAiSearchButton || config.showRandomPickButton;
  });
  protected readonly addOnlyMode = computed(() => {
    const config = this.config();
    return config.showAddButton && !config.showAiSearchButton && !config.showRandomPickButton;
  });
  protected readonly showFloatActions = computed(() => this.config().showActions && this.canShowActionButton());
  protected readonly ollamaIcon = `${getBasePath()}/client/images/ollama-icon.png`;

  constructor() {
    effect(() => {
      if (!this.config().showActions) {
        this.showFloatButtons.set(false);
      }
    });
  }

  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }

  protected onShowFunctions(): void {
    if (!this.showFloatActions()) return;
    if (this.addOnlyMode()) {
      this.onAddNew();
      return;
    }

    this.showFloatButtons.set(true);
    this.service.showFunctions();
  }

  protected onHideFunctions(): void {
    this.showFloatButtons.set(false);
  }

  protected onRandomPick(): void {
    this.service.randomPick();
    this.showFloatButtons.set(false);
  }

  protected onToggleAiSearch(): void {
    this.service.toggleAiSearch();
    this.showFloatButtons.set(false);
  }

  protected onAddNew(): void {
    this.service.addNew();
    this.showFloatButtons.set(false);
  }

  protected onScrollToTop(): void {
    this.service.scrollToTop();
  }
}
