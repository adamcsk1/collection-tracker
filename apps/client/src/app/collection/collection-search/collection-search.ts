import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CollectionSearchSuggestionService } from '@client/collection/collection-search/collection-search-suggestion-service';
import { collectionStateToken } from '@client/collection/collection-store';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-collection-search',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, Autocomplete],
  templateUrl: './collection-search.html',
  styleUrl: './collection-search.css',
  providers: [{ provide: AutocompleteService, useClass: CollectionSearchSuggestionService }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionSearch implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly collectionState = inject(collectionStateToken);
  protected readonly searchTextControl = new FormControl<string>('', { nonNullable: true });

  constructor() {
    effect(() => {
      const searchText = this.collectionState.state.searchText();
      this.searchTextControl.setValue(searchText);
    });
  }

  public ngOnInit(): void {
    this.searchTextControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((searchText) => this.collectionState.setState('searchText', searchText));
  }
}
