import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { MenuDialog } from '../menu-dialog/menu-dialog';
import { FloatActionsService } from './float-actions-service';

@Component({
  selector: 'ct-float-actions',
  templateUrl: './float-actions.html',
  styleUrl: './float-actions.css',
  imports: [NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatActions {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  protected readonly service = inject(FloatActionsService);

  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    scrollToTop: computed(() => this.ngxSignalTranslate.translate('ScrollToTop')),
  };
  protected readonly config = this.service.config;
  protected readonly searchTemplate = this.service.searchTemplate;
  protected readonly actionsComponent = this.service.actionsComponent;
  protected readonly actionButtonsVisible = this.service.actionButtonsVisible;
  protected readonly showFloatActions = computed(() => this.config().actionsAvailable && !!this.actionsComponent());
  protected readonly showMenuOnlyBar = computed(() => !this.searchTemplate() && !this.showFloatActions());

  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }

  protected onScrollToTop(): void {
    this.service.scrollToTop();
  }
}
