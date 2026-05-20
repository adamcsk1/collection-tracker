import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { CollectionListDataSourceRequest } from '../collection-model';
import { List } from '../list/list';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';

@Component({
  selector: 'ct-series-tracker',
  imports: [List],
  templateUrl: './series-tracker.html',
  styleUrl: '../collection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesTracker {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly api = inject(ApiService);

  protected readonly seriesTrackerDataSource = ({ offset, limit }: CollectionListDataSourceRequest) =>
    this.api.searchItems({ listType: 'series-tracker' }, offset, limit);
  protected readonly translations = {
    messageEmptySeriesTracker: computed(() => this.ngxSignalTranslate.translate('Message.EmptySeriesTracker')),
    messageAddFirstSeriesTracker: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstSeriesTracker')),
  };

  protected onAddSeriesTracker(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { seriesTracker: true });
  }
}
