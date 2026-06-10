import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, max, min, submit, validate } from '@angular/forms/signals';
import { Autocomplete } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { LinkButton } from '@components/link-button/link-button';
import { Textarea } from '@components/textarea/textarea';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import {
  COMPLETED_TAG,
  FAVORITE_TAG,
  MOVIE_TAG,
  SERIES_TAG,
  WATCH_LATER_TAG,
  WATCHED_TAG,
  WISHLIST_TAG,
} from '@shared/constants/tags-const';
import {
  CollectionItemChangeApiModel,
  SeriesTrackerSeasonMetadataModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';
import { CollectionItemYearModel } from '@shared/models/collection-item-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, firstValueFrom, map, mergeMap, of, tap, throwError } from 'rxjs';
import { sharesStateToken } from '../../shares/shares-store';
import { CollectionItemModel } from '../collection-model';
import { CollectionService } from '../collection-service';
import { TagSuggestionService } from '../new-item-dialog/suggestion/tag-suggestion-service';
import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { WatchedEpisodesDialog } from '../watched-episodes-dialog/watched-episodes-dialog';
import { getProxyImageUrl } from '../utils/proxy-image-url-util';
import { formatSeriesTrackerEpisode } from '../utils/series-tracker-progress-util';
import {
  filterDisplayTags,
  filterEditorPreservedTags,
  filterEditableTags,
  invalidInternalCollectionTagValidation,
  serverManagedTagValidation,
  typeTagValidation,
  userActionTagValidation,
  virtualTagValidation,
} from '../validators/tag-validators';
import { GenreSuggestionService } from './suggestion/genre-suggestion-service';

interface ItemDialogFormModel {
  title: string;
  IMDbId: string;
  year: CollectionItemYearModel;
  rate: string;
  rottenTomatoesRate: string;
  metacriticRate: string;
  userRate: number | null;
  image: string;
  genreText: string;
  tagsText: string;
  actors: string;
  plot: string;
}

@Component({
  selector: 'ct-item-dialog',
  imports: [FormField, FormRoot, DialogShell, Autocomplete, Input, LinkButton, Textarea],
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
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
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
    labelMetacriticRate: computed(() => this.ngxSignalTranslate.translate('Metacritic')),
    labelRottenTomatoesRate: computed(() => this.ngxSignalTranslate.translate('RottenTomatoes')),
    labelUserRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    labelImageUrl: computed(() => this.ngxSignalTranslate.translate('ImageUrl')),
    altImageExample: computed(() => this.ngxSignalTranslate.translate('Alt.ImageExample')),
    altPoster: computed(() => this.ngxSignalTranslate.translate('Alt.Poster', { title: this.collectionItem().title })),
    genre: computed(() => this.ngxSignalTranslate.translate('Genre')),
    hintSeparateGenres: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateGenres')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    systemTags: computed(() => this.ngxSignalTranslate.translate('SystemTags')),
    watchedUpTo: computed(() => this.ngxSignalTranslate.translate('WatchedUpTo')),
    manageWatchedEpisodes: computed(() => this.ngxSignalTranslate.translate('ManageWatchedEpisodes')),
    markAllEpisodesWatched: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesWatched')),
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
    ratings: computed(() => this.ngxSignalTranslate.translate('Ratings')),
  };
  protected readonly tagSuggestionService = inject(TagSuggestionService);
  protected readonly genreSuggestionService = inject(GenreSuggestionService);
  protected readonly formModel = signal<ItemDialogFormModel>({
    title: '',
    IMDbId: '',
    year: null,
    rate: '',
    rottenTomatoesRate: '',
    metacriticRate: '',
    userRate: null,
    image: '',
    genreText: '',
    tagsText: '',
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
        return serverManagedTagValidation(tags);
      });
      validate(item.tagsText, ({ value }) => {
        const tags = [...parseTagText(value()), ...this.originalInternalTags()];
        return userActionTagValidation(tags);
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
      usedInternalTag: computed(() =>
        this.form
          .tagsText()
          .errors()
          .some((error) => error.kind === 'usedInternalTag')
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
  protected readonly seriesSeasons = signal<SeriesTrackerSeasonMetadataModel[]>([]);
  protected readonly watchedEpisodes = signal<SeriesTrackerWatchedEpisodeModel[]>([]);
  protected readonly lastWatchedEpisode = computed(() => {
    const episodes = this.watchedEpisodes();
    if (!episodes.length) return null;
    const last = episodes[episodes.length - 1];
    return { season: last.season, episode: last.episode };
  });
  protected readonly detailTags = computed(() =>
    filterDisplayTags(this.collectionItem().tags).filter((tag) => !this.isSystemDisplayTag(tag))
  );
  protected readonly systemTags = computed(() =>
    filterDisplayTags(this.collectionItem().tags).filter((tag) => this.isSystemDisplayTag(tag))
  );
  protected readonly episodeProgressText = computed(() => {
    return formatSeriesTrackerEpisode(this.lastWatchedEpisode()) ?? this.translations.fallbackNotAvailable();
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
  protected readonly hasInternalCollectionTag = computed(() => {
    const tags = this.collectionItem().tags;
    return tags.includes(WATCH_LATER_TAG) || tags.includes(WISHLIST_TAG);
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
    this.loadWatchedEpisodes();
  }

  private loadSeriesSeasons(): void {
    if (!this.seriesTracker() || !this.isOwnItem()) return;
    this.api
      .getSeriesTrackerSeasons(this.collectionItem().IMDbId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.seriesSeasons.set(response.seasons));
  }

  private loadWatchedEpisodes(): void {
    if (!this.seriesTracker() || !this.isOwnItem()) return;
    this.api
      .getSeriesTrackerWatchedEpisodes(this.collectionItem().IMDbId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.watchedEpisodes.set(response.watchedEpisodes));
  }

  private resetFormFromItem(item: CollectionItemModel): void {
    const change = toCollectionItemChange(item);
    const internalTags = change.tags.filter((tag) => tag === WATCH_LATER_TAG || tag === WISHLIST_TAG);
    this.originalInternalTags.set(internalTags);
    this.form().reset({
      title: change.title,
      IMDbId: change.IMDbId,
      year: change.year,
      rate: change.rate,
      rottenTomatoesRate: change.rottenTomatoesRate,
      metacriticRate: change.metacriticRate,
      userRate: change.userRate,
      image: change.image,
      genreText: change.genre.join(', '),
      tagsText: filterEditableTags(change.tags).join(' '),
      actors: change.actors,
      plot: change.plot,
    });
    this.lastSavedItem.set(change);
  }

  private applySyncedCollectionItem(item: CollectionItemModel | undefined): void {
    if (!item) return;
    const currentItem = this.collectionItem();
    this.collectionService.updateCollectionItem(currentItem.IMDbId, item, currentItem.ownerShareCode);
    this.collectionItem.set(item);
    this.resetFormFromItem(item);
    this.posterImageFailed.set(false);
  }

  private buildItemFromForm(): CollectionItemChangeApiModel {
    const formValues = this.form().value();
    let tags = [...parseTagText(formValues.tagsText), ...filterEditorPreservedTags(this.collectionItem().tags)];
    const internalCollectionTag = this.internalCollectionTag();
    if (internalCollectionTag && !tags.includes(internalCollectionTag)) {
      tags = [...tags, internalCollectionTag];
    }
    const imdbIdChanged = formValues.IMDbId !== this.collectionItem().IMDbId;
    return {
      title: formValues.title,
      IMDbId: formValues.IMDbId,
      year: formValues.year,
      rate: formValues.rate,
      rottenTomatoesRate: imdbIdChanged ? '' : formValues.rottenTomatoesRate,
      metacriticRate: imdbIdChanged ? '' : formValues.metacriticRate,
      userRate: formValues.userRate,
      image: formValues.image,
      genre: parseGenreText(formValues.genreText),
      tags,
      actors: formValues.actors,
      plot: formValues.plot,
    };
  }

  private buildItemWithUpdatedTags(tagsToAdd: string[], tagsToRemove: string[]): CollectionItemChangeApiModel {
    const item = this.buildItemFromForm();
    item.tags = [...item.tags.filter((tag) => !tagsToRemove.includes(tag)), ...tagsToAdd].filter(
      (tag, index, tags) => tags.indexOf(tag) === index
    );
    return item;
  }

  protected isSystemDisplayTag(tag: string): boolean {
    return [WATCHED_TAG, FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, COMPLETED_TAG].includes(tag);
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
      this.form().reset({
        title: lastSavedItem.title,
        IMDbId: lastSavedItem.IMDbId,
        year: lastSavedItem.year,
        rate: lastSavedItem.rate,
        rottenTomatoesRate: lastSavedItem.rottenTomatoesRate,
        metacriticRate: lastSavedItem.metacriticRate,
        userRate: lastSavedItem.userRate,
        image: lastSavedItem.image,
        genreText: lastSavedItem.genre.join(', '),
        tagsText: filterEditableTags(lastSavedItem.tags).join(' '),
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

  private async doSave(item = this.buildItemFromForm()): Promise<void> {
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
    if (this.internalCollectionTag() || this.hasInternalCollectionTag()) return;
    if (this.collectionItem().tags.includes(WATCHED_TAG)) return;
    await this.doSave(this.buildItemWithUpdatedTags([WATCHED_TAG], []));
  }

  protected async onMarkAsUnwatched(): Promise<void> {
    await this.doSave(this.buildItemWithUpdatedTags([], [WATCHED_TAG]));
  }

  protected async onMarkAsFavorite(): Promise<void> {
    if (this.internalCollectionTag() || this.hasInternalCollectionTag()) return;
    if (this.collectionItem().tags.includes(FAVORITE_TAG)) return;
    await this.doSave(this.buildItemWithUpdatedTags([FAVORITE_TAG], []));
  }

  protected async onRemoveFavorite(): Promise<void> {
    await this.doSave(this.buildItemWithUpdatedTags([], [FAVORITE_TAG]));
  }

  protected onRefreshSeriesMetadata(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.RefreshSeriesMetadata'))
      .pipe(
        mergeMap((confirmed) => {
          if (!confirmed) return of({ confirmed, result: null });
          this.spinnerLoadingState.setState('show', true);
          return this.api.refreshSeriesTrackerSeasons(this.collectionItem().IMDbId).pipe(
            map((result) => ({ confirmed, result })),
            tap(() => this.spinnerLoadingState.setState('show', false)),
            catchError((error) => {
              this.spinnerLoadingState.setState('show', false);
              return throwError(() => error);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ confirmed, result }) => {
        if (!confirmed || !result) return;
        this.seriesSeasons.set(result.seasons);
        this.applySyncedCollectionItem(result.item);
        this.collectionService.triggerReload();
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
        this.seriesSeasons.set(result.seasons);
        this.applySyncedCollectionItem(result.item);
        this.collectionService.triggerReload();
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataDeleted'));
      });
  }

  protected onManageSeriesMetadata(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    let collectionItem = this.collectionItem();
    this.portal.open(SeriesSeasonMetadataDialog, {
      imdbId: collectionItem.IMDbId,
      initialSeasons: this.seriesSeasons(),
      saved: (seasons: SeriesTrackerSeasonMetadataModel[], item?: CollectionItemModel) => {
        this.seriesSeasons.set(seasons);
        if (item) {
          collectionItem = item;
          this.applySyncedCollectionItem(item);
        }
        this.collectionService.triggerReload();
      },
      closed: () => this.portal.open(ItemDialog, { collectionItem }),
    });
  }

  protected onManageWatchedEpisodes(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    let collectionItem = this.collectionItem();
    this.portal.open(WatchedEpisodesDialog, {
      imdbId: collectionItem.IMDbId,
      saved: (watchedEpisodes: SeriesTrackerWatchedEpisodeModel[], item?: CollectionItemModel) => {
        this.watchedEpisodes.set(watchedEpisodes);
        if (item) {
          collectionItem = item;
          this.applySyncedCollectionItem(item);
        }
        this.collectionService.triggerReload();
      },
      closed: () => this.portal.open(ItemDialog, { collectionItem }),
    });
  }

  protected onMarkAllEpisodesWatched(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    if (!this.seriesSeasons().length) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SetSeasonMetadataFirst'));
      return;
    }
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesWatched'))
      .pipe(
        mergeMap((confirmed) => {
          if (!confirmed) return of({ confirmed, result: null });
          this.spinnerLoadingState.setState('show', true);
          return this.api.markAllSeriesTrackerWatched(this.collectionItem().IMDbId).pipe(
            map((result) => ({ confirmed, result })),
            tap(() => this.spinnerLoadingState.setState('show', false)),
            catchError((error) => {
              this.spinnerLoadingState.setState('show', false);
              return throwError(() => error);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ confirmed, result }) => {
        if (!confirmed || !result) return;
        this.watchedEpisodes.set(result.watchedEpisodes);
        this.applySyncedCollectionItem(result.item);
        this.collectionService.triggerReload();
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedWatched'));
      });
  }
}
