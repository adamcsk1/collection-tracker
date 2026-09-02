import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { apiStateToken } from '@services/api/api-store';
import { CollectionListDisplayRatingModel } from '@shared/models/collection-list-display-preferences-model';
import { getContrastColorHex } from '@shared/utils/get-contrast-color-hex-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../../main/main-store';
import { sharesStateToken } from '../../../shares/shares-store';
import { TagManagementColorPipe } from '../../../tag-management/tag-management-color-pipe';
import { CollectionItemModel } from '../../collection-model';
import { collectionStateToken } from '../../collection-store';
import { setCollectionItemQuery } from '../../utils/collection-item-route-util';
import { getProxyImageUrl } from '@shared/utils/proxy-image-url-util';
import { ListItemCard } from '../list-item-card/list-item-card';
import { ListItemCardRatingModel } from '../list-item-card/list-item-card-model';

@Component({
  selector: 'ct-list-item',
  imports: [ListItemCard],
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
  private readonly router = inject(Router);
  private readonly apiState = inject(apiStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly sharesState = inject(sharesStateToken);
  private readonly tagManagementColorPipe = inject(TagManagementColorPipe);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly trackingCompleted = computed(() => {
    const item = this.collectionItem();
    return item.listType === 'tracking' && item.watchedAt !== null;
  });
  protected readonly favorite = computed(() => this.collectionItem().favorite);
  protected readonly imageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.collectionItem().image)
  );
  protected readonly movie = computed(() => this.collectionItem().contentType === 'movie');
  protected readonly series = computed(() => this.collectionItem().contentType === 'series');
  protected readonly watchedStyle = computed(() => this.trackingCompleted());
  protected readonly imageBorderColor = computed(() => {
    if (this.watchedStyle()) return;
    return this.tagManagementColorPipe.transform(this.collectionItem().tags, { checkUseForImageBorder: true });
  });
  protected readonly imageBadgeTag = computed(() => {
    if (this.watchedStyle()) return null;
    return (
      this.collectionItem().tags.find((tag) =>
        this.tagManagementColorPipe.transform(tag, { useForImageBadge: true })
      ) ?? null
    );
  });
  protected readonly tags = computed(() => {
    const imageBadgeTag = this.imageBadgeTag();
    return this.collectionItem().tags.filter((tag) => tag !== imageBadgeTag);
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
  protected readonly aiFilterActive = computed(
    () => !!this.collectionState.state.aiSearchPromptText().trim() && !this.collectionState.state.forceStandardSearch()
  );
  protected readonly imageBadgeDisabled = computed(() => this.aiFilterActive());
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
    completed: computed(() => this.ngxSignalTranslate.translate('Completed')),
    favorite: computed(() => this.ngxSignalTranslate.translate('Favorite')),
    metacriticShort: computed(() => this.ngxSignalTranslate.translate('MetacriticShort')),
    rottenTomatoesShort: computed(() => this.ngxSignalTranslate.translate('RottenTomatoesShort')),
    shared: computed(() => this.ngxSignalTranslate.translate('Shared')),
  };
  public readonly collectionItem = input.required<CollectionItemModel>();

  protected readonly progressText = computed(() => {
    const item = this.collectionItem();
    if (item.listType !== 'tracking' || (item.contentType !== 'book' && item.contentType !== 'album')) return null;
    const current = item.progressCurrent;
    const total = item.progressTotal;
    if (current == null && total == null) return null;
    if (current != null && total != null) return `${current} / ${total}`;
    if (current != null) return `${current}`;
    return `${total}`;
  });
  protected readonly itemMeta = computed(() => {
    const item = this.collectionItem();
    const year = this.listDisplayPreferences().showYear && item.year ? item.year : null;
    const progress = this.progressText();
    if (year && progress) return `${year} · ${progress}`;
    return progress ?? year;
  });
  protected readonly itemMetaTestId = computed(() => (this.progressText() ? 'list-item-progress' : 'list-item-year'));

  private getRatingDisplayValue(
    rating: CollectionListDisplayRatingModel,
    item: CollectionItemModel
  ): ListItemCardRatingModel | null {
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
    event?.stopPropagation();
    event?.preventDefault();
    if (this.aiFilterActive()) return;

    if (searchValue !== null) {
      this.collectionState.setState('aiSearchPromptText', '');
      this.collectionState.setState('forceStandardSearch', true);
      this.collectionState.setState('searchText', `${searchValue}`);
    }
  }

  protected onOpenDetail(): void {
    setCollectionItemQuery(this.router, this.collectionItem());
  }
}
