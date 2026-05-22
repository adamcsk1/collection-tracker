import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, max, min, submit, validate } from '@angular/forms/signals';
import { Autocomplete } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { LinkButton } from '@components/link-button/link-button';
import { Select } from '@components/select/select';
import { Textarea } from '@components/textarea/textarea';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { FAVORITE_TAG, WATCH_LATER_TAG, WATCHED_TAG, WISHLIST_TAG } from '@shared/constants/tags-const';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import { CollectionItemChangeApiModel, SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom, map, mergeMap, of } from 'rxjs';
import { sharesStateToken } from '../../shares/shares-store';
import { CollectionItemModel } from '../collection-model';
import { CollectionService } from '../collection-service';
import { TagSuggestionService } from '../new-item-dialog/suggestion/tag-suggestion-service';
import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import {
  buildEpisodeProgressTag,
  filterEditableTags,
  invalidInternalCollectionTagValidation,
  parseEpisodeProgress,
  removeEpisodeProgressTags,
  typeTagValidation,
  virtualTagValidation,
} from '../validators/tag-validators';
import { getProxyImageUrl } from '../utils/proxy-image-url-util';
import { GenreSuggestionService } from './suggestion/genre-suggestion-service';

interface ItemDialogFormModel {
  title: string;
  IMDbId: string;
  year: CollectionItemYearModel;
  rate: string;
  userRate: number | null;
  image: string;
  genreText: string;
  tagsText: string;
  watchedUpToSeason: number | null;
  watchedUpToEpisode: number | null;
  actors: string;
  plot: string;
}

@Component({
  selector: 'ct-item-dialog',
  imports: [FormField, FormRoot, DialogShell, Autocomplete, Input, LinkButton, Select, Textarea],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.css',
  providers: [TagSuggestionService, GenreSuggestionService],
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialog implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly portal = inject(PortalService);
  private readonly sharesState = inject(sharesStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lastSavedItem = signal<CollectionItemChangeApiModel | null>(null);
  private readonly originalInternalTags = signal<string[]>([]);
  protected readonly translations = {
    titleCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.CollectionItem')),
    titleWatchLaterItem: computed(() => this.ngxSignalTranslate.translate('Title.WatchLaterItem')),
    titleWishlistItem: computed(() => this.ngxSignalTranslate.translate('Title.WishlistItem')),
    labelTitle: computed(() => this.ngxSignalTranslate.translate('Title')),
    labelIMDbId: computed(() => this.ngxSignalTranslate.translate('IMDbId')),
    labelYear: computed(() => this.ngxSignalTranslate.translate('Year')),
    labelIMDbRate: computed(() => this.ngxSignalTranslate.translate('IMDbRate')),
    labelUserRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    labelImageUrl: computed(() => this.ngxSignalTranslate.translate('ImageUrl')),
    altImageExample: computed(() => this.ngxSignalTranslate.translate('Alt.ImageExample')),
    genre: computed(() => this.ngxSignalTranslate.translate('Genre')),
    hintSeparateGenres: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateGenres')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    watchedUpTo: computed(() => this.ngxSignalTranslate.translate('WatchedUpTo')),
    labelWatchedUpToSeason: computed(() => this.ngxSignalTranslate.translate('WatchedUpTo.Season')),
    labelWatchedUpToEpisode: computed(() => this.ngxSignalTranslate.translate('WatchedUpTo.Episode')),
    hintWatchedUpToSeason: computed(() => this.ngxSignalTranslate.translate('Hint.WatchedUpToSeason')),
    hintWatchedUpToEpisode: computed(() => this.ngxSignalTranslate.translate('Hint.WatchedUpToEpisode')),
    hintSeparateTags: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateTags')),
    actors: computed(() => this.ngxSignalTranslate.translate('Actors')),
    plot: computed(() => this.ngxSignalTranslate.translate('Plot')),
    fallbackUnknownYear: computed(() => this.ngxSignalTranslate.translate('Fallback.UnknownYear')),
    fallbackNotAvailable: computed(() => this.ngxSignalTranslate.translate('Fallback.NotAvailable')),
    links: computed(() => this.ngxSignalTranslate.translate('Links')),
    linkYouTubeTrailer: computed(() => this.ngxSignalTranslate.translate('Link.YouTubeTrailer')),
    linkWebSearch: computed(() => this.ngxSignalTranslate.translate('Link.WebSearch')),
    readOnly: computed(() => this.ngxSignalTranslate.translate('ReadOnly')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    edit: computed(() => this.ngxSignalTranslate.translate('Edit')),
    markAsFavorite: computed(() => this.ngxSignalTranslate.translate('MarkAsFavorite')),
    markAsUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAsUnwatched')),
    markAsWatched: computed(() => this.ngxSignalTranslate.translate('MarkAsWatched')),
    manageSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    removeFavorite: computed(() => this.ngxSignalTranslate.translate('RemoveFavorite')),
    refreshSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('RefreshSeriesMetadata')),
    removeSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('RemoveSeriesMetadata')),
    delete: computed(() => this.ngxSignalTranslate.translate('Delete')),
    shared: computed(() => this.ngxSignalTranslate.translate('Shared')),
    validationRequired: computed(() => this.ngxSignalTranslate.translate('Validation.Required')),
    validationVirtualTag: computed(() => this.ngxSignalTranslate.translate('Toast.VirtualTagNotAllowed')),
    validationUsedInternalTag: computed(() => this.ngxSignalTranslate.translate('Toast.UsedInternalTag')),
    validationMissingTypeTag: computed(() => this.ngxSignalTranslate.translate('Toast.MissingTypeTag')),
    validationUserRate: computed(() => this.ngxSignalTranslate.translate('Validation.UserRate')),
  };
  protected readonly tagSuggestionService = inject(TagSuggestionService);
  protected readonly genreSuggestionService = inject(GenreSuggestionService);
  protected readonly formModel = signal<ItemDialogFormModel>({
    title: '',
    IMDbId: '',
    year: null,
    rate: '',
    userRate: null,
    image: '',
    genreText: '',
    tagsText: '',
    watchedUpToSeason: null,
    watchedUpToEpisode: null,
    actors: '',
    plot: '',
  });
  protected readonly form = form(
    this.formModel,
    (item) => {
      validate(item.title, ({ value }) => (value()?.trim() ? undefined : { kind: 'required' }));
      validate(item.IMDbId, ({ value }) => (value()?.trim() ? undefined : { kind: 'required' }));
      validate(item.tagsText, ({ value }) => {
        const tags = [...parseTagText(value()), ...this.originalInternalTags()];
        return virtualTagValidation(tags);
      });
      validate(item.tagsText, ({ value }) => {
        const tags = [...parseTagText(value()), ...this.originalInternalTags()];
        return invalidInternalCollectionTagValidation(tags);
      });
      validate(item.tagsText, ({ value }) => {
        const tags = [...parseTagText(value()), ...this.originalInternalTags()];
        return typeTagValidation(tags);
      });
      min(item.userRate, 0, { error: { kind: 'min' } });
      max(item.userRate, 10, { error: { kind: 'max' } });
      validate(item.userRate, ({ value }) => {
        const userRate = value();
        if (userRate === null) return undefined;
        return Math.abs(userRate * 10 - Math.round(userRate * 10)) <= 1e-9 ? undefined : { kind: 'userRate' };
      });
    },
    {
      submission: {
        action: async () => this.doSave(),
      },
    }
  );
  protected readonly formErrors = {
    title: {
      required: computed(() =>
        this.form
          .title()
          .errors()
          .some((error) => error.kind === 'required')
      ),
    },
    IMDbId: {
      required: computed(() =>
        this.form
          .IMDbId()
          .errors()
          .some((error) => error.kind === 'required')
      ),
    },
    tagsText: {
      virtualTag: computed(() =>
        this.form
          .tagsText()
          .errors()
          .some((error) => error.kind === 'virtualTag')
      ),
      invalidInternalCollectionTag: computed(() =>
        this.form
          .tagsText()
          .errors()
          .some((error) => error.kind === 'invalidInternalCollectionTag')
      ),
      missingTypeTag: computed(() =>
        this.form
          .tagsText()
          .errors()
          .some((error) => error.kind === 'missingTypeTag')
      ),
    },
    userRate: {
      min: computed(() =>
        this.form
          .userRate()
          .errors()
          .some((error) => error.kind === 'min')
      ),
      max: computed(() =>
        this.form
          .userRate()
          .errors()
          .some((error) => error.kind === 'max')
      ),
      userRate: computed(() =>
        this.form
          .userRate()
          .errors()
          .some((error) => error.kind === 'userRate')
      ),
    },
  };
  protected readonly genreText = computed(() => this.form.genreText().value());
  protected readonly tagsText = computed(() => this.form.tagsText().value());
  private readonly fallbackSeasonOptions = [
    { text: '-', value: null },
    ...Array.from({ length: MAX_SERIES_TRACKER_SEASONS }, (_, index) => ({ text: `${index + 1}`, value: index + 1 })),
  ];
  private readonly fallbackEpisodeOptions = [
    { text: '-', value: null },
    ...Array.from({ length: MAX_SERIES_TRACKER_EPISODES }, (_, index) => ({ text: `${index + 1}`, value: index + 1 })),
  ];
  protected readonly seriesSeasons = signal<SeriesTrackerSeasonMetadataModel[]>([]);
  protected readonly seasonOptions = computed(() => {
    const seasons = this.seriesSeasons();
    return seasons.length
      ? [{ text: '-', value: null }, ...seasons.map((season) => ({ text: `${season.season}`, value: season.season }))]
      : this.fallbackSeasonOptions;
  });
  protected readonly episodeOptions = computed(() => {
    const selectedSeason = this.form.watchedUpToSeason().value();
    const seasonMetadata = this.seriesSeasons().find((season) => season.season === selectedSeason);
    return seasonMetadata
      ? [
          { text: '-', value: null },
          ...Array.from({ length: seasonMetadata.episodes }, (_, index) => ({
            text: `${index + 1}`,
            value: index + 1,
          })),
        ]
      : this.fallbackEpisodeOptions;
  });
  protected readonly detailTags = computed(() => filterEditableTags(this.collectionItem().tags));
  protected readonly episodeProgress = computed(() => parseEpisodeProgress(this.collectionItem().tags));
  protected readonly episodeProgressText = computed(() => {
    const progress = this.episodeProgress();
    return progress
      ? `S${`${progress.season}`.padStart(2, '0')}E${`${progress.episode}`.padStart(2, '0')}`
      : this.translations.fallbackNotAvailable();
  });
  protected readonly editMode = signal(false);
  protected readonly posterImageFailed = signal(false);
  protected readonly isShared = computed(() => {
    const item = this.collectionItem();
    return this.sharesState.state.incoming().some((share) => share.ownerUserShareCode === item.ownerShareCode);
  });
  protected readonly isOwnItem = computed(() => {
    const ownerShareCode = this.collectionItem().ownerShareCode;
    return !ownerShareCode || ownerShareCode === this.sharesState.state.userShareCode();
  });
  protected readonly library = computed(() => {
    const item = this.collectionItem();
    for (const share of this.sharesState.state.incoming()) {
      if (share.ownerUserShareCode === item.ownerShareCode) {
        return `${share.ownerUsername ?? share.ownerUserShareCode}`;
      }
    }
    return '';
  });
  protected readonly permissionUpdate = computed(() => {
    const item = this.collectionItem();
    const share = this.sharesState.state
      .incoming()
      .find((incomingShare) => incomingShare.ownerUserShareCode === item.ownerShareCode);
    if (item.listType === 'series-tracker') return this.isOwnItem();
    if (item.listType !== 'library') return false;
    if (this.isOwnItem()) return true;
    return share?.canUpdate === true;
  });
  protected readonly libraryItem = computed(() => this.collectionItem().listType === 'library');
  protected readonly seriesTracker = computed(() => this.collectionItem().listType === 'series-tracker');
  protected readonly permissionDelete = computed(() => {
    const item = this.collectionItem();
    const share = this.sharesState.state
      .incoming()
      .find((incomingShare) => incomingShare.ownerUserShareCode === item.ownerShareCode);
    if (this.isOwnItem()) return true;
    return share?.canDelete === true;
  });
  protected readonly watched = computed(() => this.collectionItem().tags.includes(WATCHED_TAG));
  protected readonly favorite = computed(() => this.collectionItem().tags.includes(FAVORITE_TAG));
  protected readonly watchLater = computed(() => this.collectionItem().listType === 'watch-later');
  protected readonly wishlist = computed(() => this.collectionItem().listType === 'wishlist');
  protected readonly internalCollectionTag = computed(() => {
    if (this.watchLater()) return WATCH_LATER_TAG;
    if (this.wishlist()) return WISHLIST_TAG;
    return null;
  });
  protected readonly dialogTitle = computed(() =>
    this.watchLater()
      ? this.translations.titleWatchLaterItem()
      : this.wishlist()
        ? this.translations.titleWishlistItem()
        : this.translations.titleCollectionItem()
  );
  protected readonly draftImageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.form.image().value())
  );
  protected readonly imageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.collectionItem().image)
  );
  protected readonly trailerUrl = computed(() => {
    const item = this.collectionItem();
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} ${item.year ?? ''} trailer`.trim())}`;
  });
  protected readonly imdbUrl = computed(() => `https://www.imdb.com/title/${this.collectionItem().IMDbId}/`);
  protected readonly webSearchUrl = computed(() => {
    const item = this.collectionItem();
    return `https://duckduckgo.com/?q=${encodeURIComponent(`${item.title} ${item.year ?? ''}`.trim())}`;
  });
  public readonly collectionItem = model.required<CollectionItemModel>();

  public ngOnInit(): void {
    this.resetFormFromItem(this.collectionItem());
    this.loadSeriesSeasons();
  }

  private loadSeriesSeasons(): void {
    if (!this.seriesTracker() || !this.isOwnItem()) return;
    this.api
      .getSeriesTrackerSeasons(this.collectionItem().IMDbId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.setSeriesSeasons(response.seasons));
  }

  private setSeriesSeasons(seasons: SeriesTrackerSeasonMetadataModel[]): void {
    this.seriesSeasons.set(seasons);
    this.normalizeWatchedUpToSelection();
  }

  private normalizeWatchedUpToSelection(): void {
    const selectedSeason = this.form.watchedUpToSeason().value();
    const selectedEpisode = this.form.watchedUpToEpisode().value();
    if (selectedSeason === null) {
      if (selectedEpisode !== null) this.form.watchedUpToEpisode().value.set(null);
      return;
    }

    const seasonMetadata = this.seriesSeasons().find((season) => season.season === selectedSeason);
    if (!seasonMetadata) return;
    if (selectedEpisode !== null && selectedEpisode > seasonMetadata.episodes) {
      this.form.watchedUpToEpisode().value.set(null);
    }
  }

  private resetFormFromItem(item: CollectionItemModel): void {
    const change = toCollectionItemChange(item);
    const episodeProgress = parseEpisodeProgress(change.tags);
    const internalTags = change.tags.filter((tag) => tag === WATCH_LATER_TAG || tag === WISHLIST_TAG);
    this.originalInternalTags.set(internalTags);
    this.form().reset({
      title: change.title,
      IMDbId: change.IMDbId,
      year: change.year,
      rate: change.rate,
      userRate: change.userRate,
      image: change.image,
      genreText: change.genre.join(', '),
      tagsText: filterEditableTags(change.tags).join(' '),
      watchedUpToSeason: episodeProgress?.season ?? null,
      watchedUpToEpisode: episodeProgress?.episode ?? null,
      actors: change.actors,
      plot: change.plot,
    });
    this.lastSavedItem.set(change);
  }

  private buildItemFromForm(): CollectionItemChangeApiModel {
    this.normalizeWatchedUpToSelection();
    const formValues = this.form().value();
    let tags = [...parseTagText(formValues.tagsText), ...this.originalInternalTags()];
    tags = removeEpisodeProgressTags(tags);
    if (this.seriesTracker() && formValues.watchedUpToSeason !== null && formValues.watchedUpToEpisode !== null) {
      tags = [...tags, buildEpisodeProgressTag(formValues.watchedUpToSeason, formValues.watchedUpToEpisode)];
    }
    const internalCollectionTag = this.internalCollectionTag();
    if (internalCollectionTag && !tags.includes(internalCollectionTag)) {
      tags = [...tags, internalCollectionTag];
    }
    return {
      title: formValues.title,
      IMDbId: formValues.IMDbId,
      year: formValues.year,
      rate: formValues.rate,
      userRate: formValues.userRate,
      image: formValues.image,
      genre: parseGenreText(formValues.genreText),
      tags,
      actors: formValues.actors,
      plot: formValues.plot,
    };
  }

  protected onDelete(): void {
    const ownerShareCode = this.collectionItem().ownerShareCode;
    const listType = this.collectionItem().listType === 'library' ? undefined : this.collectionItem().listType;
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Delete', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            const deleteRequest = listType
              ? this.api.delete(this.collectionItem().IMDbId, this.collectionItem().hash, ownerShareCode, listType)
              : this.api.delete(this.collectionItem().IMDbId, this.collectionItem().hash, ownerShareCode);
            return deleteRequest.pipe(map(() => confirmed));
          } else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.DeleteItem'));
          if (listType)
            this.collectionService.deleteCollectionItem(this.collectionItem().IMDbId, ownerShareCode, listType);
          else this.collectionService.deleteCollectionItem(this.collectionItem().IMDbId, ownerShareCode);
          this.collectionService.triggerReload();
          this.portal.close();
        }
      });
  }

  protected onEdit(): void {
    this.editMode.set(true);
  }

  protected onReadOnly(): void {
    const lastSavedItem = this.lastSavedItem();
    if (lastSavedItem) {
      const episodeProgress = parseEpisodeProgress(lastSavedItem.tags);
      this.form().reset({
        title: lastSavedItem.title,
        IMDbId: lastSavedItem.IMDbId,
        year: lastSavedItem.year,
        rate: lastSavedItem.rate,
        userRate: lastSavedItem.userRate,
        image: lastSavedItem.image,
        genreText: lastSavedItem.genre.join(', '),
        tagsText: filterEditableTags(lastSavedItem.tags).join(' '),
        watchedUpToSeason: episodeProgress?.season ?? null,
        watchedUpToEpisode: episodeProgress?.episode ?? null,
        actors: lastSavedItem.actors,
        plot: lastSavedItem.plot,
      });
    }
    this.editMode.set(false);
  }

  protected onPosterImageError(): void {
    this.posterImageFailed.set(true);
  }

  protected async onSaveChanges(): Promise<void> {
    if (this.collectionItem().listType !== 'library' && this.collectionItem().listType !== 'series-tracker') return;
    await submit(this.form);
  }

  private async doSave(): Promise<void> {
    const item = this.buildItemFromForm();
    const ownerShareCode = this.collectionItem().ownerShareCode;
    const confirmed = await firstValueFrom(
      this.confirm
        .open(this.ngxSignalTranslate.translate('Confirm.Change', { name: this.collectionItem().title }))
        .pipe(
          mergeMap((confirmed) => {
            if (confirmed) {
              const updateRequest = this.seriesTracker()
                ? this.api.update(
                    this.collectionItem().IMDbId,
                    item,
                    this.collectionItem().hash,
                    ownerShareCode,
                    'series-tracker'
                  )
                : this.api.update(this.collectionItem().IMDbId, item, this.collectionItem().hash, ownerShareCode);
              return updateRequest.pipe(map((result) => ({ confirmed, item: result.item })));
            } else return of({ confirmed, item: null });
          })
        )
    );
    if (confirmed.confirmed && confirmed.item) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
      this.collectionService.updateCollectionItem(this.collectionItem().IMDbId, confirmed.item, ownerShareCode);
      this.collectionService.triggerReload();
      this.collectionItem.set(confirmed.item);
      this.lastSavedItem.set(toCollectionItemChange(confirmed.item));
      this.posterImageFailed.set(false);
      this.onReadOnly();
    }
  }

  protected async onMarkAsWatched(): Promise<void> {
    if (this.internalCollectionTag()) return;
    const tags = parseTagText(this.form.tagsText().value());
    if (tags.includes(WATCHED_TAG)) return;
    this.form.tagsText().value.set([...tags, WATCHED_TAG].join(' '));
    await this.onSaveChanges();
  }

  protected async onMarkAsUnwatched(): Promise<void> {
    const tags = parseTagText(this.form.tagsText().value());
    this.form.tagsText().value.set(tags.filter((tag) => tag !== WATCHED_TAG).join(' '));
    await this.onSaveChanges();
  }

  protected async onMarkAsFavorite(): Promise<void> {
    if (this.internalCollectionTag()) return;
    const tags = parseTagText(this.form.tagsText().value());
    if (tags.includes(FAVORITE_TAG)) return;
    this.form.tagsText().value.set([...tags, FAVORITE_TAG].join(' '));
    await this.onSaveChanges();
  }

  protected async onRemoveFavorite(): Promise<void> {
    const tags = parseTagText(this.form.tagsText().value());
    this.form.tagsText().value.set(tags.filter((tag) => tag !== FAVORITE_TAG).join(' '));
    await this.onSaveChanges();
  }

  protected onRefreshSeriesMetadata(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.RefreshSeriesMetadata'))
      .pipe(
        mergeMap((confirmed) =>
          confirmed
            ? this.api
                .refreshSeriesTrackerSeasons(this.collectionItem().IMDbId)
                .pipe(map((result) => ({ confirmed, result })))
            : of({ confirmed, result: null })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ confirmed, result }) => {
        if (!confirmed || !result) return;
        this.setSeriesSeasons(result.seasons);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataRefreshed'));
      });
  }

  protected onRemoveSeriesMetadata(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.RemoveSeriesMetadata'))
      .pipe(
        mergeMap((confirmed) =>
          confirmed
            ? this.api
                .deleteSeriesTrackerSeasons(this.collectionItem().IMDbId)
                .pipe(map((result) => ({ confirmed, result })))
            : of({ confirmed, result: null })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ confirmed, result }) => {
        if (!confirmed || !result) return;
        this.setSeriesSeasons(result.seasons);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataDeleted'));
      });
  }

  protected onManageSeriesMetadata(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    const collectionItem = this.collectionItem();
    this.portal.open(SeriesSeasonMetadataDialog, {
      imdbId: collectionItem.IMDbId,
      initialSeasons: this.seriesSeasons(),
      saved: (seasons: SeriesTrackerSeasonMetadataModel[]) => this.setSeriesSeasons(seasons),
      closed: () => this.portal.open(ItemDialog, { collectionItem }),
    });
  }
}
