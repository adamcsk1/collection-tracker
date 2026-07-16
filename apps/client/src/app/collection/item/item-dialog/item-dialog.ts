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
  SeriesTrackerSeasonMetadataModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { normalizeIMDbRating } from '@shared/utils/external-metadata-ratings-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { finalize, firstValueFrom, map, mergeMap, of } from 'rxjs';
import { sharesStateToken } from '../../../shares/shares-store';
import { CollectionItemModel } from '../../collection-model';
import { CollectionService } from '../../collection-service';
import { TagSuggestionService } from '../new-item-dialog/suggestion/tag-suggestion-service';
import { SeriesSeasonMetadataDialog } from '../../series-tracker/series-season-metadata-dialog/series-season-metadata-dialog';
import { WatchedEpisodesDialog } from '../../series-tracker/watched-episodes-dialog/watched-episodes-dialog';
import { getProxyImageUrl } from '../../utils/proxy-image-url-util';
import { formatSeriesTrackerEpisode } from '../../series-tracker/utils/series-tracker-progress-util';
import { filterDisplayTags, filterEditableTags } from '../../validators/tag-validators';
import { GenreSuggestionService } from './suggestion/genre-suggestion-service';
import { ItemDialogActions } from './item-dialog-actions';
import { ItemDialogDetail } from './item-dialog-detail';
import { ItemDialogFormModel } from './item-dialog-model';
import {
  buildIMDbUrl,
  buildTrailerUrl,
  buildWebSearchUrl,
  validateOptionalIMDbRateFormat,
  validateOptionalMetacriticRateFormat,
  validateOptionalRottenTomatoesRateFormat,
} from './utils/item-dialog-util';

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
  ],
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
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lastSavedItem = signal<CollectionItemChangeApiModel | null>(null);
  protected readonly translations = {
    titleCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.CollectionItem')),
    titleMovieTrackerItem: computed(() => this.ngxSignalTranslate.translate('Title.MovieTrackerItem')),
    titleSeriesTrackerItem: computed(() => this.ngxSignalTranslate.translate('Title.SeriesTrackerItem')),
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
    watchedUpTo: computed(() => this.ngxSignalTranslate.translate('WatchedUpTo')),
    manageWatchedEpisodes: computed(() => this.ngxSignalTranslate.translate('ManageWatchedEpisodes')),
    hintSeparateTags: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateTags')),
    actors: computed(() => this.ngxSignalTranslate.translate('Actors')),
    plot: computed(() => this.ngxSignalTranslate.translate('Plot')),
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
        case 'movie-tracker':
          return this.ngxSignalTranslate.translate('EditMovieTrackerItem');
        case 'series-tracker':
          return this.ngxSignalTranslate.translate('EditSeriesTrackerItem');
        case 'watch-later':
          return this.ngxSignalTranslate.translate('EditWatchLaterItem');
        case 'wishlist':
          return this.ngxSignalTranslate.translate('EditWishlistItem');
        default:
          return this.ngxSignalTranslate.translate('EditCollectionItem');
      }
    }),
    markAsFavorite: computed(() => this.ngxSignalTranslate.translate('MarkAsFavorite')),
    markAsUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAsUnwatched')),
    markAsWatched: computed(() => this.ngxSignalTranslate.translate('MarkAsWatched')),
    copyToSeriesTracker: computed(() => this.ngxSignalTranslate.translate('CopyToSeriesTracker')),
    moveToMovieTracker: computed(() => this.ngxSignalTranslate.translate('MoveToMovieTracker')),
    moveToSeriesTracker: computed(() => this.ngxSignalTranslate.translate('MoveToSeriesTracker')),
    manageSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    removeFavorite: computed(() => this.ngxSignalTranslate.translate('RemoveFavorite')),
    removeFromSeriesTracker: computed(() => this.ngxSignalTranslate.translate('RemoveFromSeriesTracker')),
    delete: computed(() => {
      switch (this.collectionItem().listType) {
        case 'movie-tracker':
          return this.ngxSignalTranslate.translate('DeleteFromMovieTracker');
        case 'series-tracker':
          return this.ngxSignalTranslate.translate('DeleteFromSeriesTracker');
        case 'watch-later':
          return this.ngxSignalTranslate.translate('DeleteFromWatchLater');
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
    contentType: 'movie',
  });
  protected readonly form = form(
    this.formModel,
    (item) => {
      validate(item.title, ({ value }) => (value()?.trim() ? undefined : { kind: 'required' }));
      validate(item.IMDbId, ({ value }) =>
        !this.canEditOmdbIdentity() || value()?.trim() ? undefined : { kind: 'required' }
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
  };
  protected readonly genreText = computed(() => this.form.genreText().value());
  protected readonly tagsText = computed(() => this.form.tagsText().value());
  protected readonly contentTypeOptions = computed(() => [
    { text: this.translations.movies(), value: 'movie' },
    { text: this.translations.seriesLabel(), value: 'series' },
  ]);
  protected readonly seriesSeasons = signal<SeriesTrackerSeasonMetadataModel[]>([]);
  protected readonly watchedEpisodes = signal<SeriesTrackerWatchedEpisodeModel[]>([]);
  protected readonly seriesSeasonsLoaded = signal(false);
  protected readonly watchedEpisodesLoaded = signal(false);
  protected readonly seriesTrackerExists = signal(false);
  protected readonly movieTrackerExists = signal(false);
  protected readonly seriesTrackerHash = signal<string | undefined>(undefined);
  protected readonly movieTrackerHash = signal<string | undefined>(undefined);
  protected readonly allEpisodesWatched = computed(() => {
    if (!this.seriesSeasonsLoaded() || !this.watchedEpisodesLoaded()) return this.collectionItem().watchedAt !== null;

    const seasons = this.seriesSeasons();
    if (!seasons.length) return false;

    const watchedSet = new Set(this.watchedEpisodes().map((episode) => `${episode.season}-${episode.episode}`));
    for (const season of seasons) {
      for (let episode = 1; episode <= season.episodes; episode++) {
        if (!watchedSet.has(`${season.season}-${episode}`)) return false;
      }
    }
    return true;
  });
  protected readonly lastWatchedEpisode = computed(() => {
    const episodes = this.watchedEpisodes();
    if (!episodes.length) return null;
    const last = episodes[episodes.length - 1];
    return { season: last.season, episode: last.episode };
  });
  protected readonly detailTags = computed(() => filterDisplayTags(this.collectionItem().tags));
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
    if (item.listType === 'movie-tracker') return this.isOwnItem();
    if (item.listType === 'watch-later') return this.isOwnItem();
    if (item.listType === 'wishlist') return this.isOwnItem();
    if (item.listType !== 'library') return false;
    if (this.isOwnItem()) return true;
    return share?.canUpdate === true;
  });
  protected readonly libraryItem = computed(() => this.collectionItem().listType === 'library');
  protected readonly seriesTracker = computed(() => this.collectionItem().listType === 'series-tracker');
  protected readonly inSeriesTracker = computed(() => this.seriesTrackerExists());
  protected readonly inMovieTracker = computed(() => this.movieTrackerExists());
  protected readonly movieTracker = computed(() => this.collectionItem().listType === 'movie-tracker');
  protected readonly movie = computed(() => this.collectionItem().contentType === 'movie');
  protected readonly series = computed(() => this.collectionItem().contentType === 'series');
  protected readonly canEditOmdbIdentity = computed(() => this.collectionItem().externalProvider === 'omdb');
  protected readonly permissionWatch = computed(() => this.libraryItem() && (this.movie() || this.series()));
  protected readonly permissionDelete = computed(() => {
    const item = this.collectionItem();
    const share = this.sharesState.state
      .incoming()
      .find((incomingShare) => incomingShare.ownerUserShareCode === item.ownerShareCode);
    if (this.isOwnItem()) return true;
    return share?.canDelete === true;
  });
  protected readonly watched = computed(() => this.collectionItem().watched === true || this.movieTracker());
  protected readonly favorite = computed(() => this.collectionItem().favorite);
  protected readonly watchLater = computed(() => this.collectionItem().listType === 'watch-later');
  protected readonly wishlist = computed(() => this.collectionItem().listType === 'wishlist');
  protected readonly dialogTitle = computed(() => {
    if (this.watchLater()) return this.translations.titleWatchLaterItem();
    if (this.wishlist()) return this.translations.titleWishlistItem();
    if (this.seriesTracker()) return this.translations.titleSeriesTrackerItem();
    if (this.movieTracker()) return this.translations.titleMovieTrackerItem();
    return this.translations.titleCollectionItem();
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
    this.loadWatchedEpisodes();
  }

  private loadTrackerStates(): void {
    const item = this.collectionItem();
    const externalProvider = item.externalProvider;
    const externalItemId = item.externalItemId;
    if (this.libraryItem() && this.series()) {
      this.api
        .collectionItemExists(externalProvider, externalItemId, undefined, 'series-tracker', item.externalIds)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          this.seriesTrackerExists.set(response.exists);
          this.seriesTrackerHash.set(response.hash);
        });
    }
    if (this.watchLater() && this.movie()) {
      this.api
        .collectionItemExists(externalProvider, externalItemId, undefined, 'movie-tracker', item.externalIds)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          this.movieTrackerExists.set(response.exists);
          this.movieTrackerHash.set(response.hash);
        });
    }
    if (this.watchLater() && this.series()) {
      this.api
        .collectionItemExists(externalProvider, externalItemId, undefined, 'series-tracker', item.externalIds)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((response) => {
          this.seriesTrackerExists.set(response.exists);
          this.seriesTrackerHash.set(response.hash);
        });
    }
  }

  private loadSeriesSeasons(): void {
    if (!this.seriesTracker() || !this.isOwnItem()) return;
    this.api
      .getSeriesTrackerSeasonsByExternalId(this.collectionItem().externalProvider, this.collectionItem().externalItemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.seriesSeasons.set(response.seasons);
        this.seriesSeasonsLoaded.set(true);
      });
  }

  private loadWatchedEpisodes(): void {
    if (!this.seriesTracker() || !this.isOwnItem()) return;
    this.api
      .getSeriesTrackerWatchedEpisodesByExternalId(
        this.collectionItem().externalProvider,
        this.collectionItem().externalItemId
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.watchedEpisodes.set(response.watchedEpisodes);
        this.watchedEpisodesLoaded.set(true);
      });
  }

  private resetFormFromItem(item: CollectionItemModel): void {
    const change = { ...toCollectionItemChange(item), rate: normalizeIMDbRating(item.rate) };
    this.form().reset({
      title: change.title,
      IMDbId: change.IMDbId ?? change.externalItemId,
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
      contentType: change.contentType,
    });
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
    const canEditOmdbIdentity = this.canEditOmdbIdentity();
    const imdbIdChanged = canEditOmdbIdentity && formValues.IMDbId !== currentItem.IMDbId;
    return {
      title: formValues.title,
      IMDbId: canEditOmdbIdentity ? formValues.IMDbId : currentItem.IMDbId,
      externalProvider: currentItem.externalProvider,
      externalItemId: imdbIdChanged ? formValues.IMDbId : currentItem.externalItemId,
      externalIds: imdbIdChanged ? undefined : currentItem.externalIds,
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
      this.form().reset({
        title: lastSavedItem.title,
        IMDbId: lastSavedItem.IMDbId ?? lastSavedItem.externalItemId,
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
        contentType: lastSavedItem.contentType,
      });
    }
    this.editMode.set(false);
  }

  protected onPosterImageError(): void {
    this.posterImageFailed.set(true);
  }

  protected async onSaveChanges(): Promise<void> {
    if (
      this.collectionItem().listType !== 'library' &&
      this.collectionItem().listType !== 'series-tracker' &&
      this.collectionItem().listType !== 'movie-tracker' &&
      this.collectionItem().listType !== 'watch-later' &&
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
              let updateListType: 'series-tracker' | 'movie-tracker' | 'watch-later' | 'wishlist' | undefined;
              if (this.seriesTracker()) {
                updateListType = 'series-tracker';
              } else if (this.movieTracker()) {
                updateListType = 'movie-tracker';
              } else if (this.watchLater()) {
                updateListType = 'watch-later';
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

  protected async onMarkAsWatched(): Promise<void> {
    if (!this.permissionWatch() || this.watched()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const item = await firstValueFrom(
        this.api.addMovieTrackerItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          this.collectionItem().ownerShareCode
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

  protected async onMoveToMovieTracker(): Promise<void> {
    if (!this.watchLater() || !this.movie()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const item = await firstValueFrom(
        this.api.addMovieTrackerItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          undefined,
          'watch-later'
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      this.movieTrackerExists.set(true);
      this.movieTrackerHash.set(item.item.hash);
      this.collectionService.deleteCollectionItem(
        this.collectionItem(),
        this.collectionItem().ownerShareCode,
        'watch-later'
      );
      this.collectionService.triggerReload();
      this.portal.closeAll();
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMoveToSeriesTracker(): Promise<void> {
    if (!this.watchLater() || !this.series()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const item = await firstValueFrom(
        this.api.addSeriesTrackerItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          'watch-later'
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      this.seriesTrackerExists.set(true);
      this.seriesTrackerHash.set(item.item.hash);
      this.collectionService.deleteCollectionItem(
        this.collectionItem(),
        this.collectionItem().ownerShareCode,
        'watch-later'
      );
      this.collectionService.triggerReload();
      this.portal.closeAll();
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onCopyToSeriesTracker(): Promise<void> {
    if (!this.libraryItem() || !this.series()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      const item = await firstValueFrom(
        this.api.addSeriesTrackerItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId,
          undefined,
          this.collectionItem().ownerShareCode
        )
      );
      this.collectionService.addCollectionItem(item.item, true);
      this.seriesTrackerExists.set(true);
      this.seriesTrackerHash.set(item.item.hash);
      this.collectionService.triggerReload();
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onRemoveFromSeriesTracker(): Promise<void> {
    if (!this.libraryItem() || !this.series() || !this.inSeriesTracker()) return;
    const item = this.collectionItem();
    const trackerHash = this.seriesTrackerHash();
    if (!trackerHash) return;

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Delete', { name: item.title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            this.spinnerLoadingState.setState('show', true);
            return this.api
              .deleteByExternalId(item.externalProvider, item.externalItemId, trackerHash, undefined, 'series-tracker')
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
          this.collectionService.deleteCollectionItem(
            { ...item, listType: 'series-tracker' },
            undefined,
            'series-tracker'
          );
          this.seriesTrackerExists.set(false);
          this.seriesTrackerHash.set(undefined);
          this.collectionService.triggerReload();
        }
      });
  }

  protected async onMarkAsUnwatched(): Promise<void> {
    if (!this.permissionWatch() || !this.watched()) return;
    this.spinnerLoadingState.setState('show', true);
    try {
      await firstValueFrom(
        this.api.deleteMovieTrackerItemByExternalId(
          this.collectionItem().externalProvider,
          this.collectionItem().externalItemId
        )
      );
      const updatedSource = { ...this.collectionItem(), watched: false };
      this.collectionService.deleteCollectionItem(
        { ...this.collectionItem(), listType: 'movie-tracker' },
        undefined,
        'movie-tracker'
      );
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

  protected async onMarkAsFavorite(): Promise<void> {
    if (!this.libraryItem() || this.collectionItem().favorite) return;
    await this.doSave({ ...this.buildItemFromForm(), favorite: true });
  }

  protected async onRemoveFavorite(): Promise<void> {
    if (!this.libraryItem()) return;
    await this.doSave({ ...this.buildItemFromForm(), favorite: false });
  }

  protected onManageSeriesMetadata(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    let collectionItem = this.collectionItem();
    const providerInputs =
      collectionItem.externalProvider === 'omdb'
        ? {}
        : { externalProvider: collectionItem.externalProvider, externalItemId: collectionItem.externalItemId };
    this.portal.openStacked(SeriesSeasonMetadataDialog, {
      imdbId: collectionItem.IMDbId,
      ...providerInputs,
      initialSeasons: this.seriesSeasons(),
      saved: (seasons: SeriesTrackerSeasonMetadataModel[], item?: CollectionItemModel) => {
        this.seriesSeasons.set(seasons);
        if (item) {
          collectionItem = item;
          this.applySyncedCollectionItem(item);
        }
        this.collectionService.triggerReload();
      },
    });
  }

  protected onManageWatchedEpisodes(): void {
    if (!this.seriesTracker() || !this.permissionUpdate()) return;
    let collectionItem = this.collectionItem();
    const providerInputs =
      collectionItem.externalProvider === 'omdb'
        ? {}
        : { externalProvider: collectionItem.externalProvider, externalItemId: collectionItem.externalItemId };
    this.portal.openStacked(WatchedEpisodesDialog, {
      imdbId: collectionItem.IMDbId,
      ...providerInputs,
      saved: (watchedEpisodes: SeriesTrackerWatchedEpisodeModel[], item?: CollectionItemModel) => {
        this.watchedEpisodes.set(watchedEpisodes);
        if (item) {
          collectionItem = item;
          this.applySyncedCollectionItem(item);
        }
        this.collectionService.triggerReload();
      },
    });
  }
}
