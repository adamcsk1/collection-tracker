import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PortalService } from '@services/portal-service';
import { WATCH_LATER_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { List } from '../list/list';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';

@Component({
  selector: 'ct-watch-later',
  imports: [List],
  templateUrl: './watch-later.html',
  styleUrl: '../collection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchLater {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);

  protected readonly watchLaterTag = WATCH_LATER_TAG;
  protected readonly translations = {
    messageEmptyWatchLater: computed(() => this.ngxSignalTranslate.translate('Message.EmptyWatchLater')),
    messageAddFirstWatchLater: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstWatchLater')),
  };

  protected onAddWatchLater(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { watchLater: true });
  }
}
