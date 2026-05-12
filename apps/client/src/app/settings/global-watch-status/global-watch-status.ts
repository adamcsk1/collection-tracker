import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { GlobalWatchStatusService } from './global-watch-status-service';

@Component({
  selector: 'ct-settings-global-watch-status',
  templateUrl: './global-watch-status.html',
  styleUrl: './global-watch-status.css',
  providers: [GlobalWatchStatusService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsGlobalWatchStatus {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly globalWatchStatus = inject(GlobalWatchStatusService);

  protected readonly translations = {
    messageGlobalWatchStatus: computed(() => this.ngxSignalTranslate.translate('Message.GlobalWatchStatus')),
    markAllAsWatched: computed(() => this.ngxSignalTranslate.translate('MarkAllAsWatched')),
    markAllAsUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAllAsUnwatched')),
  };
  protected onMarkAllAsWatched(): void {
    this.globalWatchStatus.markAllAsWatched();
  }

  protected onMarkAllAsUnwatched(): void {
    this.globalWatchStatus.markAllAsUnwatched();
  }
}
