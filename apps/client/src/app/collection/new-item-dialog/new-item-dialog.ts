import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewItemModel, SaveMode } from '@client/collection/new-item-dialog/new-item-dialog-model';
import { NewItemDialogService } from '@client/collection/new-item-dialog/new-item-dialog-service';
import { TagSuggestionService } from '@client/collection/new-item-dialog/suggestion/tag-suggestion-service';
import { knownIMDbIdValidator } from '@client/collection/new-item-dialog/validators/known-imdb-id-validator';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { debounceTime } from 'rxjs';

@Component({
  selector: 'ct-new-item-dialog',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, Input, Select, DialogShell, Autocomplete],
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
export class NewItemDialog implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(NewItemDialogService);
  protected readonly formGroup = new FormGroup<Form<NewItemModel>>({
    searchText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    selectedIMDbId: new FormControl(null, { validators: [Validators.required, knownIMDbIdValidator()] }),
    tags: new FormControl('', { nonNullable: true }),
  });
  protected readonly matchedContent = this.service.matchedContent;

  constructor() {
    effect(() => {
      const matchedContent = this.matchedContent();

      if (matchedContent.length) {
        this.formGroup.controls.selectedIMDbId.setValue(`${matchedContent[0].value}`);
        this.formGroup.controls.selectedIMDbId.markAsTouched();
      } else {
        this.formGroup.controls.selectedIMDbId.setValue(null);
        this.formGroup.controls.selectedIMDbId.markAsUntouched();
      }
    });
  }

  public ngOnInit(): void {
    this.formGroup.controls.searchText.valueChanges
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((searchText) => this.service.search(searchText));
  }

  protected onSave(mode: SaveMode | null = null): void {
    const selectedIMDbId = this.formGroup.controls.selectedIMDbId.value;
    if (!selectedIMDbId) return;

    this.service
      .save(`${selectedIMDbId}`, this.formGroup.controls.tags.value, mode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (mode === 'new') this.formGroup.reset();
        else this.formGroup.controls.selectedIMDbId.reset();
      });
  }
}
