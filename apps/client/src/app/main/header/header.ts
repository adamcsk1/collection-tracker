import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { MenuDialog } from '../menu-dialog/menu-dialog';

@Component({
  selector: 'ct-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'banner',
  },
})
export class Header {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);

  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
  };
  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }
}
