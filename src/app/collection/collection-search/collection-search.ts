import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Input } from '@lib/components/input/input';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { collectionStateToken } from '../collection-store';

@Component({
  selector: 'ct-collection-search',
  imports: [Input, ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './collection-search.html',
  styleUrl: './collection-search.css',
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
