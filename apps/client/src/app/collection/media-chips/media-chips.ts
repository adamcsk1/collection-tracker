import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

export type CollectionMediaChip = 'all' | 'movie' | 'series' | 'book';

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
  public readonly booksEnabled = input(true);

  protected readonly translations = {
    all: computed(() => this.ngxSignalTranslate.translate('All')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    series: computed(() => this.ngxSignalTranslate.translate('Series')),
    books: computed(() => this.ngxSignalTranslate.translate('Books')),
  };

  protected readonly chips = computed(() => {
    const items: { id: CollectionMediaChip; label: string; icon: string; testId: string }[] = [
      { id: 'all', label: this.translations.all(), icon: 'local_library', testId: 'collection-media-chip-all' },
      { id: 'movie', label: this.translations.movies(), icon: 'movie', testId: 'collection-media-chip-movie' },
      { id: 'series', label: this.translations.series(), icon: 'live_tv', testId: 'collection-media-chip-series' },
    ];
    if (this.booksEnabled()) {
      items.push({
        id: 'book',
        label: this.translations.books(),
        icon: 'menu_book',
        testId: 'collection-media-chip-book',
      });
    }
    return items;
  });

  protected onSelect(chip: CollectionMediaChip): void {
    if (chip === this.active()) return;
    void this.router.navigate(['/collection', 'library'], {
      queryParams: { type: chip === 'all' ? null : chip },
      queryParamsHandling: 'merge',
    });
  }
}
