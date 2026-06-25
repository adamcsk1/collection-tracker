import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { map } from 'rxjs';
import { CollectionListDataSourceRequest } from '../../collection-model';
import { List } from '../../list/list';
import { buildCollectionRouteFilterKey, buildCollectionRouteFilters } from '../../utils/collection-search-filter-util';

@Component({
  selector: 'ct-favorites',
  imports: [List],
  templateUrl: './favorites.html',
  styleUrl: '../../collection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Favorites {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly queryFilters = toSignal(
    this.route.queryParamMap.pipe(map((queryParamMap) => buildCollectionRouteFilters(queryParamMap))),
    {
      initialValue: buildCollectionRouteFilters({
        get: (name) => `${this.route.snapshot.queryParams[name] ?? ''}` || null,
      }),
    }
  );
  protected readonly queryFilterKey = computed(() => buildCollectionRouteFilterKey(this.queryFilters()));

  protected readonly favoritesDataSource = ({
    offset,
    limit,
    orderBy,
    orderDirection,
  }: CollectionListDataSourceRequest) => {
    const queryFilters = this.queryFilters();
    return this.api.searchItems(
      { ...queryFilters, favorite: true, listType: 'library', orderBy, orderDirection },
      offset,
      limit
    );
  };
  protected readonly translations = {
    messageEmptyFavorites: computed(() => this.ngxSignalTranslate.translate('Message.EmptyFavorites')),
    messageAddFirstFavorite: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstFavorite')),
  };
}
