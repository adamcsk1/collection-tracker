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
import { OMDbService } from '@services/omdb/omdb-service';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { CollectionListTypeModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, combineLatest, debounceTime, filter, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { mainStateToken } from '../../main/main-store';
import { sharesStateToken } from '../../shares/shares-store';
import { NewItemModel, SaveMode } from './new-item-dialog-model';
import { NewItemDialogService } from './new-item-dialog-service';
import { TagSuggestionService } from './suggestion/tag-suggestion-service';
import { forbiddenInternalTagValidation } from './validators/internal-tag-validator';
import { knownIMDbIdValidationFactory } from './validators/known-imdb-id-validator';

@Component({
  selector: 'ct-new-item-dialog',
  imports: [FormField, FormRoot, Input, Select, DialogShell, Autocomplete, Checkbox],
  templateUrl: './new-item-dialog.html',
  styleUrl: './new-item-dialog.css',
  providers: [OMDbService, NewItemDialogService, { provide: AutocompleteService, useClass: TagSuggestionService }],
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewItemDialog {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly service = inject(NewItemDialogService);
  private readonly mainState = inject(mainStateToken);
  private readonly sharesState = inject(sharesStateToken);
  private readonly knownIMDbIdExists = signal(false);
  private readonly knownIMDbIdValidationError = knownIMDbIdValidationFactory(this.knownIMDbIdExists);
  protected readonly translations = {
    titleNewCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.NewCollectionItem')),
    titleNewWatchLaterItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWatchLaterItem')),
    titleNewWishlistItem: computed(() => this.ngxSignalTranslate.translate('Title.NewWishlistItem')),
    titleNewSeriesTrackerItem: computed(() => this.ngxSignalTranslate.translate('Title.NewSeriesTrackerItem')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    messageNewCollectionItemSearch: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearch')
    ),
    selectedContent: computed(() => this.ngxSignalTranslate.translate('SelectedContent')),
    labelUserRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    validationKnownIMDbId: computed(() => this.ngxSignalTranslate.translate('Validation.KnownIMDbId')),
    validationUserRate: computed(() => this.ngxSignalTranslate.translate('Validation.UserRate')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    messageTags: computed(() => this.ngxSignalTranslate.translate('Message.Tags')),
    validationUsedInternalTag: computed(() => this.ngxSignalTranslate.translate('Validation.UsedInternalTag')),
    collectionItemWatched: computed(() => this.ngxSignalTranslate.translate('CollectionItemWatched')),
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
    selectedIMDbId: null,
    userRate: null,
    tags: '',
    watched: false,
    targetOwnerShareCode: null,
  });
  protected readonly form = form(
    this.newItemModel,
    (newItem) => {
      required(newItem.searchText);
      required(newItem.selectedIMDbId);
      validate(newItem.selectedIMDbId, ({ value }) => this.knownIMDbIdValidationError(value()));
      min(newItem.userRate, 0, { error: { kind: 'min' } });
      max(newItem.userRate, 10, { error: { kind: 'max' } });
      validate(newItem.userRate, ({ value }) => {
        const userRate = value();
        if (userRate === null) return null;
        return Math.abs(userRate * 10 - Math.round(userRate * 10)) <= 1e-9 ? null : { kind: 'userRate' };
      });
      validate(newItem.tags, ({ value }) => forbiddenInternalTagValidation(value()));
    },
    {
      submission: {
        action: async () => this.onSave(this.submitMode()),
      },
    }
  );
  protected readonly formErrors = {
    selectedIMDbId: {
      knownIMDbId: computed(() =>
        this.form
          .selectedIMDbId()
          .errors()
          .some((error) => error.kind === 'knownIMDbId')
      ),
    },
    tags: {
      usedInternalTag: computed(() =>
        this.form
          .tags()
          .errors()
          .some((error) => error.kind === 'usedInternalTag')
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
    return this.seriesTracker()
      ? matchedContent.filter((content) => {
          const text = `${content.text}`.toLowerCase();
          return text.startsWith('(series)') || text.startsWith('imdb id:');
        })
      : matchedContent;
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
  protected readonly showLibrarySelect = computed(() => !this.internalListMode() && this.libraryOptions().length > 1);
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
  protected readonly internalListMode = computed(() => this.watchLater() || this.wishlist() || this.seriesTracker());
  protected readonly dialogTitle = computed(() =>
    this.watchLater()
      ? this.translations.titleNewWatchLaterItem()
      : this.wishlist()
        ? this.translations.titleNewWishlistItem()
        : this.seriesTracker()
          ? this.translations.titleNewSeriesTrackerItem()
          : this.translations.titleNewCollectionItem()
  );
  private readonly listType = computed<CollectionListTypeModel>(() =>
    this.watchLater()
      ? 'watch-later'
      : this.wishlist()
        ? 'wishlist'
        : this.seriesTracker()
          ? 'series-tracker'
          : 'library'
  );

  constructor() {
    effect(() => {
      const matchedContent = this.matchedContent();
      const selectedIMDbId = this.form.selectedIMDbId();

      if (matchedContent.length) {
        selectedIMDbId.value.set(`${matchedContent[0].value}`);
        selectedIMDbId.markAsTouched();
      } else {
        selectedIMDbId.reset(null);
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
      toObservable(this.form.selectedIMDbId().value),
      toObservable(this.form.targetOwnerShareCode().value),
    ])
      .pipe(
        debounceTime(150),
        switchMap(([imdbId, targetOwnerShareCode]) => {
          if (!imdbId) return of({ exists: false });
          const ownerShareCode = targetOwnerShareCode || undefined;
          const listType = this.listType();
          return listType === 'library'
            ? this.api.collectionItemExists(imdbId, ownerShareCode)
            : this.api.collectionItemExists(imdbId, ownerShareCode, listType);
        }),
        catchError(() => of({ exists: false })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => this.knownIMDbIdExists.set(response.exists));

    this.api
      .getShares()
      .pipe(
        tap((result) => {
          this.sharesState.setState('loaded', true);
          this.sharesState.setState('userShareCode', result.userShareCode);
          this.sharesState.setState('outgoing', result.outgoing);
          this.sharesState.setState('incoming', result.incoming);
        }),
        catchError(() => {
          this.sharesState.setState('loaded', true);
          return of({ userShareCode: '', outgoing: [], incoming: [] });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private async onSave(mode: SaveMode | null = null): Promise<void> {
    const selectedIMDbId = this.form.selectedIMDbId().value();
    if (!selectedIMDbId) return;

    let tags = this.form.tags().value().trim();
    const watched = !this.internalListMode() && this.form.watched().value();
    if (watched) tags = tags ? `${tags} ${WATCHED_TAG}` : WATCHED_TAG;

    const targetOwnerShareCode = this.internalListMode()
      ? undefined
      : this.form.targetOwnerShareCode().value() || undefined;
    const saveRequest = this.service.save(
      selectedIMDbId,
      this.internalListMode() ? null : this.form.userRate().value(),
      tags,
      mode,
      targetOwnerShareCode,
      this.listType() === 'library' ? undefined : this.listType()
    );
    await firstValueFrom(saveRequest);

    if (mode === 'new') {
      this.form().reset({
        searchText: '',
        selectedIMDbId: null,
        userRate: null,
        tags: '',
        watched: false,
        targetOwnerShareCode: this.defaultTargetOwnerShareCode(),
      });
    } else {
      this.form.selectedIMDbId().reset(null);
    }
  }
}
