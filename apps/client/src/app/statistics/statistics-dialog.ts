import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { Statistics } from './statistics';

@Component({
  selector: 'ct-statistics-dialog',
  imports: [DialogShell, Statistics],
  templateUrl: './statistics-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog',
  },
})
export class StatisticsDialog {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);

  protected readonly translations = {
    statistics: computed(() => this.ngxSignalTranslate.translate('Statistics')),
  };
}
