import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { Form } from '@models/form.model';
import { CollectionService } from '@services/collection/collection-service';
import { MdContentGeneratorService } from '@services/md-content-generator-service';
import { MemosService } from '@services/memos-service';
import { OMDbService } from '@services/omdb-service';
import { appStateToken } from '@stores/app-store';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { catchError, debounceTime, filter, map, mergeMap, skip, take, tap } from 'rxjs';
import { NewCollectionItemModel } from './new-collection-item.model';
import { knownIMDbIdValidator } from './validators/known-imdb-id.validator';

@Component({
  selector: 'ct-new-collection-item',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, Input, Select],
  templateUrl: './new-collection-item.html',
  styleUrl: './new-collection-item.css',
  providers: [OMDbService, MdContentGeneratorService],
})
export class NewCollectionItem implements OnInit {
  private readonly memos = inject(MemosService);
  private readonly omdb = inject(OMDbService);
  private readonly collection = inject(CollectionService);
  private readonly appState = inject(appStateToken);
  private readonly mdContentGenerator = inject(MdContentGeneratorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly formGroup = new FormGroup<Form<NewCollectionItemModel>>({
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

      this.appState.setState('spinnerLoading', false);
    });
  }

  public ngOnInit(): void {
    this.formGroup.controls.searchText.valueChanges
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((searchText) => {
        this.appState.setState('spinnerLoading', true);
        this.omdb.getMatchedContents(searchText);
      });
  }

  protected onAdd(resetForm = false): void {
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
        tap(() => this.appState.setState('spinnerLoading', true)),
        mergeMap((mdContent) => this.memos.createMemo(mdContent)),
        catchError((error) => {
          this.appState.setState('spinnerLoading', false);
          throw new Error(error.message);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((memo) => {
        this.appState.setState('spinnerLoading', false);
        if (resetForm) this.formGroup.reset();
        else {
          this.collection.addCollectionItem(memo, true);
          this.router.navigate(['/', 'collection']);
        }
      });
  }

  protected onCancel(): void {
    this.router.navigate(['/', 'collection']);
  }
}
