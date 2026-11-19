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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActionMenu } from '@components/action-menu/action-menu';
import { ActionMenuActionModel } from '@components/action-menu/action-menu-model';
import { Checkbox } from '@components/checkbox/checkbox';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { DEFAULT_EXTERNAL_METADATA_PROVIDER } from '@shared/constants/external-metadata-const';
import {
  CollectionItemApiModel,
  TrackingSeasonMetadataModel,
  TrackingCompletedEpisodesApiResponseModel,
  TrackingCompletedEpisodeModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom, forkJoin } from 'rxjs';

import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { getOpenSeasons } from './utils/get-open-seasons-util';

@Component({
  selector: 'ct-completed-episodes-dialog',
  imports: [ActionMenu, Checkbox, DialogShell, Details],
  templateUrl: './completed-episodes-dialog.html',
  styleUrl: './completed-episodes-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompletedEpisodesDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly portal = inject(PortalService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private saveCompletedEpisodesQueue = Promise.resolve();
  private saveCompletedEpisodesVersion = 0;
  private hasLocalCompletedEpisodeChanges = false;
  private loadVersion = 0;
  public readonly imdbId = input<string | undefined>();
  public readonly externalProvider = input(DEFAULT_EXTERNAL_METADATA_PROVIDER);
  public readonly externalItemId = input<string | undefined>();
  public readonly ownerShareCode = input<string | undefined>();
  public readonly itemTitle = input('');
  public readonly canUpdate = input(true);
  public readonly saved = input<
    (completedEpisodes: TrackingCompletedEpisodeModel[], item?: CollectionItemApiModel) => void
  >(() => undefined);
  public readonly closed = input<() => void>(() => this.portal.close(this.element.nativeElement));
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('Title.CompletedEpisodes')),
    setSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('Message.SetSeasonMetadata')),
    manageSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    season: computed(() => this.ngxSignalTranslate.translate('Season')),
    markAllEpisodesCompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesCompleted')),
    markAllEpisodesUncompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesUncompleted')),
    episode: computed(() => this.ngxSignalTranslate.translate('Episode')),
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
    retry: computed(() => this.ngxSignalTranslate.translate('Retry')),
    loading: computed(() => this.ngxSignalTranslate.translate('Loading')),
    loadError: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.LoadError')),
    fetch: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.Fetch')),
    manual: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.Manual')),
    empty: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.Empty')),
    actions: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.Actions')),
    seasonWatched: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.SeasonWatched')),
    saving: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.Saving')),
    saved: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.Saved')),
    saveError: computed(() => this.ngxSignalTranslate.translate('EpisodeTracking.SaveError')),
    progress: computed(() =>
      this.ngxSignalTranslate.translate('EpisodeTracking.Progress', {
        completed: `${this.completedCount()}`,
        total: `${this.totalCount()}`,
      })
    ),
    seasonSummaries: computed(() =>
      this.seasonProgress().map((season) =>
        this.ngxSignalTranslate.translate('EpisodeTracking.SeasonSummary', {
          season: `${season.season}`,
          completed: `${season.completed}`,
          total: `${season.episodes}`,
        })
      )
    ),
  };
  protected readonly loading = signal(true);
  protected readonly supportsFetch = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly seasonsMetadata = signal<TrackingSeasonMetadataModel[]>([]);
  protected readonly completedEpisodes = signal<TrackingCompletedEpisodeModel[]>([]);
  protected readonly completedSet = computed(() => {
    const set = new Set<string>();
    for (const episode of this.completedEpisodes()) {
      set.add(`${episode.season}-${episode.episode}`);
    }
    return set;
  });
  protected readonly hasSeasonMetadata = computed(() => this.seasonsMetadata().length > 0);
  protected readonly seasonProgress = computed(() =>
    this.seasonsMetadata().map((season) => ({
      ...season,
      completed: Array.from({ length: season.episodes }, (_episode, index) => index + 1).filter((episode) =>
        this.completedSet().has(`${season.season}-${episode}`)
      ).length,
    }))
  );
  protected readonly totalCount = computed(() =>
    this.seasonProgress().reduce((total, season) => total + season.episodes, 0)
  );
  protected readonly completedCount = computed(() =>
    this.seasonProgress().reduce((total, season) => total + season.completed, 0)
  );
  protected readonly menuActions = computed<ActionMenuActionModel[]>(() => {
    if (!this.canUpdate() || this.loading() || this.loadError()) return [];
    const actions: ActionMenuActionModel[] = [];
    if (this.hasSeasonMetadata()) {
      if (!this.allEpisodesCompleted()) {
        actions.push({
          id: 'completed-episodes-mark-all-completed',
          label: this.translations.markAllEpisodesCompleted(),
          icon: 'done_all',
        });
      }
      actions.push({
        id: 'completed-episodes-manage-season-metadata',
        label: this.translations.manageSeasonMetadata(),
        icon: 'edit_calendar',
      });
      if (this.completedCount() > 0) {
        actions.push({
          id: 'completed-episodes-mark-all-uncompleted',
          label: this.translations.markAllEpisodesUncompleted(),
          icon: 'remove_done',
          destructive: true,
        });
      }
    }
    return actions;
  });
  protected readonly allEpisodesCompleted = computed(() => {
    const seasons = this.seasonsMetadata();
    if (!seasons.length) return false;

    const completedSet = this.completedSet();
    for (const season of seasons) {
      for (let episode = 1; episode <= season.episodes; episode++) {
        if (!completedSet.has(`${season.season}-${episode}`)) return false;
      }
    }
    return true;
  });

  protected readonly openSeasons = signal(new Set<number>());
  public readonly canClose = async (): Promise<boolean> => {
    await this.waitForSaves();
    return (
      this.saveStatus() !== 'error' ||
      firstValueFrom(this.confirm.open(this.ngxSignalTranslate.translate('EpisodeTracking.CloseUnsaved')))
    );
  };

  public ngOnInit(): void {
    this.loadData();
    if (this.canUpdate()) {
      this.api
        .getExternalMetadataProviders()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ providers }) =>
            this.supportsFetch.set(
              providers.some((provider) => provider.name === this.externalProvider() && provider.supportsSeasonMetadata)
            ),
          error: () => this.supportsFetch.set(false),
        });
    }
  }

  private providerItemId(): string {
    return this.externalItemId() ?? this.imdbId() ?? '';
  }

  protected loadData(item?: CollectionItemApiModel): void {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.loadError.set(false);
    const ownerShareCode = this.ownerShareCode();
    const seasonsRequest = ownerShareCode
      ? this.api.getTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId(), ownerShareCode)
      : this.api.getTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId());
    const completedEpisodesRequest = ownerShareCode
      ? this.api.getTrackingCompletedEpisodesByExternalId(
          this.externalProvider(),
          this.providerItemId(),
          ownerShareCode
        )
      : this.api.getTrackingCompletedEpisodesByExternalId(this.externalProvider(), this.providerItemId());
    forkJoin({ seasons: seasonsRequest, completed: completedEpisodesRequest })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ seasons, completed }) => {
          if (version !== this.loadVersion) return;
          this.seasonsMetadata.set(seasons.seasons);
          if (!this.hasLocalCompletedEpisodeChanges) {
            this.completedEpisodes.set(completed.completedEpisodes);
            this.saveStatus.set('idle');
          }
          this.openSeasons.set(getOpenSeasons(this.seasonsMetadata(), this.completedSet()));
          this.loading.set(false);
          if (item) this.saved()(this.completedEpisodes(), item);
        },
        error: () => {
          if (version !== this.loadVersion) return;
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  protected isEpisodeCompleted(season: number, episode: number): boolean {
    return this.completedSet().has(`${season}-${episode}`);
  }

  protected isSeasonFullyCompleted(season: number, episodesCount: number): boolean {
    for (let episode = 1; episode <= episodesCount; episode++) {
      if (!this.completedSet().has(`${season}-${episode}`)) {
        return false;
      }
    }
    return true;
  }

  protected isSeasonPartiallyCompleted(season: number, episodesCount: number): boolean {
    let completedCount = 0;
    for (let episode = 1; episode <= episodesCount; episode++) {
      if (this.completedSet().has(`${season}-${episode}`)) {
        completedCount++;
      }
    }
    return completedCount > 0 && completedCount < episodesCount;
  }

  protected async onToggleEpisode(season: number, episode: number): Promise<void> {
    if (!this.canUpdate()) return;
    this.hasLocalCompletedEpisodeChanges = true;
    const key = `${season}-${episode}`;
    const currentCompleted = this.completedEpisodes();
    if (this.completedSet().has(key)) {
      this.completedEpisodes.set(
        currentCompleted.filter(
          (completedEpisode) => completedEpisode.season !== season || completedEpisode.episode !== episode
        )
      );
    } else {
      this.completedEpisodes.set([...currentCompleted, { season, episode }]);
    }
    await this.saveCompletedEpisodes().catch(() => undefined);
  }

  protected async onToggleSeason(season: number, episodesCount: number): Promise<void> {
    if (!this.canUpdate()) return;
    this.hasLocalCompletedEpisodeChanges = true;
    const currentCompleted = this.completedEpisodes();
    const seasonEpisodes: TrackingCompletedEpisodeModel[] = [];
    for (let episode = 1; episode <= episodesCount; episode++) {
      seasonEpisodes.push({ season, episode });
    }

    const isFullyCompleted = this.isSeasonFullyCompleted(season, episodesCount);
    if (isFullyCompleted) {
      this.completedEpisodes.set(currentCompleted.filter((completedEpisode) => completedEpisode.season !== season));
    } else {
      const withoutSeason = currentCompleted.filter((completedEpisode) => completedEpisode.season !== season);
      this.completedEpisodes.set([...withoutSeason, ...seasonEpisodes]);
    }
    await this.saveCompletedEpisodes().catch(() => undefined);
  }

  protected isSeasonOpenDefault(season: number): boolean {
    return this.openSeasons().has(season);
  }

  protected getEpisodeTitle(seasonIndex: number, episodeIndex: number): string | undefined {
    return this.seasonsMetadata()[seasonIndex]?.titles?.[episodeIndex];
  }

  private async saveCompletedEpisodes(): Promise<void> {
    const episodes = this.completedEpisodes()
      .slice()
      .sort((firstEpisode, secondEpisode) => {
        if (firstEpisode.season !== secondEpisode.season) {
          return firstEpisode.season - secondEpisode.season;
        }
        return firstEpisode.episode - secondEpisode.episode;
      });
    await this.queueCompletedEpisodesMutation(async () => {
      const ownerShareCode = this.ownerShareCode();
      const updateRequest = this.api.updateTrackingCompletedEpisodesByExternalId(
        this.externalProvider(),
        this.providerItemId(),
        { completedEpisodes: episodes },
        ownerShareCode,
        { suppressErrorAlert: true }
      );
      return firstValueFrom(updateRequest);
    });
  }

  private async queueCompletedEpisodesMutation(
    action: () => Promise<TrackingCompletedEpisodesApiResponseModel>
  ): Promise<TrackingCompletedEpisodesApiResponseModel> {
    const version = ++this.saveCompletedEpisodesVersion;
    this.saveStatus.set('saving');
    const save = this.saveCompletedEpisodesQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          const result = await action();
          if (version === this.saveCompletedEpisodesVersion) {
            this.applySavedCompletedEpisodes(result);
            this.saveStatus.set('saved');
          }
          return result;
        } catch (error) {
          if (version === this.saveCompletedEpisodesVersion) this.saveStatus.set('error');
          throw error;
        }
      });
    this.saveCompletedEpisodesQueue = save.then(
      () => undefined,
      () => undefined
    );
    return save;
  }

  private applySavedCompletedEpisodes(result: TrackingCompletedEpisodesApiResponseModel): void {
    this.completedEpisodes.set(result.completedEpisodes);
    this.saved()(result.completedEpisodes, result.item);
  }

  protected async onClose(): Promise<void> {
    await this.waitForSaves();
    this.closed()();
  }

  private async waitForSaves(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.saveCompletedEpisodesQueue;
      await pending;
    } while (pending !== this.saveCompletedEpisodesQueue);
  }

  protected async onRetrySave(): Promise<void> {
    await this.saveCompletedEpisodes().catch(() => undefined);
  }

  protected async onFetchMetadata(): Promise<void> {
    if (!this.canUpdate() || !this.supportsFetch() || this.loading()) return;
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.api.refreshTrackingSeasonsByExternalId(
          this.externalProvider(),
          this.providerItemId(),
          this.ownerShareCode()
        )
      );
      this.hasLocalCompletedEpisodeChanges = false;
      this.loadData(result.item);
    } catch {
      this.loading.set(false);
      this.loadError.set(true);
    }
  }

  protected onMenuAction(action: string): void {
    if (action === 'completed-episodes-mark-all-completed') void this.onMarkAllEpisodesCompleted();
    else if (action === 'completed-episodes-mark-all-uncompleted') void this.onMarkAllEpisodesUncompleted();
    else if (action === 'completed-episodes-manage-season-metadata') void this.onManageSeasonMetadata();
  }

  protected async onManageSeasonMetadata(): Promise<void> {
    if (!this.canUpdate()) return;
    await this.waitForSaves();
    if (this.saveStatus() === 'error') {
      const discard = await firstValueFrom(
        this.confirm.open(this.ngxSignalTranslate.translate('EpisodeTracking.DiscardForMetadata'))
      );
      if (!discard) return;
      this.hasLocalCompletedEpisodeChanges = false;
      this.saveStatus.set('idle');
      this.loadData();
    }
    this.portal.openStacked(SeriesSeasonMetadataDialog, {
      imdbId: this.imdbId(),
      externalProvider: this.externalProvider(),
      externalItemId: this.providerItemId(),
      ...(this.ownerShareCode() ? { ownerShareCode: this.ownerShareCode() } : {}),
      initialSeasons: this.seasonsMetadata(),
      itemTitle: this.itemTitle(),
      canUpdate: this.canUpdate(),
      saved: (seasons: TrackingSeasonMetadataModel[], item?: CollectionItemApiModel) => {
        this.seasonsMetadata.set(seasons);
        this.hasLocalCompletedEpisodeChanges = false;
        this.loadData(item);
      },
    });
  }

  protected async onMarkAllEpisodesCompleted(): Promise<void> {
    if (!this.canUpdate()) return;
    if (!this.hasSeasonMetadata()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SetSeasonMetadataFirst'));
      return;
    }
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesCompleted'))
    );
    if (!confirmed) return;

    this.hasLocalCompletedEpisodeChanges = true;
    this.completedEpisodes.set(
      this.seasonsMetadata().flatMap((season) =>
        Array.from({ length: season.episodes }, (_episode, index) => ({ season: season.season, episode: index + 1 }))
      )
    );
    this.spinnerLoadingState.setState('show', true);
    try {
      const ownerShareCode = this.ownerShareCode();
      await this.queueCompletedEpisodesMutation(() =>
        ownerShareCode
          ? firstValueFrom(
              this.api.updateTrackingCompletedEpisodesByExternalId(
                this.externalProvider(),
                this.providerItemId(),
                {
                  completedEpisodes: this.seasonsMetadata().flatMap((season) =>
                    Array.from({ length: season.episodes }, (_episode, index) => ({
                      season: season.season,
                      episode: index + 1,
                    }))
                  ),
                },
                ownerShareCode,
                { suppressErrorAlert: true }
              )
            )
          : firstValueFrom(
              this.api.markAllTrackingCompletedByExternalId(this.externalProvider(), this.providerItemId(), {
                suppressErrorAlert: true,
              })
            )
      );
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedCompleted'));
    } catch {
      return;
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMarkAllEpisodesUncompleted(): Promise<void> {
    if (!this.canUpdate()) return;
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesUncompleted'), {
        destructive: true,
        confirmationText: this.ngxSignalTranslate.translate('Dialog.Scope.Series'),
        actionLabel: this.translations.markAllEpisodesUncompleted(),
      })
    );
    if (!confirmed) return;

    this.hasLocalCompletedEpisodeChanges = true;
    this.completedEpisodes.set([]);
    this.spinnerLoadingState.setState('show', true);
    try {
      const ownerShareCode = this.ownerShareCode();
      await this.queueCompletedEpisodesMutation(() =>
        firstValueFrom(
          ownerShareCode
            ? this.api.updateTrackingCompletedEpisodesByExternalId(
                this.externalProvider(),
                this.providerItemId(),
                { completedEpisodes: [] },
                ownerShareCode,
                { suppressErrorAlert: true }
              )
            : this.api.updateTrackingCompletedEpisodesByExternalId(
                this.externalProvider(),
                this.providerItemId(),
                {
                  completedEpisodes: [],
                },
                undefined,
                { suppressErrorAlert: true }
              )
        )
      );
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedUncompleted'));
    } catch {
      return;
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }
}
