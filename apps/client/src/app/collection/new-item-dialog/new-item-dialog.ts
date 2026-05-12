import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { Checkbox } from '@components/checkbox/checkbox';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, debounceTime, filter, firstValueFrom, of, switchMap } from 'rxjs';
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
  private readonly knownIMDbIdExists = signal(false);
  private readonly knownIMDbIdValidationError = knownIMDbIdValidationFactory(this.knownIMDbIdExists);
  protected readonly translations = {
    titleNewCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.NewCollectionItem')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    messageNewCollectionItemSearch: computed(() =>
      this.ngxSignalTranslate.translate('Message.NewCollectionItemSearch')
    ),
    selectedContent: computed(() => this.ngxSignalTranslate.translate('SelectedContent')),
    validationKnownIMDbId: computed(() => this.ngxSignalTranslate.translate('Validation.KnownIMDbId')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    messageTags: computed(() => this.ngxSignalTranslate.translate('Message.Tags')),
    validationUsedInternalTag: computed(() => this.ngxSignalTranslate.translate('Validation.UsedInternalTag')),
    collectionItemWatched: computed(() => this.ngxSignalTranslate.translate('CollectionItemWatched')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    saveAndNew: computed(() => this.ngxSignalTranslate.translate('SaveAndNew')),
    saveAndClose: computed(() => this.ngxSignalTranslate.translate('SaveAndClose')),
  };
  protected readonly submitMode = signal<SaveMode | null>(null);
  protected readonly newItemModel = signal<NewItemModel>({
    searchText: '',
    selectedIMDbId: null,
    tags: '',
    watched: false,
  });
  protected readonly form = form(
    this.newItemModel,
    (newItem) => {
      required(newItem.searchText);
      required(newItem.selectedIMDbId);
      validate(newItem.selectedIMDbId, ({ value }) => this.knownIMDbIdValidationError(value()));
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
  };
  protected readonly matchedContent = this.service.matchedContent;

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

    toObservable(this.form.searchText().value)
      .pipe(
        debounceTime(500),
        filter((value) => !!value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((searchText) => this.service.search(searchText));

    toObservable(this.form.selectedIMDbId().value)
      .pipe(
        debounceTime(150),
        switchMap((imdbId) => (imdbId ? this.api.collectionItemExists(imdbId) : of({ exists: false }))),
        catchError(() => of({ exists: false })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => this.knownIMDbIdExists.set(response.exists));
  }

  private async onSave(mode: SaveMode | null = null): Promise<void> {
    const selectedIMDbId = this.form.selectedIMDbId().value();
    if (!selectedIMDbId) return;

    let tags = this.form.tags().value().trim();
    const watched = this.form.watched().value();
    if (watched) tags = tags ? `${tags} ${WATCHED_TAG}` : WATCHED_TAG;

    await firstValueFrom(this.service.save(selectedIMDbId, tags, mode));

    if (mode === 'new') {
      this.form().reset({
        searchText: '',
        selectedIMDbId: null,
        tags: '',
        watched: false,
      });
    } else {
      this.form.selectedIMDbId().reset(null);
    }
  }
}
