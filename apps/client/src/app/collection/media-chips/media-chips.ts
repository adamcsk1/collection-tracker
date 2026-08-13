import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import type { CollectionMediaChip } from './media-chips-model';

@Component({
  selector: 'ct-collection-media-chips',
  imports: [RevealLabel],
  templateUrl: './media-chips.html',
  styleUrl: './media-chips.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionMediaChips {
  private readonly router = inject(Router);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);

  public readonly active = input.required<CollectionMediaChip>();
  public readonly listRoute = input('library');
  public readonly allowedChips = input<readonly CollectionMediaChip[]>(['all', 'movie', 'series', 'book']);
  public readonly booksEnabled = input(true);
  public readonly navigate = input(true);
  public readonly selectionChange = output<CollectionMediaChip>();

  protected readonly translations = {
    all: computed(() => this.ngxSignalTranslate.translate('All')),
    mediaTypes: computed(() => this.ngxSignalTranslate.translate('MediaTypes')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    series: computed(() => this.ngxSignalTranslate.translate('Series')),
    books: computed(() => this.ngxSignalTranslate.translate('Books')),
  };

  protected readonly chips = computed(() => {
    const allowed = new Set(this.allowedChips());
    const definitions: { id: CollectionMediaChip; label: string; icon: string; testId: string }[] = [
      { id: 'all', label: this.translations.all(), icon: 'local_library', testId: 'collection-media-chip-all' },
      { id: 'movie', label: this.translations.movies(), icon: 'movie', testId: 'collection-media-chip-movie' },
      { id: 'series', label: this.translations.series(), icon: 'live_tv', testId: 'collection-media-chip-series' },
      { id: 'book', label: this.translations.books(), icon: 'menu_book', testId: 'collection-media-chip-book' },
    ];
    return definitions.filter((chip) => {
      if (!allowed.has(chip.id)) return false;
      if (chip.id === 'book' && !this.booksEnabled()) return false;
      return true;
    });
  });

  protected onSelect(chip: CollectionMediaChip): void {
    if (chip === this.active()) return;
    this.selectionChange.emit(chip);
    if (!this.navigate()) return;
    void this.router.navigate(['/collection', this.listRoute()], {
      queryParams: { type: chip === 'all' ? null : chip },
      queryParamsHandling: 'merge',
    });
  }
}
