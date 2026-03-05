import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';
import { NewItemModel, SaveMode } from '@client/collection/new-item-dialog/new-item-dialog-model';
import { NewItemDialogService } from '@client/collection/new-item-dialog/new-item-dialog-service';
import { TagSuggestionService } from '@client/collection/new-item-dialog/suggestion/tag-suggestion-service';
import { knownIMDbIdValidationFactory } from '@client/collection/new-item-dialog/validators/known-imdb-id-validator';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { debounceTime, firstValueFrom } from 'rxjs';

@Component({
  selector: 'ct-new-item-dialog',
  imports: [FormField, FormRoot, NgxSignalTranslatePipe, Input, Select, DialogShell, Autocomplete],
  templateUrl: './new-item-dialog.html',
  styleUrl: './new-item-dialog.css',
  providers: [
    OMDbService,
    MdContentGeneratorService,
    NewItemDialogService,
    { provide: AutocompleteService, useClass: TagSuggestionService },
  ],
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewItemDialog {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(NewItemDialogService);
  private readonly knownIMDbIdValidationError = knownIMDbIdValidationFactory();
  protected readonly submitMode = signal<SaveMode | null>(null);
  protected readonly newItemModel = signal<NewItemModel>({
    searchText: '',
    selectedIMDbId: null,
    tags: '',
  });
  protected readonly form = form(
    this.newItemModel,
    (newItem) => {
      required(newItem.searchText);
      required(newItem.selectedIMDbId);
      validate(newItem.selectedIMDbId, ({ value }) => this.knownIMDbIdValidationError(value()));
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
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((searchText) => this.service.search(searchText));
  }

  private async onSave(mode: SaveMode | null = null): Promise<void> {
    const selectedIMDbId = this.form.selectedIMDbId().value();
    if (!selectedIMDbId) return;

    await firstValueFrom(this.service.save(selectedIMDbId, this.form.tags().value(), mode));

    if (mode === 'new') {
      this.form().reset({
        searchText: '',
        selectedIMDbId: null,
        tags: '',
      });
    } else {
      this.form.selectedIMDbId().reset(null);
    }
  }
}
