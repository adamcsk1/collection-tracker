import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Tabs } from '@components/tabs/tabs';
import type { TabOption } from '@components/tabs/tabs-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { CollectionMediaChips } from '../collection/media-chips/media-chips';
import { mainStateToken } from '../main/main-store';
import { StatisticsActivity } from './activity/statistics-activity';
import { StatisticsCollection } from './collection/statistics-collection';
import { initialStatisticsState, statisticsStateToken } from './statistics-store';

@Component({
  selector: 'ct-statistics',
  imports: [CollectionMediaChips, Tabs, StatisticsActivity, StatisticsCollection],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
  providers: [provideStore(initialStatisticsState, statisticsStateToken)],
  host: { class: 'page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statistics {
  protected readonly store = inject(statisticsStateToken);
  protected readonly featurePreferences = inject(mainStateToken).state.collectionFeaturePreferences;
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    statistics: computed(() => this.ngxSignalTranslate.translate('Statistics')),
    year: computed(() => this.ngxSignalTranslate.translate('Statistics.MyYear')),
    collection: computed(() => this.ngxSignalTranslate.translate('Statistics.Collection')),
  };
  protected readonly viewTabs = computed<readonly [TabOption<'year' | 'collection'>, TabOption<'year' | 'collection'>]>(
    () => [
      { value: 'year', label: this.translations.year(), dataTestId: 'statistics-year-view' },
      { value: 'collection', label: this.translations.collection(), dataTestId: 'statistics-collection-view' },
    ]
  );
}
