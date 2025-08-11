import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { appCollectionStateToken } from '@appCollectionStore';
import { memosStateToken } from '@services/memos/memos-store';
import { StatisticsItem } from '@statistics/statistics-item/statistics-item';
import { StatisticsGroupModel } from '@statistics/statistics-model';
import { sortWithTagPriority } from '@statistics/utils/sort-with-tag-priority-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-statistics',
  imports: [NgxSignalTranslatePipe, StatisticsItem, NgTemplateOutlet],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class Statistics {
  private readonly appCollectionState = inject(appCollectionStateToken);
  private readonly memosState = inject(memosStateToken);
  protected readonly memosLoadNetworkStatus = this.memosState.state.loadNetworkStatus;
  protected readonly statistics = computed(() => {
    const collection = this.appCollectionState.state.collection();
    const statistics: StatisticsGroupModel = {
      movies: [],
      series: [],
      global: [],
    };

    if (!collection.length) return statistics;

    for (const collectionItem of collection) {
      if (collectionItem.tags.includes('#movie')) {
        for (const tag of collectionItem.tags) {
          const existing = statistics.movies.find((item) => item.tag === tag);
          if (existing) existing.count++;
          else statistics.movies.push({ tag, count: 1 });
        }
      } else if (collectionItem.tags.includes('#series')) {
        for (const tag of collectionItem.tags) {
          const existing = statistics.series.find((item) => item.tag === tag);
          if (existing) existing.count++;
          else statistics.series.push({ tag, count: 1 });
        }
      }

      // Global statistics
      for (const tag of collectionItem.tags) {
        const existing = statistics.global.find((item) => item.tag === tag);
        if (existing) existing.count++;
        else statistics.global.push({ tag, count: 1 });
      }
    }

    statistics.movies.sort(sortWithTagPriority);
    statistics.series.sort(sortWithTagPriority);
    statistics.global.sort(sortWithTagPriority);

    return statistics;
  });
}
