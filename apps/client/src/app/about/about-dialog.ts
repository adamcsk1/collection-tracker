import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { About } from './about';

@Component({
  selector: 'ct-about-dialog',
  imports: [DialogShell, About],
  templateUrl: './about-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog',
  },
})
export class AboutDialog {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);

  protected readonly translations = {
    about: computed(() => this.ngxSignalTranslate.translate('About')),
  };
}
