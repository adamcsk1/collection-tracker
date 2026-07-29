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
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { Checkbox } from '@components/checkbox/checkbox';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ExternalMetadataService } from '@services/external-metadata/external-metadata-service';
import { CollectionListTypeModel } from '@shared/models/api-model';
import { ExternalMetadataSelectDataModel } from '@shared/models/external-metadata-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, combineLatest, debounceTime, filter, firstValueFrom, of, switchMap } from 'rxjs';
import { mainStateToken } from '../../../main/main-store';
import { SharesLoaderService } from '../../../shares/shares-loader-service';
import { sharesStateToken } from '../../../shares/shares-store';
import { ListItemCard } from '../../list/list-item-card/list-item-card';
import { getProxyImageUrl } from '../../utils/proxy-image-url-util';
import { buildIMDbSearchUrl, buildWebSearchUrl } from '../item-dialog/utils/item-dialog-util';
import { NewItemModel, SaveMode, SaveOptions } from './new-item-dialog-model';
import { NewItemDialogService } from './new-item-dialog-service';
import { TagSuggestionService } from './suggestion/tag-suggestion-service';
import { knownIMDbIdValidationFactory } from './validators/known-imdb-id-validator';

@Component({
  selector: 'ct-new-item-dialog',
  imports: [FormField, FormRoot, Input, Select, DialogShell, Autocomplete, Checkbox, ListItemCard],
  templateUrl: './new-item-dialog.html',
  styleUrl: './new-item-dialog.css',
  providers: [
    ExternalMetadataService,
    NewItemDialogService,
    SharesLoaderService,
    { provide: AutocompleteService, useClass: TagSuggestionService },
  ],
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
  private readonly knownIMDbIdExists = signal(false);
  private readonly knownIMDbIdValidationError = knownIMDbIdValidationFactory(this.knownIMDbIdExists);
  protected readonly translations = {
    titleNewCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.NewCollectionItem')),
    titleNewWatchLaterItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWatchLaterItem')),
    titleNewWishlistItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWishlistItem')),
    titleNewSeriesTrackerItem: computed(() => this.ngxSignalTranslate.translate('Title.NewSeriesTrackerItem')),
    titleNewMovieTrackerItem: computed(() => this.ngxSignalTranslate.translate('Title.NewMovieTrackerItem')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    ariaSearchDuckDuckGoForTitleNewTab: computed(() =>
      this.ngxSignalTranslate.translate('Aria.SearchDuckDuckGoForTitleNewTab')
    ),
    ariaSearchIMDbForTitleNewTab: computed(() => this.ngxSignalTranslate.translate('Aria.SearchIMDbForTitleNewTab')),
    duckDuckGo: computed(() => this.ngxSignalTranslate.translate('DuckDuckGo')),
    imdb: computed(() => this.ngxSignalTranslate.translate('IMDb')),
    messageNewCollectionItemSearch: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearch')
    ),
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
    labelUserRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    validationKnownIMDbId: computed(() => this.ngxSignalTranslate.translate('Validation.KnownIMDbId')),
    validationUserRate: computed(() => this.ngxSignalTranslate.translate('Validation.UserRate')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    messageTags: computed(() => this.ngxSignalTranslate.translate('Message.Tags')),
    collectionItemWatched: computed(() => this.ngxSignalTranslate.translate('CollectionItemWatched')),
    copyToSeriesTrackerAsWatched: computed(() => this.ngxSignalTranslate.translate('CopyToSeriesTrackerAsWatched')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    saveAndNew: computed(() => this.ngxSignalTranslate.translate('SaveAndNew')),
    saveAndClose: computed(() => this.ngxSignalTranslate.translate('SaveAndClose')),
    library: computed(() => this.ngxSignalTranslate.translate('Library')),
    myLibrary: computed(() => this.ngxSignalTranslate.translate('MyLibrary')),
    sharedLibrary: computed(() => this.ngxSignalTranslate.translate('SharedLibrary')),
  };
  protected readonly submitMode = signal<SaveMode | null>(null);
  protected readonly newItemModel = signal<NewItemModel>({
    searchText: '',
    selectedExternalReference: null,
    userRate: null,
    tags: '',
    watched: false,
    copyToSeriesTrackerAsWatched: false,
    targetOwnerShareCode: null,
  });
  protected readonly form = form(
    this.newItemModel,
    (newItem) => {
      required(newItem.searchText);
      required(newItem.selectedExternalReference);
      validate(newItem.selectedExternalReference, ({ value }) => this.knownIMDbIdValidationError(value()));
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
  protected readonly formErrors = {
    selectedExternalReference: {
      knownIMDbId: computed(() =>
        this.form
          .selectedExternalReference()
          .errors()
          .some((error) => error.kind === 'knownIMDbId')
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
    },
  };
  protected readonly matchedContent = computed(() => {
    const matchedContent = this.service.matchedContent();
    return this.seriesTracker() || this.movieTracker()
      ? matchedContent.filter((content) => {
          if (`${content.text}`.toLowerCase().startsWith('imdb id:')) return true;
          return this.seriesTracker() ? content.contentType === 'series' : content.contentType === 'movie';
        })
      : matchedContent;
  });
  protected readonly completedSearchText = this.service.completedSearchText;
  protected readonly showExternalSearchLinks = computed(() => {
    const completedSearchText = this.completedSearchText();
    return !!completedSearchText && this.form.searchText().value().trim() === completedSearchText;
  });
  protected readonly imdbSearchUrl = computed(() => buildIMDbSearchUrl(this.completedSearchText()));
  protected readonly webSearchUrl = computed(() => buildWebSearchUrl(this.completedSearchText(), null));
  protected readonly selectedContentIsMovie = computed(() => {
    const selectedExternalReference = this.form.selectedExternalReference().value();
    if (!selectedExternalReference) return false;

    const selectedContent = this.matchedContent().find((content) => `${content.value}` === selectedExternalReference);
    const selectedContentText = `${selectedContent?.text ?? ''}`.toLowerCase();
    return selectedContent?.contentType === 'movie' || selectedContentText.startsWith('imdb id:');
  });
  protected readonly selectedContentIsSeries = computed(() => {
    const selectedExternalReference = this.form.selectedExternalReference().value();
    if (!selectedExternalReference) return false;

    const selectedContent = this.matchedContent().find((content) => `${content.value}` === selectedExternalReference);
    return selectedContent?.contentType === 'series';
  });
  protected readonly showWatchedCheckbox = computed(() => !this.internalListMode() && this.selectedContentIsMovie());
  protected readonly showCopyToSeriesTrackerCheckbox = computed(
    () => !this.internalListMode() && this.selectedContentIsSeries()
  );
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
  protected readonly showLibrarySelect = computed(() => !this.internalListMode() && this.libraryOptions().length > 1);
  protected readonly selectedExternalReference = computed(() => this.form.selectedExternalReference().value());
  private readonly defaultTargetOwnerShareCode = computed(() => {
    if (this.internalListMode()) return null;

    const defaultLibraryOwnerShareCode = this.mainState.state.defaultLibraryOwnerShareCode();
    if (!defaultLibraryOwnerShareCode) return null;

    return this.libraryOptions().some((option) => option.value === defaultLibraryOwnerShareCode)
      ? defaultLibraryOwnerShareCode
      : null;
  });
  public readonly watchLater = input(false);
  public readonly wishlist = input(false);
  public readonly seriesTracker = input(false);
  public readonly movieTracker = input(false);
  protected readonly internalListMode = computed(
    () => this.watchLater() || this.wishlist() || this.seriesTracker() || this.movieTracker()
  );
  protected readonly dialogTitle = computed(() => {
    if (this.watchLater()) return this.translations.titleNewWatchLaterItem();
    if (this.wishlist()) return this.translations.titleNewWishlistItem();
    if (this.seriesTracker()) return this.translations.titleNewSeriesTrackerItem();
    if (this.movieTracker()) return this.translations.titleNewMovieTrackerItem();
    return this.translations.titleNewCollectionItem();
  });
  private readonly listType = computed<CollectionListTypeModel>(() => {
    if (this.watchLater()) return 'watch-later';
    if (this.wishlist()) return 'wishlist';
    if (this.seriesTracker()) return 'series-tracker';
    if (this.movieTracker()) return 'movie-tracker';
    return 'library';
  });

  constructor() {
    effect(() => {
      const matchedContent = this.matchedContent();
      const selectedExternalReference = this.form.selectedExternalReference();

      if (matchedContent.length) {
        selectedExternalReference.value.set(`${matchedContent[0].value}`);
        selectedExternalReference.markAsTouched();
      } else {
        selectedExternalReference.reset(null);
      }
    });

    effect(() => {
      const defaultTargetOwnerShareCode = this.defaultTargetOwnerShareCode();
      const targetOwnerShareCode = untracked(() => this.form.targetOwnerShareCode().value());

      if (targetOwnerShareCode === null || targetOwnerShareCode === '') {
        this.form.targetOwnerShareCode().value.set(defaultTargetOwnerShareCode);
      }
    });

    toObservable(this.form.searchText().value)
      .pipe(
        debounceTime(500),
        filter((value) => !!value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((searchText) => this.service.search(searchText));

    combineLatest([
      toObservable(this.form.selectedExternalReference().value),
      toObservable(this.form.targetOwnerShareCode().value),
    ])
      .pipe(
        debounceTime(150),
        switchMap(([selectedExternalMetadataValue, targetOwnerShareCode]) => {
          const providerReference = this.service.getProviderReference(selectedExternalMetadataValue);
          if (!providerReference) return of({ exists: false });
          const ownerShareCode = targetOwnerShareCode || undefined;
          const listType = this.listType();
          return listType === 'library'
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
        }),
        catchError(() => of({ exists: false })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => this.knownIMDbIdExists.set(response.exists));

    this.sharesLoader.load(this.destroyRef, true);
  }

  protected onSearchEnter(event: Event): void {
    event.preventDefault();

    const searchText = this.form.searchText().value().trim();
    if (searchText) this.service.search(searchText);
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
    this.form.selectedExternalReference().value.set(`${content.value}`);
    this.form.selectedExternalReference().markAsTouched();
  }

  private async onSave(mode: SaveMode | null = null): Promise<void> {
    const selectedExternalReference = this.form.selectedExternalReference().value();
    if (!selectedExternalReference) return;

    const tags = this.form.tags().value().trim();

    const targetOwnerShareCode = this.internalListMode()
      ? undefined
      : this.form.targetOwnerShareCode().value() || undefined;
    const options: SaveOptions = {};
    if (targetOwnerShareCode) options.targetOwnerShareCode = targetOwnerShareCode;
    if (this.listType() !== 'library') options.listType = this.listType();
    if (this.showWatchedCheckbox()) options.watched = this.form.watched().value();
    if (this.showCopyToSeriesTrackerCheckbox())
      options.copyToSeriesTrackerAsWatched = this.form.copyToSeriesTrackerAsWatched().value();
    const saveRequest = this.service.save(
      selectedExternalReference,
      this.internalListMode() ? null : this.form.userRate().value(),
      tags,
      mode,
      options
    );
    await firstValueFrom(saveRequest);

    if (mode === 'new') {
      this.form().reset({
        searchText: '',
        selectedExternalReference: null,
        userRate: null,
        tags: '',
        watched: false,
        copyToSeriesTrackerAsWatched: false,
        targetOwnerShareCode: this.defaultTargetOwnerShareCode(),
      });
    } else {
      this.form.selectedExternalReference().reset(null);
    }
  }
}
