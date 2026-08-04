import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, max, min, required, validate } from '@angular/forms/signals';
import { Autocomplete } from '@components/autocomplete/autocomplete';
import { Checkbox } from '@components/checkbox/checkbox';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { Select } from '@components/select/select';
import { TabOption, Tabs } from '@components/tabs/tabs';
import { Textarea } from '@components/textarea/textarea';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ExternalMetadataService } from '@services/external-metadata/external-metadata-service';
import { CollectionItemContentTypeModel, CollectionListTypeModel } from '@shared/models/api-model';
import { ExternalMetadataSelectDataModel } from '@shared/models/external-metadata-model';
import { isImdbShapedExternalItemId } from '@shared/utils/external-metadata-identity-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, combineLatest, debounceTime, filter, firstValueFrom, of, switchMap, tap, timer } from 'rxjs';
import { mainStateToken } from '../../../main/main-store';
import { SharesLoaderService } from '../../../shares/shares-loader-service';
import { sharesStateToken } from '../../../shares/shares-store';
import { ListItemCard } from '../../list/list-item-card/list-item-card';
import { getProxyImageUrl } from '../../utils/proxy-image-url-util';
import { ItemFormModel } from '../item-form/item-form-model';
import {
  isImdbIdValid,
  isIsbnValid,
  validateOptionalIMDbRateFormat,
  validateOptionalMetacriticRateFormat,
  validateOptionalRottenTomatoesRateFormat,
} from '../item-form/item-form-util';
import { normalizeIsbn13 } from '@shared/utils/isbn-util';
import { GenreSuggestionsProvider, TagSuggestionsProvider } from '../item-form/suggestion/item-autocomplete-providers';
import { buildIMDbSearchUrl, buildWebSearchUrl } from '../item-dialog/utils/item-dialog-util';
import { NewItemDialogService } from './new-item-dialog-service';
import { NewItemMode, NewItemSearchModel, SaveMode, SaveOptions } from './new-item-dialog-model';
import { knownIMDbIdValidationFactory } from './validators/known-imdb-id-validator';

const defaultSearchModel = (): NewItemSearchModel => ({
  searchText: '',
  selectedExternalReference: null,
  userRate: null,
  tags: '',
  watched: false,
  copyToTrackingAsWatched: false,
  targetOwnerShareCode: null,
});

const defaultManualModel = (): ItemFormModel => ({
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

@Component({
  selector: 'ct-new-item-dialog',
  imports: [
    FormField,
    FormRoot,
    Input,
    Select,
    DialogShell,
    Autocomplete,
    Checkbox,
    ListItemCard,
    Textarea,
    RevealLabel,
    Tabs,
    GenreSuggestionsProvider,
    TagSuggestionsProvider,
  ],
  templateUrl: './new-item-dialog.html',
  styleUrl: './new-item-dialog.css',
  providers: [ExternalMetadataService, NewItemDialogService, SharesLoaderService],
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewItemDialog {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly service = inject(NewItemDialogService);
  private readonly mainState = inject(mainStateToken);
  private readonly sharesState = inject(sharesStateToken);
  private readonly sharesLoader = inject(SharesLoaderService);
  private readonly knownSearchIMDbIdExists = signal(false);
  private readonly knownManualIMDbIdExists = signal(false);
  private readonly searchIMDbIdLookupPending = signal(false);
  private readonly manualIMDbIdLookupPending = signal(false);
  private readonly knownSearchIMDbIdValidationError = knownIMDbIdValidationFactory(this.knownSearchIMDbIdExists);
  private readonly knownManualIMDbIdValidationError = knownIMDbIdValidationFactory(this.knownManualIMDbIdExists);
  protected readonly translations = {
    titleNewCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.NewCollectionItem')),
    titleNewWatchlistItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWatchlistItem')),
    titleNewWishlistItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWishlistItem')),
    titleNewTrackingItem: computed(() => this.ngxSignalTranslate.translate('Title.NewTrackingItem')),
    titleNewWatchedItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWatchedItem')),
    titleNewBooksItem: computed(() => this.ngxSignalTranslate.translate('Title.NewBooksItem')),
    books: computed(() => this.ngxSignalTranslate.translate('Books')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    manual: computed(() => this.ngxSignalTranslate.translate('Manual')),
    ariaNewItemEntryMethod: computed(() => this.ngxSignalTranslate.translate('Aria.NewItemEntryMethod')),
    manualModeHint: computed(() => this.ngxSignalTranslate.translate('Message.NewCollectionItemManual')),
    messageTags: computed(() => this.ngxSignalTranslate.translate('Message.Tags')),
    ariaSearchDuckDuckGoForTitleNewTab: computed(() =>
      this.ngxSignalTranslate.translate('Aria.SearchDuckDuckGoForTitleNewTab')
    ),
    ariaSearchIMDbForTitleNewTab: computed(() => this.ngxSignalTranslate.translate('Aria.SearchIMDbForTitleNewTab')),
    duckDuckGo: computed(() => this.ngxSignalTranslate.translate('DuckDuckGo')),
    imdb: computed(() => this.ngxSignalTranslate.translate('IMDb')),
    messageNewCollectionItemSearch: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearch')
    ),
    messageNewBooksItemSearch: computed(() => this.ngxSignalTranslate.translate('Message.NewBooksItemSearch')),
    messageNewCollectionItemSearchHelpEnd: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearchHelpEnd')
    ),
    messageNewCollectionItemSearchHelpMiddle: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearchHelpMiddle')
    ),
    messageNewCollectionItemSearchHelpStart: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearchHelpStart')
    ),
    selectedContent: computed(() => this.ngxSignalTranslate.translate('SelectedContent')),
    labelTitle: computed(() => this.ngxSignalTranslate.translate('Title')),
    labelIMDbId: computed(() => this.ngxSignalTranslate.translate('IMDbId')),
    isbn: computed(() => this.ngxSignalTranslate.translate('ISBN')),
    labelYear: computed(() => this.ngxSignalTranslate.translate('Year')),
    labelIMDbRate: computed(() => this.ngxSignalTranslate.translate('IMDbRate')),
    labelMetacriticRate: computed(() => this.ngxSignalTranslate.translate('Metacritic')),
    labelRottenTomatoesRate: computed(() => this.ngxSignalTranslate.translate('RottenTomatoes')),
    labelUserRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    labelImageUrl: computed(() => this.ngxSignalTranslate.translate('ImageUrl')),
    altImageExample: computed(() => this.ngxSignalTranslate.translate('Alt.ImageExample')),
    genre: computed(() => this.ngxSignalTranslate.translate('Genre')),
    subjects: computed(() => this.ngxSignalTranslate.translate('Subjects')),
    hintSeparateGenres: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateGenres')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    hintSeparateTags: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateTags')),
    actors: computed(() => this.ngxSignalTranslate.translate('Actors')),
    authors: computed(() => this.ngxSignalTranslate.translate('Authors')),
    plot: computed(() => this.ngxSignalTranslate.translate('Plot')),
    description: computed(() => this.ngxSignalTranslate.translate('Description')),
    type: computed(() => this.ngxSignalTranslate.translate('Type')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    seriesLabel: computed(() => this.ngxSignalTranslate.translate('Series')),
    validationKnownIMDbId: computed(() => this.ngxSignalTranslate.translate('Validation.KnownIMDbId')),
    validationKnownISBN: computed(() => this.ngxSignalTranslate.translate('Validation.KnownISBN')),
    validationIMDbId: computed(() => this.ngxSignalTranslate.translate('Validation.IMDbId')),
    validationISBN: computed(() => this.ngxSignalTranslate.translate('Validation.ISBN')),
    validationRequired: computed(() => this.ngxSignalTranslate.translate('Validation.Required')),
    validationIMDbRate: computed(() => this.ngxSignalTranslate.translate('Validation.IMDbRate')),
    validationMetacriticRate: computed(() => this.ngxSignalTranslate.translate('Validation.MetacriticRate')),
    validationRottenTomatoesRate: computed(() => this.ngxSignalTranslate.translate('Validation.RottenTomatoesRate')),
    validationUserRate: computed(() => this.ngxSignalTranslate.translate('Validation.UserRate')),
    collectionItemWatched: computed(() => this.ngxSignalTranslate.translate('CollectionItemFinished')),
    copyToTrackingAsWatched: computed(() => this.ngxSignalTranslate.translate('CopyToTrackingAsWatched')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    saveAndNew: computed(() => this.ngxSignalTranslate.translate('SaveAndNew')),
    saveAndClose: computed(() => this.ngxSignalTranslate.translate('SaveAndClose')),
    library: computed(() => this.ngxSignalTranslate.translate('Library')),
    myLibrary: computed(() => this.ngxSignalTranslate.translate('MyLibrary')),
    sharedLibrary: computed(() => this.ngxSignalTranslate.translate('SharedLibrary')),
  };
  protected readonly modeTabs = computed<readonly [TabOption<NewItemMode>, TabOption<NewItemMode>]>(() => [
    { value: 'search', label: this.translations.search(), dataTestId: 'new-item-search-mode' },
    {
      value: 'manual',
      label: this.translations.manual(),
      dataTestId: 'new-item-manual-mode',
    },
  ]);
  protected readonly submitMode = signal<SaveMode | null>(null);
  protected readonly mode = signal<NewItemMode>('search');
  protected readonly searchModel = signal<NewItemSearchModel>(defaultSearchModel());
  protected readonly manualModel = signal<ItemFormModel>(defaultManualModel());
  protected readonly searchForm = form(
    this.searchModel,
    (newItem) => {
      required(newItem.searchText);
      required(newItem.selectedExternalReference);
      validate(newItem.selectedExternalReference, ({ value }) => this.knownSearchIMDbIdValidationError(value()));
      validate(newItem.selectedExternalReference, () =>
        this.searchIMDbIdLookupPending() ? { kind: 'pending' } : undefined
      );
      min(newItem.userRate, 0, { error: { kind: 'min' } });
      max(newItem.userRate, 10, { error: { kind: 'max' } });
      validate(newItem.userRate, ({ value }) => {
        const userRate = value();
        if (userRate === null) return null;
        return Math.abs(userRate * 10 - Math.round(userRate * 10)) <= 1e-9 ? null : { kind: 'userRate' };
      });
    },
    {
      submission: {
        action: async () => this.onSave(this.submitMode()),
      },
    }
  );
  protected readonly manualForm = form(
    this.manualModel,
    (manualItem) => {
      validate(manualItem.title, ({ value }) => (value()?.trim() ? undefined : { kind: 'required' }));
      validate(manualItem.IMDbId, ({ value }) => {
        const identity = value()?.trim() ?? '';
        if (!identity) return { kind: 'required' };
        if (this.isBookAdd()) return isIsbnValid(identity) ? undefined : { kind: 'isbn' };
        return isImdbIdValid(identity) ? undefined : { kind: 'imdbId' };
      });
      validate(manualItem.IMDbId, ({ value }) => this.knownManualIMDbIdValidationError(value()));
      validate(manualItem.IMDbId, () => (this.manualIMDbIdLookupPending() ? { kind: 'pending' } : undefined));
      validate(manualItem.rate, ({ value }) =>
        this.isBookAdd() ? undefined : validateOptionalIMDbRateFormat(value())
      );
      validate(manualItem.rottenTomatoesRate, ({ value }) =>
        this.isBookAdd() ? undefined : validateOptionalRottenTomatoesRateFormat(value())
      );
      validate(manualItem.metacriticRate, ({ value }) =>
        this.isBookAdd() ? undefined : validateOptionalMetacriticRateFormat(value())
      );
      min(manualItem.userRate, 0, { error: { kind: 'min' } });
      max(manualItem.userRate, 10, { error: { kind: 'max' } });
      validate(manualItem.userRate, ({ value }) => {
        const userRate = value();
        if (userRate === null) return undefined;
        return Math.abs(userRate * 10 - Math.round(userRate * 10)) <= 1e-9 ? undefined : { kind: 'userRate' };
      });
    },
    {
      submission: {
        action: async () => this.onSave(this.submitMode()),
      },
    }
  );
  protected readonly searchFormErrors = {
    selectedExternalReference: {
      knownIMDbId: computed(() =>
        this.searchForm
          .selectedExternalReference()
          .errors()
          .some((error) => error.kind === 'knownIMDbId')
      ),
    },
    userRate: {
      min: computed(() =>
        this.searchForm
          .userRate()
          .errors()
          .some((error) => error.kind === 'min')
      ),
      max: computed(() =>
        this.searchForm
          .userRate()
          .errors()
          .some((error) => error.kind === 'max')
      ),
    },
  };
  protected readonly manualFormErrors = {
    title: {
      required: computed(() =>
        this.manualForm
          .title()
          .errors()
          .some((error) => error.kind === 'required')
      ),
    },
    IMDbId: {
      required: computed(() =>
        this.manualForm
          .IMDbId()
          .errors()
          .some((error) => error.kind === 'required')
      ),
      imdbId: computed(() =>
        this.manualForm
          .IMDbId()
          .errors()
          .some((error) => error.kind === 'imdbId')
      ),
      isbn: computed(() =>
        this.manualForm
          .IMDbId()
          .errors()
          .some((error) => error.kind === 'isbn')
      ),
      knownIMDbId: computed(() =>
        this.manualForm
          .IMDbId()
          .errors()
          .some((error) => error.kind === 'knownIMDbId')
      ),
    },
    rate: {
      rateFormat: computed(() =>
        this.manualForm
          .rate()
          .errors()
          .some((error) => error.kind === 'rateFormat')
      ),
    },
    rottenTomatoesRate: {
      rateFormat: computed(() =>
        this.manualForm
          .rottenTomatoesRate()
          .errors()
          .some((error) => error.kind === 'rateFormat')
      ),
    },
    metacriticRate: {
      rateFormat: computed(() =>
        this.manualForm
          .metacriticRate()
          .errors()
          .some((error) => error.kind === 'rateFormat')
      ),
    },
    userRate: {
      min: computed(() =>
        this.manualForm
          .userRate()
          .errors()
          .some((error) => error.kind === 'min')
      ),
      max: computed(() =>
        this.manualForm
          .userRate()
          .errors()
          .some((error) => error.kind === 'max')
      ),
      userRate: computed(() =>
        this.manualForm
          .userRate()
          .errors()
          .some((error) => error.kind === 'userRate')
      ),
    },
  };
  protected readonly form = computed(() => (this.mode() === 'manual' ? this.manualForm() : this.searchForm()));
  public readonly watchlist = input(false);
  public readonly wishlist = input(false);
  public readonly tracking = input(false);
  public readonly finished = input(false);
  public readonly books = input(false);
  public readonly allowedContentTypes = input<readonly CollectionItemContentTypeModel[]>([]);
  protected readonly selectedAddContentType = signal<CollectionItemContentTypeModel>('movie');
  protected readonly resolvedAllowedContentTypes = computed(() => {
    const allowed = this.allowedContentTypes();
    if (allowed.length) return allowed;
    if (this.books()) return ['book'] as const;
    if (this.tracking()) {
      return this.mainState.state.collectionFeaturePreferences().books
        ? (['series', 'book'] as const)
        : (['series'] as const);
    }
    if (this.finished()) {
      return this.mainState.state.collectionFeaturePreferences().books
        ? (['movie', 'book'] as const)
        : (['movie'] as const);
    }
    const types: CollectionItemContentTypeModel[] = ['movie', 'series'];
    if (this.mainState.state.collectionFeaturePreferences().books) types.push('book');
    return types;
  });
  protected readonly isBookAdd = computed(
    () => this.books() || this.selectedAddContentType() === 'book' || this.manualForm.contentType().value() === 'book'
  );
  protected readonly matchedContent = computed(() => {
    const matchedContent = this.service.matchedContent();
    const selectedType = this.selectedAddContentType();
    return matchedContent.filter((content) => {
      if (`${content.text}`.toLowerCase().startsWith('imdb id:')) return selectedType !== 'book';
      if (!content.contentType) return true;
      return content.contentType === selectedType;
    });
  });
  protected readonly completedSearchText = this.service.completedSearchText;
  protected readonly showExternalSearchLinks = computed(() => {
    if (this.mode() !== 'search' || this.isBookAdd()) return false;
    const completedSearchText = this.completedSearchText();
    return !!completedSearchText && this.searchForm.searchText().value().trim() === completedSearchText;
  });
  protected readonly imdbSearchUrl = computed(() => buildIMDbSearchUrl(this.completedSearchText()));
  protected readonly webSearchUrl = computed(() => buildWebSearchUrl(this.completedSearchText(), null));
  protected readonly selectedContentIsMovie = computed(() => {
    const selectedExternalReference = this.searchForm.selectedExternalReference().value();
    if (!selectedExternalReference) return false;

    const selectedContent = this.matchedContent().find((content) => `${content.value}` === selectedExternalReference);
    const selectedContentText = `${selectedContent?.text ?? ''}`.toLowerCase();
    return selectedContent?.contentType === 'movie' || selectedContentText.startsWith('imdb id:');
  });
  protected readonly searchHint = computed(() =>
    this.isBookAdd()
      ? this.translations.messageNewBooksItemSearch()
      : this.translations.messageNewCollectionItemSearch()
  );
  protected readonly selectedContentIsSeries = computed(() => {
    const selectedExternalReference = this.searchForm.selectedExternalReference().value();
    if (!selectedExternalReference) return false;

    const selectedContent = this.matchedContent().find((content) => `${content.value}` === selectedExternalReference);
    return selectedContent?.contentType === 'series';
  });
  protected readonly activeAddContentType = computed(() =>
    this.mode() === 'manual' ? this.manualForm.contentType().value() : this.selectedAddContentType()
  );
  protected readonly showWatchedCheckbox = computed(() => {
    if (this.internalListMode() || !this.mainState.state.collectionFeaturePreferences().finished) return false;
    if (this.activeAddContentType() !== 'movie') return false;
    return this.mode() === 'manual' || !!this.searchForm.selectedExternalReference().value();
  });
  protected readonly showCopyToTrackingCheckbox = computed(() => {
    if (this.internalListMode() || !this.mainState.state.collectionFeaturePreferences().tracking) return false;
    if (this.activeAddContentType() !== 'series') return false;
    return this.mode() === 'manual' || !!this.searchForm.selectedExternalReference().value();
  });
  protected readonly libraryOptions = computed(() => {
    const options = [{ text: this.translations.myLibrary(), value: '' }];
    for (const share of this.sharesState.state.incoming()) {
      if (share.canCreate) {
        options.push({
          text: `${this.translations.sharedLibrary()} (${share.ownerUsername ?? share.ownerUserShareCode})`,
          value: share.ownerUserShareCode,
        });
      }
    }
    return options;
  });
  protected readonly showLibrarySelect = computed(
    () => !this.internalListMode() && !this.isBookAdd() && this.libraryOptions().length > 1
  );
  protected readonly selectedExternalReference = computed(() => this.searchForm.selectedExternalReference().value());
  private readonly defaultTargetOwnerShareCode = computed(() => {
    if (this.internalListMode()) return null;

    const defaultLibraryOwnerShareCode = this.mainState.state.defaultLibraryOwnerShareCode();
    if (!defaultLibraryOwnerShareCode) return null;

    return this.libraryOptions().some((option) => option.value === defaultLibraryOwnerShareCode)
      ? defaultLibraryOwnerShareCode
      : null;
  });
  protected readonly draftImageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.manualForm.image().value())
  );
  protected readonly contentTypeOptions = computed(() =>
    this.resolvedAllowedContentTypes().map((contentType) => ({
      text:
        contentType === 'movie'
          ? this.translations.movies()
          : contentType === 'series'
            ? this.translations.seriesLabel()
            : this.translations.books(),
      value: contentType,
    }))
  );
  protected readonly showContentTypeSelect = computed(() => this.resolvedAllowedContentTypes().length > 1);
  protected readonly showManualUserRate = computed(() => !this.internalListMode());
  protected readonly internalListMode = computed(
    () => this.watchlist() || this.wishlist() || this.tracking() || this.finished() || this.books()
  );
  protected readonly dialogTitle = computed(() => {
    if (this.watchlist()) return this.translations.titleNewWatchlistItem();
    if (this.wishlist()) return this.translations.titleNewWishlistItem();
    if (this.tracking()) return this.translations.titleNewTrackingItem();
    if (this.finished()) return this.translations.titleNewWatchedItem();
    if (this.books() || this.selectedAddContentType() === 'book') return this.translations.titleNewBooksItem();
    return this.translations.titleNewCollectionItem();
  });
  protected readonly dialogIcon = computed(() => {
    const contentType = this.selectedAddContentType();
    if (contentType === 'book') return 'menu_book';
    if (contentType === 'series') return 'live_tv';
    if (contentType === 'movie') return 'movie';
    return 'add_photo_alternate';
  });
  private readonly listType = computed<CollectionListTypeModel>(() => {
    if (this.watchlist()) return 'watchlist';
    if (this.wishlist()) return 'wishlist';
    if (this.tracking()) return 'tracking';
    if (this.finished()) return 'finished';
    if (this.books() || this.selectedAddContentType() === 'book') return 'books';
    return 'library';
  });

  constructor() {
    effect(() => {
      const matchedContent = this.matchedContent();
      const selectedExternalReference = this.searchForm.selectedExternalReference();

      if (matchedContent.length) {
        selectedExternalReference.value.set(`${matchedContent[0].value}`);
        selectedExternalReference.markAsTouched();
      } else {
        selectedExternalReference.reset(null);
      }
    });

    effect(() => {
      const defaultTargetOwnerShareCode = this.defaultTargetOwnerShareCode();
      const targetOwnerShareCode = untracked(() => this.searchForm.targetOwnerShareCode().value());

      if (targetOwnerShareCode === null || targetOwnerShareCode === '') {
        this.searchForm.targetOwnerShareCode().value.set(defaultTargetOwnerShareCode);
      }
    });

    effect(() => {
      const allowed = this.resolvedAllowedContentTypes();
      const current = untracked(() => this.selectedAddContentType());
      if (!allowed.includes(current)) {
        this.selectedAddContentType.set(allowed[0] ?? 'movie');
      }
    });

    effect(() => {
      const contentType = this.selectedAddContentType();
      untracked(() => {
        if (this.manualForm.contentType().value() !== contentType) {
          this.manualForm.contentType().value.set(contentType);
        }
      });
    });

    effect(() => {
      const manualType = this.manualForm.contentType().value();
      if (manualType !== 'movie' && manualType !== 'series' && manualType !== 'book') return;
      if (!this.resolvedAllowedContentTypes().includes(manualType)) return;
      if (this.selectedAddContentType() === manualType) return;
      this.selectedAddContentType.set(manualType);
    });

    combineLatest([
      toObservable(this.searchForm.searchText().value),
      toObservable(this.mode),
      toObservable(this.selectedAddContentType),
    ])
      .pipe(
        debounceTime(500),
        filter(([searchText, mode]) => mode === 'search' && !!searchText),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(([searchText, mode, contentType]) => {
        if (mode !== 'search' || this.mode() !== 'search' || !searchText) return;
        this.service.search(searchText, contentType === 'book' ? 'openlibrary' : 'omdb');
      });

    combineLatest([
      toObservable(this.mode),
      toObservable(this.searchForm.selectedExternalReference().value),
      toObservable(this.searchForm.targetOwnerShareCode().value),
      toObservable(this.listType),
    ])
      .pipe(
        tap(([mode, selectedExternalMetadataValue]) => {
          const providerReference = this.service.getProviderReference(selectedExternalMetadataValue);
          this.searchIMDbIdLookupPending.set(mode === 'search' && !!providerReference);
        }),
        switchMap(([mode, selectedExternalMetadataValue, targetOwnerShareCode, listType]) => {
          if (mode !== 'search') return of({ exists: false });
          const providerReference = this.service.getProviderReference(selectedExternalMetadataValue);
          if (!providerReference) return of({ exists: false });
          const ownerShareCode = targetOwnerShareCode || undefined;
          return timer(150).pipe(
            switchMap(() => {
              const exists$ =
                listType === 'library'
                  ? this.api.collectionItemExists(
                      providerReference.identitySource,
                      providerReference.identityId,
                      ownerShareCode,
                      undefined,
                      providerReference.externalIds
                    )
                  : this.api.collectionItemExists(
                      providerReference.identitySource,
                      providerReference.identityId,
                      ownerShareCode,
                      listType,
                      providerReference.externalIds
                    );
              return exists$.pipe(catchError(() => of({ exists: false })));
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.searchIMDbIdLookupPending.set(false);
        this.knownSearchIMDbIdExists.set(response.exists);
      });

    combineLatest([
      toObservable(this.mode),
      toObservable(this.manualForm.IMDbId().value),
      toObservable(this.searchForm.targetOwnerShareCode().value),
      toObservable(this.listType),
    ])
      .pipe(
        tap(([mode, identity, , listType]) => {
          const hasIdentity = listType === 'books' ? isIsbnValid(identity) : isImdbShapedExternalItemId(identity);
          this.manualIMDbIdLookupPending.set(mode === 'manual' && hasIdentity);
        }),
        switchMap(([mode, identity, targetOwnerShareCode, listType]) => {
          if (mode !== 'manual') return of({ exists: false });
          if (listType === 'books') {
            const isbn = normalizeIsbn13(identity);
            if (!isbn) return of({ exists: false });
            return timer(150).pipe(
              switchMap(() =>
                this.api
                  .collectionItemExists('openlibrary', isbn, targetOwnerShareCode || undefined, listType, [
                    { source: 'isbn', id: isbn },
                  ])
                  .pipe(catchError(() => of({ exists: false })))
              )
            );
          }
          if (!isImdbShapedExternalItemId(identity)) return of({ exists: false });
          return timer(150).pipe(
            switchMap(() =>
              this.api
                .collectionItemExists('omdb', identity.trim(), targetOwnerShareCode || undefined, listType, [
                  { source: 'imdb', id: identity.trim() },
                ])
                .pipe(catchError(() => of({ exists: false })))
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.manualIMDbIdLookupPending.set(false);
        this.knownManualIMDbIdExists.set(response.exists);
      });

    this.sharesLoader.load(this.destroyRef, true);
  }

  protected onSearchEnter(event: Event): void {
    event.preventDefault();

    const searchText = this.searchForm.searchText().value().trim();
    if (searchText) {
      this.service.search(searchText, this.selectedAddContentType() === 'book' ? 'openlibrary' : 'omdb');
    }
  }

  protected onAddContentTypeChange(contentType: string | number | boolean | null): void {
    if (contentType !== 'movie' && contentType !== 'series' && contentType !== 'book') return;
    if (contentType === this.selectedAddContentType()) return;
    this.selectedAddContentType.set(contentType);
    this.searchForm.selectedExternalReference().reset(null);
    const searchText = this.searchForm.searchText().value().trim();
    if (this.mode() === 'search' && searchText) {
      this.service.search(searchText, contentType === 'book' ? 'openlibrary' : 'omdb');
    }
  }

  protected onModeChange(newMode: NewItemMode): void {
    if (this.mode() === newMode) return;
    this.mode.set(newMode);
    this.knownSearchIMDbIdExists.set(false);
    this.knownManualIMDbIdExists.set(false);
    const providerReference = this.service.getProviderReference(this.searchForm.selectedExternalReference().value());
    this.searchIMDbIdLookupPending.set(newMode === 'search' && !!providerReference);
    const manualIdentity = this.manualForm.IMDbId().value();
    this.manualIMDbIdLookupPending.set(
      newMode === 'manual' &&
        (this.isBookAdd() ? isIsbnValid(manualIdentity) : isImdbShapedExternalItemId(manualIdentity))
    );
  }

  protected getMatchedContentImageUrl(content: ExternalMetadataSelectDataModel): string {
    return getProxyImageUrl(this.apiState.state.apiUrl(), content.poster ?? '');
  }

  protected getMatchedContentMeta(content: ExternalMetadataSelectDataModel): string | null {
    if (content.contentType && content.year) return `(${content.contentType}) ${content.year}`;
    if (content.contentType) return `(${content.contentType})`;
    return content.year ?? null;
  }

  protected isMatchedContentSelected(content: ExternalMetadataSelectDataModel): boolean {
    return `${content.value}` === this.selectedExternalReference();
  }

  protected onSelectMatchedContent(content: ExternalMetadataSelectDataModel): void {
    this.searchForm.selectedExternalReference().value.set(`${content.value}`);
    this.searchForm.selectedExternalReference().markAsTouched();
  }

  private async onSave(mode: SaveMode | null = null): Promise<void> {
    const options: SaveOptions = {};
    const targetOwnerShareCode =
      this.internalListMode() || this.isBookAdd()
        ? undefined
        : this.searchForm.targetOwnerShareCode().value() || undefined;
    if (targetOwnerShareCode) options.targetOwnerShareCode = targetOwnerShareCode;
    if (this.listType() !== 'library') options.listType = this.listType();
    if (this.showWatchedCheckbox() && this.searchForm.watched().value()) options.watched = true;
    if (this.showCopyToTrackingCheckbox()) {
      options.copyToTrackingAsWatched = this.searchForm.copyToTrackingAsWatched().value();
    }

    if (this.mode() === 'manual') {
      const manualValues = this.manualForm().value();
      const contentType = this.selectedAddContentType();
      const saveRequest = this.service.saveManual(
        {
          ...manualValues,
          contentType,
          userRate: this.internalListMode() ? null : manualValues.userRate,
        },
        mode,
        options
      );
      await firstValueFrom(saveRequest);

      if (mode === 'new') {
        this.manualForm().reset(defaultManualModel());
        this.searchForm.watched().reset(false);
        this.searchForm.copyToTrackingAsWatched().reset(false);
      } else {
        this.manualForm.IMDbId().reset('');
      }
      this.knownManualIMDbIdExists.set(false);
      return;
    }

    const selectedExternalReference = this.searchForm.selectedExternalReference().value();
    if (!selectedExternalReference) return;

    const tags = this.searchForm.tags().value().trim();

    const saveRequest = this.service.save(
      selectedExternalReference,
      this.internalListMode() ? null : this.searchForm.userRate().value(),
      tags,
      mode,
      options
    );
    await firstValueFrom(saveRequest);

    if (mode === 'new') {
      this.searchForm().reset({
        ...defaultSearchModel(),
        targetOwnerShareCode: this.defaultTargetOwnerShareCode(),
      });
    } else {
      this.searchForm.selectedExternalReference().reset(null);
    }
  }
}
