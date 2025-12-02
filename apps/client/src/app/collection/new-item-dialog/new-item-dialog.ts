import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CollectionService } from '@client/collection/collection-service';
import { MdContentGeneratorService } from '@client/collection/new-item-dialog/md-content-generator/md-content-generator-service';
import { NewItemModel } from '@client/collection/new-item-dialog/new-item-dialog-model';
import { TagSuggestionService } from '@client/collection/new-item-dialog/suggestion/tag-suggestion-service';
import { knownIMDbIdValidator } from '@client/collection/new-item-dialog/validators/known-imdb-id-validator';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { PortalService } from '@services/portal-service';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, debounceTime, filter, map, mergeMap, skip, take, tap, throwError } from 'rxjs';

@Component({
  selector: 'ct-new-item-dialog',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, Input, Select, DialogShell, Autocomplete],
  templateUrl: './new-item-dialog.html',
  styleUrl: './new-item-dialog.css',
  providers: [OMDbService, MdContentGeneratorService, { provide: AutocompleteService, useClass: TagSuggestionService }],
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewItemDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly omdb = inject(OMDbService);
  private readonly collection = inject(CollectionService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mdContentGenerator = inject(MdContentGeneratorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly portal = inject(PortalService);
  protected readonly formGroup = new FormGroup<Form<NewItemModel>>({
    searchText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    selectedIMDbId: new FormControl(null, { validators: [Validators.required, knownIMDbIdValidator()] }),
    tags: new FormControl('', { nonNullable: true }),
  });
  protected readonly matchedContent = this.omdb.matchedContent;

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

      this.spinnerLoadingState.setState('show', false);
    });
  }

  public ngOnInit(): void {
    this.formGroup.controls.searchText.valueChanges
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((searchText) => {
        this.spinnerLoadingState.setState('show', true);
        this.omdb.getMatchedContents(searchText);
      });
  }

  protected onSave(mode: 'new' | 'close' | null = null): void {
    this.omdb
      .getSelectedContent(`${this.formGroup.controls.selectedIMDbId.value}`)
      .pipe(
        skip(1),
        filter((selectedContent) => !!selectedContent),
        take(1),
        map((selectedContent) =>
          this.mdContentGenerator.getMdContent({
            ...selectedContent,
            Tags: this.formGroup.controls.tags.value.trim(),
          })
        ),
        tap(() => this.spinnerLoadingState.setState('show', true)),
        mergeMap((mdContent) =>
          this.api.create(mdContent).pipe(map((response) => ({ name: response.name, content: mdContent })))
        ),
        catchError((error) => {
          this.spinnerLoadingState.setState('show', false);
          return throwError(() => error);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((collectionItem) => {
        this.spinnerLoadingState.setState('show', false);
        this.collection.addCollectionItem(collectionItem, true);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewItem'));
        if (mode === 'new') this.formGroup.reset();
        else if (mode === 'close') this.portal.close();
      });
  }
}
