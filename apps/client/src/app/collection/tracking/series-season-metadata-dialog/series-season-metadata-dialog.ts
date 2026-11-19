import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { applyEach, form, FormField, max, min, validate } from '@angular/forms/signals';
import { ActionMenu } from '@components/action-menu/action-menu';
import { ActionMenuActionModel } from '@components/action-menu/action-menu-model';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { DEFAULT_EXTERNAL_METADATA_PROVIDER } from '@shared/constants/external-metadata-const';
import { MAX_SERIES_EPISODES, MAX_SERIES_SEASONS } from '@shared/constants/tracking-const';
import { CollectionItemApiModel, TrackingSeasonMetadataModel } from '@shared/models/api-model';
import { ExternalMetadataProviderModel } from '@shared/models/external-metadata-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'ct-series-season-metadata-dialog',
  imports: [ActionMenu, Details, DialogShell, FormField, Input],
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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogShell = viewChild(DialogShell);
  private readonly providers = signal<ExternalMetadataProviderModel[]>([]);
  private readonly baseline = signal<TrackingSeasonMetadataModel[]>([]);
  private discardPending = false;
  protected readonly busy = signal(false);
  protected readonly updateFailed = signal(false);
  protected readonly expandedSeason = signal<number | null>(null);
  public readonly itemTitle = input('');
  public readonly imdbId = input<string | undefined>();
  public readonly externalProvider = input(DEFAULT_EXTERNAL_METADATA_PROVIDER);
  public readonly externalItemId = input<string | undefined>();
  public readonly ownerShareCode = input<string | undefined>();
  public readonly canUpdate = input(true);
  public readonly initialSeasons = input<TrackingSeasonMetadataModel[]>([]);
  public readonly saved = input<(seasons: TrackingSeasonMetadataModel[], item?: CollectionItemApiModel) => void>(
    () => undefined
  );
  public readonly closed = input<() => void>(() => this.portal.close(this.element.nativeElement));
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
    cancel: computed(() => this.ngxSignalTranslate.translate('Dialog.Cancel')),
    updateError: computed(() => this.ngxSignalTranslate.translate('Metadata.UpdateError')),
    actions: computed(() => this.ngxSignalTranslate.translate('Metadata.Actions')),
    progressWarning: computed(() => this.ngxSignalTranslate.translate('Metadata.ProgressWarning')),
    seasonSummaries: computed(() =>
      this.formModel().seasons.map((season) =>
        this.ngxSignalTranslate.translate('Metadata.SeasonSummary', {
          season: `${season.season}`,
          episodes: `${season.episodes}`,
        })
      )
    ),
    refreshSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('RefreshSeriesMetadata')),
    removeSeriesMetadata: computed(() => this.ngxSignalTranslate.translate('RemoveSeriesMetadata')),
    validation: computed(() => this.ngxSignalTranslate.translate('Validation.SeriesMetadata')),
    seasonHint: computed(() =>
      this.ngxSignalTranslate.translate('Message.SeriesMetadataSeasonRange', { max: `${MAX_SERIES_SEASONS}` })
    ),
    episodesHint: computed(() =>
      this.ngxSignalTranslate.translate('Message.SeriesMetadataEpisodeRange', { max: `${MAX_SERIES_EPISODES}` })
    ),
    seasonError: computed(() =>
      this.ngxSignalTranslate.translate('Validation.SeriesMetadataSeason', { max: `${MAX_SERIES_SEASONS}` })
    ),
    episodesError: computed(() =>
      this.ngxSignalTranslate.translate('Validation.SeriesMetadataEpisodes', { max: `${MAX_SERIES_EPISODES}` })
    ),
    noMetadata: computed(() => this.ngxSignalTranslate.translate('Message.SetSeasonMetadata')),
  };
  protected readonly formModel = signal<{ seasons: TrackingSeasonMetadataModel[] }>({ seasons: [] });
  protected readonly form = form(this.formModel, (metadata) => {
    applyEach(metadata.seasons, (season) => {
      min(season.season, 1, { error: { kind: 'min' } });
      max(season.season, MAX_SERIES_SEASONS, { error: { kind: 'max' } });
      min(season.episodes, 1, { error: { kind: 'min' } });
      max(season.episodes, MAX_SERIES_EPISODES, { error: { kind: 'max' } });
      validate(season.season, ({ value }) => (Number.isInteger(value()) ? undefined : { kind: 'integer' }));
      validate(season.episodes, ({ value }) => (Number.isInteger(value()) ? undefined : { kind: 'integer' }));
      validate(season.season, ({ value, valueOf }) =>
        valueOf(metadata.seasons).filter((entry) => entry.season === value()).length > 1
          ? { kind: 'duplicate' }
          : undefined
      );
    });
    validate(metadata.seasons, ({ value }) =>
      this.hasValidUniqueSeasons(value()) ? undefined : { kind: 'seriesMetadata' }
    );
  });
  protected readonly seasons = computed(() =>
    this.formModel().seasons.map((season) => ({ season: season.season, episodes: season.episodes }))
  );
  protected readonly valid = computed(() => !this.form().invalid());
  protected readonly hasChanges = computed(
    () => JSON.stringify(this.formModel().seasons) !== JSON.stringify(this.baseline())
  );
  protected readonly reducesMetadata = computed(() =>
    this.baseline().some((previous) => {
      const current = this.formModel().seasons.find((season) => season.season === previous.season);
      return !current || current.episodes < previous.episodes;
    })
  );
  protected readonly supportsRefresh = computed(() =>
    this.providers().some((provider) => provider.name === this.externalProvider() && provider.supportsSeasonMetadata)
  );
  protected readonly actions = computed<ActionMenuActionModel[]>(() => {
    if (!this.canUpdate() || this.busy()) return [];
    return [
      ...(this.supportsRefresh()
        ? [
            {
              id: 'series-metadata-refresh',
              label: this.translations.refreshSeriesMetadata(),
              icon: 'sync',
              destructive: true,
            },
          ]
        : []),
      ...(this.baseline().length
        ? [
            {
              id: 'series-metadata-remove-all',
              label: this.translations.removeSeriesMetadata(),
              icon: 'playlist_remove',
              destructive: true,
            },
          ]
        : []),
    ];
  });
  protected readonly canDiscard = async (): Promise<boolean> => {
    if (this.busy() || this.discardPending) return false;
    if (!this.hasChanges()) return true;
    this.discardPending = true;
    try {
      return await firstValueFrom(this.confirm.open(this.ngxSignalTranslate.translate('Metadata.DiscardChanges')));
    } finally {
      this.discardPending = false;
    }
  };

  private hasValidUniqueSeasons(seasons: TrackingSeasonMetadataModel[]): boolean {
    const seasonNumbers = new Set<number>();
    for (const season of seasons) {
      if (!Number.isInteger(season.season) || season.season < 1 || season.season > MAX_SERIES_SEASONS) return false;
      if (!Number.isInteger(season.episodes) || season.episodes < 1 || season.episodes > MAX_SERIES_EPISODES)
        return false;
      if (seasonNumbers.has(season.season)) return false;
      seasonNumbers.add(season.season);
    }
    return true;
  }

  public ngOnInit(): void {
    this.resetForm(this.initialSeasons());
    this.api
      .getExternalMetadataProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.providers.set(result.providers),
        error: () => this.providers.set([]),
      });
  }

  private providerItemId(): string {
    return this.externalItemId() ?? this.imdbId() ?? '';
  }

  private resetForm(seasons: TrackingSeasonMetadataModel[]): void {
    this.form().reset({
      seasons: seasons.map((season) => ({
        season: season.season,
        episodes: season.episodes,
        titles: [...(season.titles ?? [])],
      })),
    });
    this.baseline.set(this.formModel().seasons);
    this.expandedSeason.set(null);
  }

  protected getEpisodeIndices(episodesCount: number): number[] {
    return Array.from(
      { length: Math.max(0, Math.min(MAX_SERIES_EPISODES, episodesCount)) },
      (_episode, index) => index
    );
  }

  protected getEpisodeTitle(seasonIndex: number, episodeIndex: number): string {
    return this.formModel().seasons[seasonIndex].titles?.[episodeIndex] ?? '';
  }

  protected setEpisodeTitle(seasonIndex: number, episodeIndex: number, title: string): void {
    if (!this.canUpdate() || this.busy()) return;
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
    if (!this.canUpdate() || this.busy()) return;
    const nextSeason = Math.max(0, ...this.formModel().seasons.map((season) => season.season)) + 1;
    this.formModel.update((metadata) => ({
      seasons: [...metadata.seasons, { season: nextSeason, episodes: 1, titles: [] }],
    }));
    this.expandedSeason.set(this.formModel().seasons.length - 1);
  }

  protected onRemoveSeason(index: number): void {
    if (!this.canUpdate() || this.busy()) return;
    this.formModel.update((metadata) => ({
      seasons: metadata.seasons.filter((_season, seasonIndex) => seasonIndex !== index),
    }));
    const expanded = this.expandedSeason();
    if (expanded === index) this.expandedSeason.set(null);
    else if (expanded !== null && expanded > index) this.expandedSeason.set(expanded - 1);
  }

  protected async onSave(): Promise<void> {
    if (!this.valid() || !this.canUpdate() || this.busy()) return;
    this.busy.set(true);
    this.updateFailed.set(false);
    try {
      if (
        this.reducesMetadata() &&
        !(await firstValueFrom(
          this.confirm.open(this.ngxSignalTranslate.translate('Metadata.ConfirmProgressLoss'), {
            destructive: true,
            confirmationText: this.ngxSignalTranslate.translate('Dialog.Scope.SeriesMetadata'),
            actionLabel: this.translations.save(),
          })
        ))
      )
        return;
      const seasons = this.formModel()
        .seasons.map((season) => ({ season: season.season, episodes: season.episodes, titles: season.titles }))
        .sort((firstSeason, secondSeason) => firstSeason.season - secondSeason.season);
      const ownerShareCode = this.ownerShareCode();
      const updateRequest = ownerShareCode
        ? this.api.updateTrackingSeasonsByExternalId(
            this.externalProvider(),
            this.providerItemId(),
            { seasons },
            ownerShareCode
          )
        : this.api.updateTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId(), { seasons });
      const result = await firstValueFrom(updateRequest);
      this.resetForm(result.seasons);
      this.saved()(result.seasons, result.item);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataSaved'));
      this.closed()();
    } catch {
      this.updateFailed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected onClose(): void {
    this.dialogShell()?.close();
  }

  protected async onActionSelected(actionId: string): Promise<void> {
    if (actionId === 'series-metadata-refresh') await this.onRefreshSeriesMetadata();
    if (actionId === 'series-metadata-remove-all') await this.onRemoveSeriesMetadata();
  }

  protected async onRefreshSeriesMetadata(): Promise<void> {
    if (!this.canUpdate() || this.busy() || !this.supportsRefresh()) return;
    this.busy.set(true);
    this.updateFailed.set(false);
    try {
      const confirmed = await firstValueFrom(
        this.confirm.open(this.ngxSignalTranslate.translate('Confirm.RefreshSeriesMetadata'), {
          destructive: true,
          confirmationText: this.ngxSignalTranslate.translate('Dialog.Scope.SeriesMetadata'),
          actionLabel: this.translations.refreshSeriesMetadata(),
        })
      );
      if (!confirmed) return;

      this.spinnerLoadingState.setState('show', true);
      try {
        const result = await firstValueFrom(
          this.api.refreshTrackingSeasonsByExternalId(
            this.externalProvider(),
            this.providerItemId(),
            this.ownerShareCode()
          )
        );
        this.resetForm(result.seasons);
        this.saved()(result.seasons, result.item);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataRefreshed'));
      } finally {
        this.spinnerLoadingState.setState('show', false);
      }
    } catch {
      this.updateFailed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected async onRemoveSeriesMetadata(): Promise<void> {
    if (!this.canUpdate() || this.busy() || !this.baseline().length) return;
    this.busy.set(true);
    this.updateFailed.set(false);
    try {
      const confirmed = await firstValueFrom(
        this.confirm.open(this.ngxSignalTranslate.translate('Confirm.RemoveSeriesMetadata'), {
          destructive: true,
          confirmationText: this.ngxSignalTranslate.translate('Dialog.Scope.SeriesMetadata'),
          actionLabel: this.translations.removeSeriesMetadata(),
        })
      );
      if (!confirmed) return;

      const result = await firstValueFrom(
        this.api.deleteTrackingSeasonsByExternalId(
          this.externalProvider(),
          this.providerItemId(),
          this.ownerShareCode()
        )
      );
      this.resetForm(result.seasons);
      this.saved()(result.seasons, result.item);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SeriesMetadataDeleted'));
    } catch {
      this.updateFailed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
