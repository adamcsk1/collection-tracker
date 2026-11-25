import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import type { StatisticsBar } from './statistics-bars-model';

@Component({
  selector: 'ct-statistics-bars',
  templateUrl: './statistics-bars.html',
  styleUrl: './statistics-bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsBars {
  public readonly title = input.required<string>();
  public readonly entries = input.required<StatisticsBar[]>();
  public readonly interactive = input(false);
  public readonly selected = input<string | null>(null);
  public readonly limit = input(10);
  public readonly selection = output<string>();
  protected readonly expanded = signal(false);
  protected readonly maximum = computed(() => Math.max(1, ...this.entries().map((entry) => entry.count)));
  protected readonly visible = computed(() =>
    this.expanded() ? this.entries() : this.entries().slice(0, this.limit())
  );
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    showMore: computed(() => this.ngxSignalTranslate.translate('Statistics.ShowAll', { count: this.entries().length })),
    showLess: computed(() => this.ngxSignalTranslate.translate('Statistics.ShowLess')),
    empty: computed(() => this.ngxSignalTranslate.translate('Statistics.NoData')),
  };
}
