import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { applyEach, form, FormField, max, min, validate } from '@angular/forms/signals';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { DEFAULT_EXTERNAL_METADATA_PROVIDER } from '@shared/constants/external-metadata-const';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import { CollectionItemApiModel, TrackingSeasonMetadataModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'ct-series-season-metadata-dialog',
  imports: [Details, DialogShell, FormField, Input, RevealLabel],
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
  private readonly confirm = inject(ConfirmService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly imdbId = input<string | undefined>();
  public readonly externalProvider = input(DEFAULT_EXTERNAL_METADATA_PROVIDER);
  public readonly externalItemId = input<string | undefined>();
  public readonly initialSeasons = input<TrackingSeasonMetadataModel[]>([]);
  public readonly saved = input<(seasons: TrackingSeasonMetadataModel[], item?: CollectionItemApiModel) => void>(
    () => undefined
  );
  public readonly closed = input<() => void>(() => this.portal.closeTop());
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('Title.SeriesMetadata')),
    message: computed(() => this.ngxSignalTranslate.translate('Message.SeriesMetadata')),
    season: computed(() => this.ngxSignalTranslate.translate('Season')),
    episodes: computed(() => this.ngxSignalTranslate.translate('Episodes')),
    episodeTitles: computed(() => this.ngxSignalTranslate.translate('EpisodeTitles')),
    addSeason: computed(() => this.ngxSignalTranslate.translate('AddSeason')),
    remove: computed(() => this.ngxSignalTranslate.translate('Remove')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
    refreshSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('RefreshSeriesMetadata')),
    removeSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('RemoveSeriesMetadata')),
    validation: computed(() => this.ngxSignalTranslate.translate('Validation.SeriesMetadata')),
    noMetadata: computed(() => this.ngxSignalTranslate.translate('Message.SetSeasonMetadata')),
  };
  protected readonly formModel = signal<{ seasons: TrackingSeasonMetadataModel[] }>({ seasons: [] });
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

  private hasValidUniqueSeasons(seasons: TrackingSeasonMetadataModel[]): boolean {
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
    this.resetForm(this.initialSeasons());
  }

  private providerItemId(): string {
    return this.externalItemId() ?? this.imdbId() ?? '';
  }

  private resetForm(seasons: TrackingSeasonMetadataModel[]): void {
    this.form().reset({
      seasons: seasons.map((season) => ({
        season: season.season,
        episodes: season.episodes,
        titles: season.titles ?? [],
      })),
    });
  }

  protected getEpisodeIndices(episodesCount: number): number[] {
    return Array.from({ length: episodesCount }, (_, index) => index);
  }

  protected getEpisodeTitle(seasonIndex: number, episodeIndex: number): string {
    return this.formModel().seasons[seasonIndex].titles?.[episodeIndex] ?? '';
  }

  protected setEpisodeTitle(seasonIndex: number, episodeIndex: number, title: string): void {
    this.formModel.update((metadata) => {
      const seasons = [...metadata.seasons];
      const season = { ...seasons[seasonIndex] };
      const titles = [...(season.titles ?? [])];
      titles[episodeIndex] = title;
      season.titles = titles;
      seasons[seasonIndex] = season;
      return { seasons };
    });
  }

  protected onAddSeason(): void {
    const nextSeason = Math.max(0, ...this.formModel().seasons.map((season) => season.season)) + 1;
    this.formModel.update((metadata) => ({
      seasons: [...metadata.seasons, { season: nextSeason, episodes: 1, titles: [] }],
    }));
  }

  protected onRemoveSeason(index: number): void {
    this.formModel.update((metadata) => ({
      seasons: metadata.seasons.filter((_, seasonIndex) => seasonIndex !== index),
    }));
  }

  protected async onSave(): Promise<void> {
    if (!this.valid()) return;
    const seasons = this.formModel()
      .seasons.map((season) => ({ season: season.season, episodes: season.episodes, titles: season.titles }))
      .sort((firstSeason, secondSeason) => firstSeason.season - secondSeason.season);
    const result = await firstValueFrom(
      this.api.updateTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId(), { seasons })
    );
    this.saved()(result.seasons, result.item);
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataSaved'));
    this.onClose();
  }

  protected onClose(): void {
    this.closed()();
  }

  protected async onRefreshSeriesMetadata(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.RefreshSeriesMetadata'))
    );
    if (!confirmed) return;

    this.spinnerLoadingState.setState('show', true);
    try {
      const result = await firstValueFrom(
        this.api.refreshTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId())
      );
      this.resetForm(result.seasons);
      this.saved()(result.seasons, result.item);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataRefreshed'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onRemoveSeriesMetadata(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.RemoveSeriesMetadata'))
    );
    if (!confirmed) return;

    const result = await firstValueFrom(
      this.api.deleteTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId())
    );
    this.resetForm(result.seasons);
    this.saved()(result.seasons, result.item);
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataDeleted'));
  }
}
