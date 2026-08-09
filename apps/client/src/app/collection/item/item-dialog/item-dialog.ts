import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, max, min, submit, validate } from '@angular/forms/signals';
import { Autocomplete } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { Select } from '@components/select/select';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { Textarea } from '@components/textarea/textarea';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import {
  CollectionItemChangeApiModel,
  TrackingSeasonMetadataModel,
  TrackingCompletedEpisodeModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { isImdbShapedExternalItemId, mergeImdbExternalId } from '@shared/utils/external-metadata-identity-util';
import { normalizeIMDbRating } from '@shared/utils/external-metadata-ratings-util';
import { resolveImdbId } from '@shared/utils/imdb-id-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { finalize, firstValueFrom, map, mergeMap, of } from 'rxjs';
import { sharesStateToken } from '../../../shares/shares-store';
import { mainStateToken } from '../../../main/main-store';
import { CollectionItemModel } from '../../collection-model';
import { CollectionService } from '../../collection-service';
import { SeriesSeasonMetadataDialog } from '../../tracking/series-season-metadata-dialog/series-season-metadata-dialog';
import { CompletedEpisodesDialog } from '../../tracking/completed-episodes-dialog/completed-episodes-dialog';
import { getProxyImageUrl } from '../../utils/proxy-image-url-util';
import { formatTrackingEpisode } from '../../tracking/utils/tracking-progress-util';
import { filterDisplayTags } from '../../validators/tag-validators';
import {
  buildItemFormFromChange,
  validateOptionalIMDbRateFormat,
  validateOptionalMetacriticRateFormat,
  validateOptionalRottenTomatoesRateFormat,
} from '../item-form/item-form-util';
import { ItemFormModel } from '../item-form/item-form-model';
import { GenreSuggestionsProvider, TagSuggestionsProvider } from '../item-form/suggestion/item-autocomplete-providers';
import { ItemDialogActions } from './item-dialog-actions';
import { ItemDialogDetail } from './item-dialog-detail';
import { buildIMDbUrl, buildTrailerUrl, buildWebSearchUrl } from './utils/item-dialog-util';

@Component({
  selector: 'ct-item-dialog',
  imports: [
    FormField,
    FormRoot,
    DialogShell,
    RevealLabel,
    Autocomplete,
    Input,
    Select,
    Textarea,
    ItemDialogDetail,
    ItemDialogActions,
    GenreSuggestionsProvider,
    TagSuggestionsProvider,
  ],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.css',
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
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mainState = inject(mainStateToken);
  private readonly lastSavedItem = signal<CollectionItemChangeApiModel | null>(null);
  protected readonly translations = {
    titleCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.CollectionItem')),
    titleTrackingItem: computed(() => this.ngxSignalTranslate.translate('Title.TrackingItem')),
    titleBooksItem: computed(() => this.ngxSignalTranslate.translate('Title.BooksItem')),
    titleUpNextItem: computed(() => this.ngxSignalTranslate.translate('Title.UpNextItem')),
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
    subjects: computed(() => this.ngxSignalTranslate.translate('Subjects')),
    hintSeparateGenres: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateGenres')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    watchedUpTo: computed(() => this.ngxSignalTranslate.translate('WatchedUpTo')),
    readingProgress: computed(() => this.ngxSignalTranslate.translate('ReadingProgress')),
    pagesRead: computed(() => this.ngxSignalTranslate.translate('PagesRead')),
    totalPages: computed(() => this.ngxSignalTranslate.translate('TotalPages')),
    manageCompletedEpisodes: computed(() => this.ngxSignalTranslate.translate('ManageCompletedEpisodes')),
    hintSeparateTags: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateTags')),
    actors: computed(() => this.ngxSignalTranslate.translate('Actors')),
    authors: computed(() => this.ngxSignalTranslate.translate('Authors')),
    plot: computed(() => this.ngxSignalTranslate.translate('Plot')),
    description: computed(() => this.ngxSignalTranslate.translate('Description')),
    isbn: computed(() => this.ngxSignalTranslate.translate('ISBN')),
    type: computed(() => this.ngxSignalTranslate.translate('Type')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    seriesLabel: computed(() => this.ngxSignalTranslate.translate('Series')),
    fallbackUnknownYear: computed(() => this.ngxSignalTranslate.translate('Fallback.UnknownYear')),
    fallbackNotAvailable: computed(() => this.ngxSignalTranslate.translate('Fallback.NotAvailable')),
    links: computed(() => this.ngxSignalTranslate.translate('Links')),
    linkYouTubeTrailer: computed(() => this.ngxSignalTranslate.translate('Link.YouTubeTrailer')),
    linkWebSearch: computed(() => this.ngxSignalTranslate.translate('Link.WebSearch')),
    backToDetails: computed(() => this.ngxSignalTranslate.translate('BackToDetails')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    edit: computed(() => {
      switch (this.collectionItem().listType) {
        case 'tracking':
          return this.ngxSignalTranslate.translate('EditTrackingItem');
        case 'books':
          return this.ngxSignalTranslate.translate('EditBooksItem');
        case 'up-next':
          return this.ngxSignalTranslate.translate('EditUpNextItem');
        case 'wishlist':
          return this.ngxSignalTranslate.translate('EditWishlistItem');
        default:
          return this.ngxSignalTranslate.translate('EditCollectionItem');
      }
    }),
    markAsFavorite: computed(() => this.ngxSignalTranslate.translate('MarkAsFavorite')),
    markAsUnfinished: computed(() => this.ngxSignalTranslate.translate('MarkAsUnfinished')),
    markAsFinished: computed(() => this.ngxSignalTranslate.translate('MarkAsFinished')),
    copyToTracking: computed(() => this.ngxSignalTranslate.translate('CopyToTracking')),
    moveToFinished: computed(() => this.ngxSignalTranslate.translate('MoveToFinished')),
    moveToTracking: computed(() => this.ngxSignalTranslate.translate('MoveToTracking')),
    openInTracking: computed(() => this.ngxSignalTranslate.translate('OpenInTracking')),
    manageSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    removeFavorite: computed(() => this.ngxSignalTranslate.translate('RemoveFavorite')),
    removeFromTracking: computed(() => this.ngxSignalTranslate.translate('RemoveFromTracking')),
    delete: computed(() => {
      switch (this.collectionItem().listType) {
        case 'tracking':
          return this.ngxSignalTranslate.translate('DeleteFromTracking');
        case 'books':
          return this.ngxSignalTranslate.translate('DeleteFromBooks');
        case 'up-next':
          return this.ngxSignalTranslate.translate('DeleteFromUpNext');
        case 'wishlist':
          return this.ngxSignalTranslate.translate('DeleteFromWishlist');
        default:
          return this.ngxSignalTranslate.translate('DeleteFromCollection');
      }
    }),
    shared: computed(() => this.ngxSignalTranslate.translate('Shared')),
    validationRequired: computed(() => this.ngxSignalTranslate.translate('Validation.Required')),
    validationIMDbRate: computed(() => this.ngxSignalTranslate.translate('Validation.IMDbRate')),
    validationMetacriticRate: computed(() => this.ngxSignalTranslate.translate('Validation.MetacriticRate')),
    validationRottenTomatoesRate: computed(() => this.ngxSignalTranslate.translate('Validation.RottenTomatoesRate')),
    validationUserRate: computed(() => this.ngxSignalTranslate.translate('Validation.UserRate')),
    validationProgressRange: computed(() => this.ngxSignalTranslate.translate('Validation.ProgressRange')),
    ratings: computed(() => this.ngxSignalTranslate.translate('Ratings')),
  };
  protected readonly formModel = signal<ItemFormModel>({
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
    contentType: 'movie',
    progressCurrent: null,
    progressTotal: null,
  });
  protected readonly form = form(
    this.formModel,
    (item) => {
      validate(item.title, ({ value }) => (value()?.trim() ? undefined : { kind: 'required' }));
      validate(item.IMDbId, ({ value }) =>
        !this.canEditImdbIdentity() || value()?.trim() ? undefined : { kind: 'required' }
      );
      validate(item.rate, ({ value }) => validateOptionalIMDbRateFormat(value()));
      validate(item.rottenTomatoesRate, ({ value }) => validateOptionalRottenTomatoesRateFormat(value()));
      validate(item.metacriticRate, ({ value }) => validateOptionalMetacriticRateFormat(value()));
      min(item.userRate, 0, { error: { kind: 'min' } });
      max(item.userRate, 10, { error: { kind: 'max' } });
      validate(item.userRate, ({ value }) => {
        const userRate = value();
        if (userRate === null) return undefined;
        return Math.abs(userRate * 10 - Math.round(userRate * 10)) <= 1e-9 ? undefined : { kind: 'userRate' };
      });
      min(item.progressCurrent, 0, { error: { kind: 'min' } });
      min(item.progressTotal, 1, { error: { kind: 'min' } });
      validate(item.progressCurrent, ({ value, valueOf }) => {
        const progressCurrent = value();
        const progressTotal = valueOf(item.progressTotal);
        if (progressCurrent === null || progressTotal === null) return undefined;
        return progressCurrent <= progressTotal ? undefined : { kind: 'progressRange' };
      });
      validate(item.progressTotal, ({ value, valueOf }) => {
        const progressTotal = value();
        const progressCurrent = valueOf(item.progressCurrent);
        if (progressCurrent === null || progressTotal === null) return undefined;
        return progressCurrent <= progressTotal ? undefined : { kind: 'progressRange' };
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
    rate: {
      rateFormat: computed(() =>
        this.form
          .rate()
          .errors()
          .some((error) => error.kind === 'rateFormat')
      ),
    },
    rottenTomatoesRate: {
      rateFormat: computed(() =>
        this.form
          .rottenTomatoesRate()
          .errors()
          .some((error) => error.kind === 'rateFormat')
      ),
    },
    metacriticRate: {
      rateFormat: computed(() =>
        this.form
          .metacriticRate()
          .errors()
          .some((error) => error.kind === 'rateFormat')
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
    progressCurrent: {
      progressRange: computed(() =>
        this.form
          .progressCurrent()
          .errors()
          .some((error) => error.kind === 'progressRange')
      ),
    },
    progressTotal: {
      progressRange: computed(() =>
        this.form
          .progressTotal()
          .errors()
          .some((error) => error.kind === 'progressRange')
      ),
    },
  };
  protected readonly genreText = computed(() => this.form.genreText().value());
  protected readonly tagsText = computed(() => this.form.tagsText().value());
  protected readonly contentTypeOptions = computed(() => [
    { text: this.translations.movies(), value: 'movie' },
    { text: this.translations.seriesLabel(), value: 'series' },
  ]);
  protected readonly seriesSeasons = signal<TrackingSeasonMetadataModel[]>([]);
  protected readonly completedEpisodes = signal<TrackingCompletedEpisodeModel[]>([]);
  protected readonly seriesSeasonsLoaded = signal(false);
  protected readonly completedEpisodesLoaded = signal(false);
  protected readonly trackingExists = signal(false);
  protected readonly finishedExists = signal(false);
  protected readonly trackingHash = signal<string | undefined>(undefined);
  protected readonly finishedHash = signal<string | undefined>(undefined);
  protected readonly allEpisodesCompleted = computed(() => {
    if (!this.seriesSeasonsLoaded() || !this.completedEpisodesLoaded()) return this.collectionItem().watchedAt !== null;

    const seasons = this.seriesSeasons();
    if (!seasons.length) return false;

    const completedSet = new Set(this.completedEpisodes().map((episode) => `${episode.season}-${episode.episode}`));
    for (const season of seasons) {
      for (let episode = 1; episode <= season.episodes; episode++) {
        if (!completedSet.has(`${season.season}-${episode}`)) return false;
      }
    }
    return true;
  });
  protected readonly lastCompletedEpisode = computed(() => {
    const episodes = this.completedEpisodes();
    if (!episodes.length) return null;
    const last = episodes[episodes.length - 1];
    return { season: last.season, episode: last.episode };
  });
  protected readonly detailTags = computed(() => filterDisplayTags(this.collectionItem().tags));
  protected readonly episodeProgressText = computed(() => {
    return formatTrackingEpisode(this.lastCompletedEpisode()) ?? this.translations.fallbackNotAvailable();
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
    if (item.listType === 'tracking') return this.isOwnItem();
    if (item.listType === 'books') return this.isOwnItem();
    if (item.listType === 'up-next') return this.isOwnItem();
    if (item.listType === 'wishlist') return this.isOwnItem();
    if (item.listType !== 'library') return false;
    if (this.isOwnItem()) return true;
    return share?.canUpdate === true;
  });
  protected readonly libraryItem = computed(() => this.collectionItem().listType === 'library');
  protected readonly ownershipItem = computed(
    () => this.collectionItem().listType === 'library' || this.collectionItem().listType === 'books'
  );
  protected readonly tracking = computed(() => this.collectionItem().listType === 'tracking');
  protected readonly inTracking = computed(() => this.trackingExists());
  protected readonly inFinished = computed(() => this.finishedExists());
  protected readonly featurePreferences = this.mainState.state.collectionFeaturePreferences;
  protected readonly books = computed(() => this.collectionItem().listType === 'books');
  protected readonly book = computed(() => this.collectionItem().contentType === 'book');
  protected readonly movie = computed(() => this.collectionItem().contentType === 'movie');
  protected readonly series = computed(() => this.collectionItem().contentType === 'series');
  protected readonly isbn = computed(() => {
    const item = this.collectionItem();
    return (
      item.externalIds?.find((identity) => identity.source === 'isbn')?.id ??
      (item.externalProvider === 'openlibrary' ? item.externalItemId : '')
    );
  });
  protected readonly canEditImdbIdentity = computed(() =>
    isImdbShapedExternalItemId(this.collectionItem().externalItemId)
  );
  protected readonly permissionWatch = computed(
    () =>
      (this.libraryItem() && (this.movie() || this.series())) ||
      (this.books() && this.book() && this.featurePreferences().tracking)
  );
  protected readonly permissionDelete = computed(() => {
    const item = this.collectionItem();
    const share = this.sharesState.state
      .incoming()
      .find((incomingShare) => incomingShare.ownerUserShareCode === item.ownerShareCode);
    if (this.isOwnItem()) return true;
    return share?.canDelete === true;
  });
  protected readonly finished = computed(
    () =>
      this.collectionItem().watched === true ||
      (this.tracking() && (this.movie() || this.book()) && this.collectionItem().watchedAt !== null)
  );
  protected readonly favorite = computed(() => this.collectionItem().favorite);
  protected readonly upNext = computed(() => this.collectionItem().listType === 'up-next');
  protected readonly wishlist = computed(() => this.collectionItem().listType === 'wishlist');
  protected readonly dialogTitle = computed(() => {
    if (this.upNext()) return this.translations.titleUpNextItem();
    if (this.wishlist()) return this.translations.titleWishlistItem();
    if (this.tracking()) return this.translations.titleTrackingItem();
    if (this.books()) return this.translations.titleBooksItem();
    return this.translations.titleCollectionItem();
  });
  protected readonly showBookProgress = computed(() => this.book() && this.tracking());
  protected readonly bookProgressText = computed(() => {
    const item = this.collectionItem();
    const current = item.progressCurrent;
    const total = item.progressTotal;
    if (current == null && total == null) return this.translations.fallbackNotAvailable();
    if (current != null && total != null) return `${current} / ${total}`;
    if (current != null) return `${current}`;
    return `${total}`;
  });
  protected readonly dialogIcon = computed(() => {
    if (this.book() || this.books()) return 'menu_book';
    if (this.series() || this.tracking()) return 'live_tv';
    return 'movie';
  });
  protected readonly draftImageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.form.image().value())
  );
  protected readonly imageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.collectionItem().image)
  );
  protected readonly trailerUrl = computed(() =>
    buildTrailerUrl(this.collectionItem().title, this.collectionItem().year)
  );
  protected readonly imdbUrl = computed(() => {
    const imdbId = this.collectionItem().IMDbId;
    return imdbId ? buildIMDbUrl(imdbId) : '';
  });
  protected readonly webSearchUrl = computed(() => {
    const item = this.collectionItem();
    return buildWebSearchUrl(item.title, item.year);
  });
  public readonly collectionItem = model.required<CollectionItemModel>();

  public ngOnInit(): void {
    this.resetFormFromItem(this.collectionItem());
    this.loadTrackerStates();
    this.loadSeriesSeasons();
    this.loadCompletedEpisodes();
  }

  private loadTrackerStates(): void {
    const item = this.collectionItem();
    const externalProvider = item.externalProvider;
    const externalItemId = item.externalItemId;
    const loadTracking =
      (this.libraryItem() && (this.series() || this.movie())) ||
      (this.books() && this.book()) ||
      (this.upNext() && (this.series() || this.book() || this.movie()));

    if (loadTracking) {
      this.api
        .collectionItemExists(externalProvider, externalItemId, undefined, 'tracking', item.externalIds)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          this.trackingExists.set(response.exists);
          this.trackingHash.set(response.hash);
          if (this.movie() || this.book()) {
            this.finishedExists.set(response.exists);
            this.finishedHash.set(response.hash);
          }
        });
    }
  }

  private loadSeriesSeasons(): void {
    if (!this.tracking() || !this.isOwnItem()) return;
    this.api
      .getTrackingSeasonsByExternalId(this.collectionItem().externalProvider, this.collectionItem().externalItemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.seriesSeasons.set(response.seasons);
        this.seriesSeasonsLoaded.set(true);
      });
  }

  private loadCompletedEpisodes(): void {
    if (!this.tracking() || !this.isOwnItem()) return;
    this.api
      .getTrackingCompletedEpisodesByExternalId(
        this.collectionItem().externalProvider,
        this.collectionItem().externalItemId
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.completedEpisodes.set(response.completedEpisodes);
        this.completedEpisodesLoaded.set(true);
      });
  }

  private resetFormFromItem(item: CollectionItemModel): void {
    const change = { ...toCollectionItemChange(item), rate: normalizeIMDbRating(item.rate) };
    this.form().reset(buildItemFormFromChange(change));
    this.lastSavedItem.set(change);
  }

  private applySyncedCollectionItem(item: CollectionItemModel | undefined): void {
    if (!item) return;
    const currentItem = this.collectionItem();
    this.collectionService.updateCollectionItem(currentItem, item, currentItem.ownerShareCode, currentItem.listType);
    this.collectionItem.set(item);
    this.resetFormFromItem(item);
    this.posterImageFailed.set(false);
  }

  private buildItemFromForm(): CollectionItemChangeApiModel {
    const formValues = this.form().value();
    const tags = parseTagText(formValues.tagsText);
    const currentItem = this.collectionItem();
    const canEditImdbIdentity = this.canEditImdbIdentity();
    const resolvedImdbId = canEditImdbIdentity ? resolveImdbId(formValues.IMDbId) || formValues.IMDbId.trim() : '';
    const nextImdbId = canEditImdbIdentity ? resolvedImdbId : currentItem.IMDbId;
    const imdbIdChanged = canEditImdbIdentity && resolvedImdbId !== currentItem.IMDbId;
    const nextExternalIds = imdbIdChanged
      ? mergeImdbExternalId(currentItem.externalIds, resolvedImdbId)
      : currentItem.externalIds;
    return {
      title: formValues.title,
      IMDbId: nextImdbId,
      externalProvider: currentItem.externalProvider,
      externalItemId: imdbIdChanged ? resolvedImdbId : currentItem.externalItemId,
      externalIds: nextExternalIds,
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
      contentType: formValues.contentType,
      favorite: this.collectionItem().favorite,
      progressCurrent: this.showBookProgress() ? formValues.progressCurrent : undefined,
      progressTotal: this.showBookProgress() ? formValues.progressTotal : undefined,
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
            this.spinnerLoadingState.setState('show', true);
            const deleteRequest = listType
              ? this.api.deleteByExternalId(
                  this.collectionItem().externalProvider,
                  this.collectionItem().externalItemId,
                  this.collectionItem().hash,
                  ownerShareCode,
                  listType
                )
              : this.api.deleteByExternalId(
                  this.collectionItem().externalProvider,
                  this.collectionItem().externalItemId,
                  this.collectionItem().hash,
                  ownerShareCode
                );
            return deleteRequest.pipe(
              map(() => confirmed),
              finalize(() => this.spinnerLoadingState.setState('show', false))
            );
          } else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.DeleteItem'));
          if (listType) this.collectionService.deleteCollectionItem(this.collectionItem(), ownerShareCode, listType);
          else this.collectionService.deleteCollectionItem(this.collectionItem(), ownerShareCode);
          this.collectionService.triggerReload();
          this.portal.closeAll();
        }
      });
  }

  protected onEdit(): void {
    this.editMode.set(true);
  }

  protected onReadOnly(): void {
    const lastSavedItem = this.lastSavedItem();
    if (lastSavedItem) {
      this.form().reset(buildItemFormFromChange(lastSavedItem));
    }
    this.editMode.set(false);
  }

  protected onPosterImageError(): void {
    this.posterImageFailed.set(true);
  }

  protected async onSaveChanges(): Promise<void> {
    if (
      this.collectionItem().listType !== 'library' &&
      this.collectionItem().listType !== 'tracking' &&
      this.collectionItem().listType !== 'books' &&
      this.collectionItem().listType !== 'up-next' &&
      this.collectionItem().listType !== 'wishlist'
    )
      return;
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
              this.spinnerLoadingState.setState('show', true);
              let updateListType: 'tracking' | 'books' | 'up-next' | 'wishlist' | undefined;
              if (this.tracking()) {
                updateListType = 'tracking';
              } else if (this.books()) {
                updateListType = 'books';
              } else if (this.upNext()) {
                updateListType = 'up-next';
              } else if (this.wishlist()) {
                updateListType = 'wishlist';
              }
              const updateRequest = updateListType
                ? this.api.updateByExternalId(
                    this.collectionItem().externalProvider,
                    this.collectionItem().externalItemId,
                    item,
                    this.collectionItem().hash,
                    ownerShareCode,
                    updateListType
                  )
                : this.api.updateByExternalId(
                    this.collectionItem().externalProvider,
                    this.collectionItem().externalItemId,
                    item,
                    this.collectionItem().hash,
                    ownerShareCode
                  );
              return updateRequest.pipe(
                map((result) => ({ confirmed, item: result.item })),
                finalize(() => this.spinnerLoadingState.setState('show', false))
              );
            } else return of({ confirmed, item: null });
          })
        )
    );
    if (confirmed.confirmed && confirmed.item) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
      this.collectionService.updateCollectionItem(
        this.collectionItem(),
        confirmed.item,
        ownerShareCode,
        this.collectionItem().listType
      );
      this.collectionService.triggerReload();
      this.collectionItem.set(confirmed.item);
      this.lastSavedItem.set(toCollectionItemChange(confirmed.item));
      this.posterImageFailed.set(false);
      this.onReadOnly();
    }
  }

  protected async onMarkAsFinished(): Promise<void> {
    if (!this.featurePreferences().tracking || !this.permissionWatch() || this.finished()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const sourceListType = this.books() ? 'books' : undefined;
      const item = await firstValueFrom(
        this.api.addCompletedItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          this.collectionItem().ownerShareCode,
          sourceListType
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      const updatedSource = { ...this.collectionItem(), watched: true };
      this.collectionService.updateCollectionItem(
        this.collectionItem(),
        updatedSource,
        updatedSource.ownerShareCode,
        updatedSource.listType
      );
      this.collectionService.triggerReload();
      this.collectionItem.set(updatedSource);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMoveToFinished(): Promise<void> {
    if (!this.featurePreferences().tracking || !this.upNext() || !(this.movie() || this.book())) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const item = await firstValueFrom(
        this.api.addCompletedItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          undefined,
          'up-next'
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      this.finishedExists.set(true);
      this.finishedHash.set(item.item.hash);
      this.collectionService.deleteCollectionItem(
        this.collectionItem(),
        this.collectionItem().ownerShareCode,
        'up-next'
      );
      this.collectionService.triggerReload();
      this.portal.closeAll();
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMoveToTracking(): Promise<void> {
    if (!this.featurePreferences().tracking || !this.upNext() || !(this.series() || this.book())) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const item = await firstValueFrom(
        this.api.addTrackingItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          'up-next'
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      this.trackingExists.set(true);
      this.trackingHash.set(item.item.hash);
      this.collectionService.deleteCollectionItem(
        this.collectionItem(),
        this.collectionItem().ownerShareCode,
        'up-next'
      );
      this.collectionService.triggerReload();
      this.portal.closeAll();
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onCopyToTracking(): Promise<void> {
    if (!this.featurePreferences().tracking || !this.ownershipItem() || !(this.series() || this.book())) {
      return;
    }
    this.spinnerLoadingState.setState('show', true);
    try {
      const sourceListType = this.books() ? 'books' : undefined;
      const item = await firstValueFrom(
        this.api.addTrackingItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          sourceListType,
          this.collectionItem().ownerShareCode
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      this.trackingExists.set(true);
      this.trackingHash.set(item.item.hash);
      this.collectionService.triggerReload();
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onOpenInTracking(): Promise<void> {
    if (
      !this.featurePreferences().tracking ||
      !this.ownershipItem() ||
      !(this.series() || this.book()) ||
      !this.inTracking()
    ) {
      return;
    }

    const libraryItem = this.collectionItem();
    const identities =
      libraryItem.externalIds && libraryItem.externalIds.length > 0
        ? libraryItem.externalIds
        : [{ source: libraryItem.externalProvider, id: libraryItem.externalItemId }];

    this.spinnerLoadingState.setState('show', true);
    try {
      const response = await firstValueFrom(
        this.api.getMatchedItems({
          identities,
          limit: 1,
          filters: { listType: 'tracking' },
        })
      );
      const trackingItem = response.items[0];
      if (!trackingItem) return;
      this.portal.closeAll();
      this.portal.open(ItemDialog, { collectionItem: trackingItem });
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onRemoveFromTracking(): Promise<void> {
    if (
      !this.featurePreferences().tracking ||
      !this.ownershipItem() ||
      !(this.series() || this.book()) ||
      !this.inTracking()
    ) {
      return;
    }
    const item = this.collectionItem();
    const trackerHash = this.trackingHash();
    if (!trackerHash) return;

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Delete', { name: item.title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            this.spinnerLoadingState.setState('show', true);
            return this.api
              .deleteByExternalId(item.externalProvider, item.externalItemId, trackerHash, undefined, 'tracking')
              .pipe(
                map(() => confirmed),
                finalize(() => this.spinnerLoadingState.setState('show', false))
              );
          }
          return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.DeleteItem'));
          this.collectionService.deleteCollectionItem({ ...item, listType: 'tracking' }, undefined, 'tracking');
          this.trackingExists.set(false);
          this.trackingHash.set(undefined);
          this.collectionService.triggerReload();
        }
      });
  }

  protected async onMarkAsUnfinished(): Promise<void> {
    if (!this.featurePreferences().tracking || !this.permissionWatch() || !this.finished()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const sourceItem = this.collectionItem();
      await firstValueFrom(
        this.api.deleteCompletedItemByExternalId(sourceItem.externalProvider, sourceItem.externalItemId)
      );
      const updatedSource = { ...sourceItem, watched: false };
      if (sourceItem.contentType === 'movie') {
        this.collectionService.deleteCollectionItem({ ...sourceItem, listType: 'tracking' }, undefined, 'tracking');
      } else if (sourceItem.contentType === 'book') {
        this.collectionService.updateCollectionItem(
          { ...sourceItem, listType: 'tracking' },
          { ...sourceItem, listType: 'tracking', watched: false, watchedAt: null },
          undefined,
          'tracking'
        );
      }
      this.collectionService.updateCollectionItem(
        sourceItem,
        updatedSource,
        updatedSource.ownerShareCode,
        updatedSource.listType
      );
      this.collectionService.triggerReload();
      this.collectionItem.set(updatedSource);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMarkAsFavorite(): Promise<void> {
    if (!this.ownershipItem() || this.collectionItem().favorite) return;
    await this.doSave({ ...this.buildItemFromForm(), favorite: true });
  }

  protected async onRemoveFavorite(): Promise<void> {
    if (!this.ownershipItem()) return;
    await this.doSave({ ...this.buildItemFromForm(), favorite: false });
  }

  protected onManageSeriesMetadata(): void {
    if (!this.tracking() || !this.permissionUpdate()) return;
    let collectionItem = this.collectionItem();
    const providerInputs =
      collectionItem.externalProvider === 'omdb'
        ? {}
        : { externalProvider: collectionItem.externalProvider, externalItemId: collectionItem.externalItemId };
    this.portal.openStacked(SeriesSeasonMetadataDialog, {
      imdbId: collectionItem.IMDbId,
      ...providerInputs,
      initialSeasons: this.seriesSeasons(),
      saved: (seasons: TrackingSeasonMetadataModel[], item?: CollectionItemModel) => {
        this.seriesSeasons.set(seasons);
        if (item) {
          collectionItem = item;
          this.applySyncedCollectionItem(item);
        }
        this.collectionService.triggerReload();
      },
    });
  }

  protected onManageCompletedEpisodes(): void {
    if (!this.tracking() || !this.permissionUpdate()) return;
    let collectionItem = this.collectionItem();
    const providerInputs =
      collectionItem.externalProvider === 'omdb'
        ? {}
        : { externalProvider: collectionItem.externalProvider, externalItemId: collectionItem.externalItemId };
    this.portal.openStacked(CompletedEpisodesDialog, {
      imdbId: collectionItem.IMDbId,
      ...providerInputs,
      saved: (completedEpisodes: TrackingCompletedEpisodeModel[], item?: CollectionItemModel) => {
        this.completedEpisodes.set(completedEpisodes);
        if (item) {
          collectionItem = item;
          this.applySyncedCollectionItem(item);
        }
        this.collectionService.triggerReload();
      },
    });
  }
}
