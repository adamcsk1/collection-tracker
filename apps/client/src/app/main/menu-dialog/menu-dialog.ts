import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { MenuNav } from '../menu-nav/menu-nav';

@Component({
  selector: 'ct-menu-dialog',
  imports: [DialogShell, MenuNav],
  templateUrl: './menu-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog',
  },
})
export class MenuDialog {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
  };
}
