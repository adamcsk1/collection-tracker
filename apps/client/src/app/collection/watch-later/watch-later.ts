import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { CollectionListDataSourceRequest } from '../collection-model';
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
  private readonly api = inject(ApiService);

  protected readonly watchLaterDataSource = ({ offset, limit }: CollectionListDataSourceRequest) =>
    this.api.searchItems({ listType: 'watch-later' }, offset, limit);
  protected readonly translations = {
    messageEmptyWatchLater: computed(() => this.ngxSignalTranslate.translate('Message.EmptyWatchLater')),
    messageAddFirstWatchLater: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstWatchLater')),
  };

  protected onAddWatchLater(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { watchLater: true });
  }
}
