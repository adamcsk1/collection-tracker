import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { MOVIE_TAG, SERIES_TAG, VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { getContrastColorHex } from '@shared/utils/get-contrast-color-hex-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { sharesStateToken } from '../../../shares/shares-store';
import { TagConfigColorPipe } from '../../../settings/tag-configs/tag-configs-color-pipe';
import { CollectionItemModel } from '../../collection-model';
import { collectionStateToken } from '../../collection-store';
import { ItemDialog } from '../../item-dialog/item-dialog';
import { AiSearchService } from '../../search/ai-search-service';
import { getProxyImageUrl } from '../../utils/proxy-image-url-util';

@Component({
  selector: 'ct-list-item',
  templateUrl: './list-item.html',
  styleUrl: './list-item.css',
  providers: [TagConfigColorPipe],
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
  private readonly sharesState = inject(sharesStateToken);
  private readonly tagConfigColorPipe = inject(TagConfigColorPipe);
  private readonly aiSearch = inject(AiSearchService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly watched = computed(() => this.collectionItem().tags.includes(WATCHED_TAG) ?? false);
  protected readonly imageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.collectionItem().image)
  );
  protected readonly movie = computed(() => this.collectionItem().tags.includes(MOVIE_TAG) ?? false);
  protected readonly series = computed(() => this.collectionItem().tags.includes(SERIES_TAG) ?? false);
  protected readonly imageBorderColor = computed(() =>
    this.tagConfigColorPipe.transform(this.collectionItem().tags, { checkUseForImageBorder: true })
  );
  protected readonly imageBadgeTag = computed(() =>
    this.collectionItem().tags.find((tag) => this.tagConfigColorPipe.transform(tag, { useForImageBadge: true }))
  );
  protected readonly tags = computed(() => {
    const imageBadgeTag = this.imageBadgeTag();
    return this.collectionItem().tags.filter(
      (tag) => ![WATCHED_TAG, MOVIE_TAG, SERIES_TAG, imageBadgeTag].includes(tag)
    );
  });
  protected readonly badgeBackgroundColor = computed(() => {
    const imageBadgeTag = this.imageBadgeTag();
    return imageBadgeTag ? this.tagConfigColorPipe.transform(imageBadgeTag, { useForImageBadge: true }) : null;
  });
  protected readonly badgeTextColor = computed(() => {
    const badgeBackgroundColor = this.badgeBackgroundColor();
    if (!badgeBackgroundColor) {
      return null;
    }

    return getContrastColorHex(badgeBackgroundColor);
  });
  protected readonly useAiSearch = this.aiSearch.useAiSearch.asReadonly();
  protected readonly isShared = computed(() => {
    const item = this.collectionItem();
    return this.sharesState.state.incoming().some((share) => share.ownerUserShareCode === item.ownerShareCode);
  });
  protected readonly translations = {
    shared: computed(() => this.ngxSignalTranslate.translate('Shared')),
  };
  protected readonly WATCHED_TAG = WATCHED_TAG;
  protected readonly MOVIE_TAG = MOVIE_TAG;
  protected readonly SERIES_TAG = SERIES_TAG;
  protected readonly VIRTUAL_UNWATCHED_TAG = VIRTUAL_UNWATCHED_TAG;
  public readonly collectionItem = input.required<CollectionItemModel>();

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
