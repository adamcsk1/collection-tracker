import { ChangeDetectionStrategy, Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { applyEach, form, FormField, max, min, validate } from '@angular/forms/signals';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import { SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'ct-series-season-metadata-dialog',
  imports: [DialogShell, FormField, Input],
  templateUrl: './series-season-metadata-dialog.html',
  styleUrl: './series-season-metadata-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesSeasonMetadataDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly portal = inject(PortalService);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly imdbId = input.required<string>();
  public readonly initialSeasons = input<SeriesTrackerSeasonMetadataModel[]>([]);
  public readonly saved = input<(seasons: SeriesTrackerSeasonMetadataModel[]) => void>(() => undefined);
  public readonly closed = input<() => void>(() => this.portal.close());
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('Title.SeriesMetadata')),
    message: computed(() => this.ngxSignalTranslate.translate('Message.SeriesMetadata')),
    season: computed(() => this.ngxSignalTranslate.translate('Season')),
    episodes: computed(() => this.ngxSignalTranslate.translate('Episodes')),
    addSeason: computed(() => this.ngxSignalTranslate.translate('AddSeason')),
    remove: computed(() => this.ngxSignalTranslate.translate('Remove')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
    validation: computed(() => this.ngxSignalTranslate.translate('Validation.SeriesMetadata')),
  };
  protected readonly formModel = signal<{ seasons: SeriesTrackerSeasonMetadataModel[] }>({ seasons: [] });
  protected readonly form = form(this.formModel, (metadata) => {
    applyEach(metadata.seasons, (season) => {
      min(season.season, 1, { error: { kind: 'min' } });
      max(season.season, MAX_SERIES_TRACKER_SEASONS, { error: { kind: 'max' } });
      min(season.episodes, 1, { error: { kind: 'min' } });
      max(season.episodes, MAX_SERIES_TRACKER_EPISODES, { error: { kind: 'max' } });
    });
    validate(metadata.seasons, ({ value }) =>
      this.hasValidUniqueSeasons(value()) ? undefined : { kind: 'seriesMetadata' }
    );
  });
  protected readonly seasons = computed(() =>
    this.formModel().seasons.map((season) => ({ season: season.season, episodes: season.episodes }))
  );
  protected readonly valid = computed(() => !this.form().invalid());

  private hasValidUniqueSeasons(seasons: SeriesTrackerSeasonMetadataModel[]): boolean {
    const seasonNumbers = new Set<number>();
    for (const season of seasons) {
      if (!Number.isInteger(season.season) || season.season < 1 || season.season > MAX_SERIES_TRACKER_SEASONS)
        return false;
      if (!Number.isInteger(season.episodes) || season.episodes < 1 || season.episodes > MAX_SERIES_TRACKER_EPISODES)
        return false;
      if (seasonNumbers.has(season.season)) return false;
      seasonNumbers.add(season.season);
    }
    return true;
  }

  public ngOnInit(): void {
    this.form().reset({ seasons: this.initialSeasons().map((season) => ({ ...season })) });
  }

  protected addSeason(): void {
    const nextSeason = Math.max(0, ...this.formModel().seasons.map((season) => season.season)) + 1;
    this.formModel.update((metadata) => ({
      seasons: [...metadata.seasons, { season: nextSeason, episodes: 1 }],
    }));
  }

  protected removeSeason(index: number): void {
    this.formModel.update((metadata) => ({
      seasons: metadata.seasons.filter((_, seasonIndex) => seasonIndex !== index),
    }));
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    const seasons = this.form()
      .value()
      .seasons.map((season) => ({ season: season.season, episodes: season.episodes }))
      .sort((firstSeason, secondSeason) => firstSeason.season - secondSeason.season);
    const result = await firstValueFrom(this.api.updateSeriesTrackerSeasons(this.imdbId(), { seasons }));
    this.saved()(result.seasons);
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataSaved'));
    this.closed()();
  }

  protected close(): void {
    this.closed()();
  }
}
