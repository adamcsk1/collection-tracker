import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CollectionNewItemModel } from '@collection/collection-new-item-dialog/collection-new-item-dialog-model';
import { MdContentGeneratorService } from '@collection/collection-new-item-dialog/md-content-generator-service';
import { knownIMDbIdValidator } from '@collection/collection-new-item-dialog/validators/known-imdb-id.validator';
import { CollectionService } from '@collection/collection-service';
import { DialogShell } from '@lib/components/dialog-shell/dialog-shell';
import { Input } from '@lib/components/input/input';
import { Select } from '@lib/components/select/select';
import { spinnerLoadingStateToken } from '@lib/components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@lib/components/toast/toast-store';
import { Form } from '@lib/models/form-model';
import { MemosService } from '@lib/services/memos/memos-service';
import { OMDbService } from '@lib/services/omdb/omdb-service';
import { PortalService } from '@lib/services/portal-service';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, debounceTime, filter, map, mergeMap, skip, take, tap } from 'rxjs';

@Component({
  selector: 'ct-collection-new-item-dialog',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, Input, Select, DialogShell],
  templateUrl: './collection-new-item-dialog.html',
  styleUrl: './collection-new-item-dialog.css',
  providers: [OMDbService, MdContentGeneratorService],
  host: {
    class: 'dialog',
  },
})
export class CollectionNewItemDialog implements OnInit {
  private readonly memos = inject(MemosService);
  private readonly omdb = inject(OMDbService);
  private readonly collection = inject(CollectionService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mdContentGenerator = inject(MdContentGeneratorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly portal = inject(PortalService);
  protected readonly formGroup = new FormGroup<Form<CollectionNewItemModel>>({
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
        mergeMap((mdContent) => this.memos.createMemo(mdContent)),
        catchError((error) => {
          this.spinnerLoadingState.setState('show', false);
          throw new Error(error.message);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((memo) => {
        this.spinnerLoadingState.setState('show', false);
        this.collection.addCollectionItem(memo, true);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewItem'));
        if (mode === 'new') this.formGroup.reset();
        else if (mode === 'close') this.portal.close();
      });
  }
}
