import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { GlobalWatchStatusService } from './global-watch-status-service';

@Component({
  selector: 'ct-settings-global-watch-status',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './global-watch-status.html',
  styleUrl: './global-watch-status.css',
  providers: [GlobalWatchStatusService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsGlobalWatchStatus {
  private readonly globalWatchStatus = inject(GlobalWatchStatusService);

  protected onMarkAllAsWatched(): void {
    this.globalWatchStatus.markAllAsWatched();
  }

  protected onMarkAllAsUnwatched(): void {
    this.globalWatchStatus.markAllAsUnwatched();
  }
}
