import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { CollectionListDisplayRatingModel } from '@shared/models/collection-list-display-preferences-model';
import { getContrastColorHex } from '@shared/utils/get-contrast-color-hex-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { TagManagementColorPipe } from '../../../tag-management/tag-management-color-pipe';
import { mainStateToken } from '../../../main/main-store';
import { sharesStateToken } from '../../../shares/shares-store';
import { CollectionItemModel } from '../../collection-model';
import { collectionStateToken } from '../../collection-store';
import { ItemDialog } from '../../item-dialog/item-dialog';
import { AiSearchService } from '../../search/ai-search-service';
import { getProxyImageUrl } from '../../utils/proxy-image-url-util';

@Component({
  selector: 'ct-list-item',
  templateUrl: './list-item.html',
  styleUrl: './list-item.css',
  providers: [TagManagementColorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'card card-interactive',
    role: 'listitem',
    '[style.borderColor]': 'imageBorderColor()',
  },
})
export class ListItem {
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  private readonly apiState = inject(apiStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly sharesState = inject(sharesStateToken);
  private readonly tagManagementColorPipe = inject(TagManagementColorPipe);
  private readonly aiSearch = inject(AiSearchService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly watched = computed(() => this.collectionItem().tags.includes(WATCHED_TAG) ?? false);
  protected readonly favorite = computed(() => this.collectionItem().tags.includes(FAVORITE_TAG) ?? false);
  protected readonly imageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.collectionItem().image)
  );
  protected readonly movie = computed(() => this.collectionItem().tags.includes(MOVIE_TAG) ?? false);
  protected readonly series = computed(() => this.collectionItem().tags.includes(SERIES_TAG) ?? false);
  protected readonly imageBorderColor = computed(() =>
    this.tagManagementColorPipe.transform(this.collectionItem().tags, { checkUseForImageBorder: true })
  );
  protected readonly imageBadgeTag = computed(() =>
    this.collectionItem().tags.find((tag) => this.tagManagementColorPipe.transform(tag, { useForImageBadge: true }))
  );
  protected readonly tags = computed(() => {
    const imageBadgeTag = this.imageBadgeTag();
    return this.collectionItem().tags.filter(
      (tag) => ![WATCHED_TAG, FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, imageBadgeTag].includes(tag)
    );
  });
  protected readonly badgeBackgroundColor = computed(() => {
    const imageBadgeTag = this.imageBadgeTag();
    return imageBadgeTag ? this.tagManagementColorPipe.transform(imageBadgeTag, { useForImageBadge: true }) : null;
  });
  protected readonly badgeTextColor = computed(() => {
    const badgeBackgroundColor = this.badgeBackgroundColor();
    if (!badgeBackgroundColor) {
      return null;
    }

    return getContrastColorHex(badgeBackgroundColor);
  });
  protected readonly useAiSearch = this.aiSearch.useAiSearch.asReadonly();
  protected readonly listDisplayPreferences = this.mainState.state.collectionListDisplayPreferences;
  protected readonly selectedRating = computed(() => {
    const item = this.collectionItem();
    const preferences = this.listDisplayPreferences();
    const preferredRating = this.getRatingDisplayValue(preferences.preferredRating, item);
    if (preferredRating) return preferredRating;
    if (preferences.imdbRatingFallback && preferences.preferredRating !== 'imdb') {
      return this.getRatingDisplayValue('imdb', item);
    }

    return null;
  });
  protected readonly shared = computed(() => {
    const item = this.collectionItem();
    return this.sharesState.state.incoming().some((share) => share.ownerUserShareCode === item.ownerShareCode);
  });
  protected readonly translations = {
    favorite: computed(() => this.ngxSignalTranslate.translate('Favorite')),
    metacriticShort: computed(() => this.ngxSignalTranslate.translate('MetacriticShort')),
    rottenTomatoesShort: computed(() => this.ngxSignalTranslate.translate('RottenTomatoesShort')),
    shared: computed(() => this.ngxSignalTranslate.translate('Shared')),
  };
  protected readonly WATCHED_TAG = WATCHED_TAG;
  protected readonly MOVIE_TAG = MOVIE_TAG;
  protected readonly SERIES_TAG = SERIES_TAG;
  protected readonly VIRTUAL_UNWATCHED_TAG = VIRTUAL_UNWATCHED_TAG;
  public readonly collectionItem = input.required<CollectionItemModel>();

  private getRatingDisplayValue(
    rating: CollectionListDisplayRatingModel,
    item: CollectionItemModel
  ): { label: string; value: string | number; testId: string; icon: string } | null {
    switch (rating) {
      case 'imdb':
        return item.rate ? { label: '', value: item.rate, testId: 'list-item-rating-imdb', icon: 'star_rate' } : null;
      case 'rottenTomatoes':
        return item.rottenTomatoesRate
          ? {
              label: this.translations.rottenTomatoesShort(),
              value: item.rottenTomatoesRate,
              testId: 'list-item-rating-rotten-tomatoes',
              icon: 'star_rate',
            }
          : null;
      case 'metacritic':
        return item.metacriticRate
          ? {
              label: this.translations.metacriticShort(),
              value: item.metacriticRate,
              testId: 'list-item-rating-metacritic',
              icon: 'star_rate',
            }
          : null;
      case 'user':
        return item.userRate !== null
          ? { label: '', value: item.userRate, testId: 'list-item-user-rate', icon: 'person' }
          : null;
    }
  }

  protected onSetSearchText(searchValue: string | number | null, event?: Event): void {
    if (this.useAiSearch()) return;

    if (searchValue !== null) {
      event?.stopPropagation();
      this.collectionState.setState('forceStandardSearch', true);
      this.collectionState.setState('searchText', `${searchValue}`);
    }
  }

  protected onOpenDetail(): void {
    this.portal.open(ItemDialog, { collectionItem: this.collectionItem() });
  }
}
