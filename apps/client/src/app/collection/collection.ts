import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { List } from '@client/collection/list/list';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { SearchSuggestionService } from '@client/collection/search/search-suggestion-service';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

import { provideStore } from 'ngx-simple-signal-store';

@Component({
  selector: 'ct-collection',
  imports: [List, ReactiveFormsModule, NgxSignalTranslatePipe, Autocomplete],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
  providers: [
    provideStore(initialCollectionState, collectionStateToken),
    { provide: AutocompleteService, useClass: SearchSuggestionService },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Collection implements OnInit {
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
