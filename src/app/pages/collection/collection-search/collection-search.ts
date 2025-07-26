import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Input } from '@components/input/input';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { componentCollectionStateToken } from '../collection-store';

@Component({
  selector: 'ct-collection-search',
  imports: [Input, ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './collection-search.html',
  styleUrl: './collection-search.css',
})
export class CollectionSearch implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly componentCollectionState = inject(componentCollectionStateToken);
  protected readonly searchTextControl = new FormControl<string>('', { nonNullable: true });

  constructor() {
    effect(() => {
      const searchText = this.componentCollectionState.state.searchText();
      this.searchTextControl.setValue(searchText);
    });
  }

  public ngOnInit(): void {
    this.searchTextControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((searchText) => this.componentCollectionState.setState('searchText', searchText));
  }
}
