import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FAVORITE_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
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

  protected readonly favoriteTag = FAVORITE_TAG;
  protected readonly translations = {
    messageEmptyFavorites: computed(() => this.ngxSignalTranslate.translate('Message.EmptyFavorites')),
    messageAddFirstFavorite: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstFavorite')),
  };
}
