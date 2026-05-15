import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { FAVORITE_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { CollectionListDataSourceRequest } from '../collection-model';
import { List } from '../list/list';

@Component({
  selector: 'ct-favorites',
  imports: [List],
  templateUrl: './favorites.html',
  styleUrl: '../collection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Favorites {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly api = inject(ApiService);

  protected readonly favoriteTag = FAVORITE_TAG;
  protected readonly favoritesDataSource = ({ offset, limit }: CollectionListDataSourceRequest) =>
    this.api.searchItems({ tags: [this.favoriteTag], tagMode: 'all', listType: 'library' }, offset, limit);
  protected readonly translations = {
    messageEmptyFavorites: computed(() => this.ngxSignalTranslate.translate('Message.EmptyFavorites')),
    messageAddFirstFavorite: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstFavorite')),
  };
}
