import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import {
  CollectionItemApiModel,
  SeriesTrackerSeasonMetadataModel,
  SeriesTrackerWatchedEpisodesApiResponseModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { getOpenSeasons } from './utils/get-open-seasons-util';

@Component({
  selector: 'ct-watched-episodes-dialog',
  imports: [DialogShell, Details, RevealLabel],
  templateUrl: './watched-episodes-dialog.html',
  styleUrl: './watched-episodes-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchedEpisodesDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly portal = inject(PortalService);
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private saveWatchedEpisodesQueue = Promise.resolve();
  private saveWatchedEpisodesVersion = 0;
  private hasLocalWatchedEpisodeChanges = false;
  public readonly imdbId = input<string | undefined>();
  public readonly externalProvider = input('omdb');
  public readonly externalItemId = input<string | undefined>();
  public readonly saved = input<
    (watchedEpisodes: SeriesTrackerWatchedEpisodeModel[], item?: CollectionItemApiModel) => void
  >(() => undefined);
  public readonly closed = input<() => void>(() => this.portal.closeTop());
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('Title.WatchedEpisodes')),
    setSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('Message.SetSeasonMetadata')),
    manageSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    season: computed(() => this.ngxSignalTranslate.translate('Season')),
    markAllEpisodesWatched: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesWatched')),
    markAllEpisodesUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesUnwatched')),
    episode: computed(() => this.ngxSignalTranslate.translate('Episode')),
  };
  protected readonly seasonsMetadata = signal<SeriesTrackerSeasonMetadataModel[]>([]);
  protected readonly watchedEpisodes = signal<SeriesTrackerWatchedEpisodeModel[]>([]);
  protected readonly watchedSet = computed(() => {
    const set = new Set<string>();
    for (const episode of this.watchedEpisodes()) {
      set.add(`${episode.season}-${episode.episode}`);
    }
    return set;
  });
  protected readonly hasSeasonMetadata = computed(() => this.seasonsMetadata().length > 0);
  protected readonly allEpisodesWatched = computed(() => {
    const seasons = this.seasonsMetadata();
    if (!seasons.length) return false;

    const watchedSet = this.watchedSet();
    for (const season of seasons) {
      for (let episode = 1; episode <= season.episodes; episode++) {
        if (!watchedSet.has(`${season.season}-${episode}`)) return false;
      }
    }
    return true;
  });

  protected readonly openSeasons = computed<Set<number>>(() =>
    getOpenSeasons(this.seasonsMetadata(), this.watchedSet())
  );

  public ngOnInit(): void {
    this.loadData();
  }

  private providerItemId(): string {
    return this.externalItemId() ?? this.imdbId() ?? '';
  }

  private loadData(): void {
    this.api
      .getSeriesTrackerSeasonsByExternalId(this.externalProvider(), this.providerItemId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((seasonsResponse) => {
        this.seasonsMetadata.set(seasonsResponse.seasons);
      });
    this.api
      .getSeriesTrackerWatchedEpisodesByExternalId(this.externalProvider(), this.providerItemId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((watchedResponse) => {
        if (!this.hasLocalWatchedEpisodeChanges) this.watchedEpisodes.set(watchedResponse.watchedEpisodes);
      });
  }

  protected isEpisodeWatched(season: number, episode: number): boolean {
    return this.watchedSet().has(`${season}-${episode}`);
  }

  protected isSeasonFullyWatched(season: number, episodesCount: number): boolean {
    for (let episode = 1; episode <= episodesCount; episode++) {
      if (!this.watchedSet().has(`${season}-${episode}`)) {
        return false;
      }
    }
    return true;
  }

  protected isSeasonPartiallyWatched(season: number, episodesCount: number): boolean {
    let watchedCount = 0;
    for (let episode = 1; episode <= episodesCount; episode++) {
      if (this.watchedSet().has(`${season}-${episode}`)) {
        watchedCount++;
      }
    }
    return watchedCount > 0 && watchedCount < episodesCount;
  }

  protected async onToggleEpisode(season: number, episode: number): Promise<void> {
    this.hasLocalWatchedEpisodeChanges = true;
    const key = `${season}-${episode}`;
    const currentWatched = this.watchedEpisodes();
    if (this.watchedSet().has(key)) {
      this.watchedEpisodes.set(
        currentWatched.filter(
          (watchedEpisode) => watchedEpisode.season !== season || watchedEpisode.episode !== episode
        )
      );
    } else {
      this.watchedEpisodes.set([...currentWatched, { season, episode }]);
    }
    await this.saveWatchedEpisodes();
  }

  protected async onToggleSeason(season: number, episodesCount: number): Promise<void> {
    this.hasLocalWatchedEpisodeChanges = true;
    const currentWatched = this.watchedEpisodes();
    const seasonEpisodes: SeriesTrackerWatchedEpisodeModel[] = [];
    for (let episode = 1; episode <= episodesCount; episode++) {
      seasonEpisodes.push({ season, episode });
    }

    const isFullyWatched = this.isSeasonFullyWatched(season, episodesCount);
    if (isFullyWatched) {
      this.watchedEpisodes.set(currentWatched.filter((watchedEpisode) => watchedEpisode.season !== season));
    } else {
      const withoutSeason = currentWatched.filter((watchedEpisode) => watchedEpisode.season !== season);
      this.watchedEpisodes.set([...withoutSeason, ...seasonEpisodes]);
    }
    await this.saveWatchedEpisodes();
  }

  protected isSeasonOpenDefault(season: number): boolean {
    return this.openSeasons().has(season);
  }

  protected getEpisodeTitle(seasonIndex: number, episodeIndex: number): string | undefined {
    return this.seasonsMetadata()[seasonIndex]?.titles?.[episodeIndex];
  }

  private async saveWatchedEpisodes(): Promise<void> {
    const episodes = this.watchedEpisodes()
      .slice()
      .sort((firstEpisode, secondEpisode) => {
        if (firstEpisode.season !== secondEpisode.season) {
          return firstEpisode.season - secondEpisode.season;
        }
        return firstEpisode.episode - secondEpisode.episode;
      });
    const version = ++this.saveWatchedEpisodesVersion;
    const save = this.saveWatchedEpisodesQueue
      .catch(() => undefined)
      .then(async () => {
        const result = await firstValueFrom(
          this.api.updateSeriesTrackerWatchedEpisodesByExternalId(this.externalProvider(), this.providerItemId(), {
            watchedEpisodes: episodes,
          })
        );
        if (version === this.saveWatchedEpisodesVersion) this.applySavedWatchedEpisodes(result);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.WatchedEpisodesSaved'));
      });
    this.saveWatchedEpisodesQueue = save;
    await save;
  }

  private async queueWatchedEpisodesMutation(
    action: () => Promise<SeriesTrackerWatchedEpisodesApiResponseModel>
  ): Promise<SeriesTrackerWatchedEpisodesApiResponseModel> {
    const version = ++this.saveWatchedEpisodesVersion;
    const save = this.saveWatchedEpisodesQueue
      .catch(() => undefined)
      .then(async () => {
        const result = await action();
        if (version === this.saveWatchedEpisodesVersion) this.applySavedWatchedEpisodes(result);
        return result;
      });
    this.saveWatchedEpisodesQueue = save.then(() => undefined);
    return save;
  }

  private applySavedWatchedEpisodes(result: SeriesTrackerWatchedEpisodesApiResponseModel): void {
    this.watchedEpisodes.set(result.watchedEpisodes);
    this.saved()(result.watchedEpisodes, result.item);
  }

  protected async onClose(): Promise<void> {
    await this.saveWatchedEpisodesQueue.catch(() => undefined);
    this.closed()();
  }

  protected onManageSeasonMetadata(): void {
    const providerInputs =
      this.externalProvider() === 'omdb'
        ? {}
        : { externalProvider: this.externalProvider(), externalItemId: this.providerItemId() };
    this.portal.openStacked(SeriesSeasonMetadataDialog, {
      imdbId: this.imdbId(),
      ...providerInputs,
      initialSeasons: this.seasonsMetadata(),
      saved: (seasons: SeriesTrackerSeasonMetadataModel[], item?: CollectionItemApiModel) => {
        this.seasonsMetadata.set(seasons);
        if (item) this.saved()(this.watchedEpisodes(), item);
      },
    });
  }

  protected async onMarkAllEpisodesWatched(): Promise<void> {
    if (!this.hasSeasonMetadata()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SetSeasonMetadataFirst'));
      return;
    }
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesWatched'))
    );
    if (!confirmed) return;

    this.hasLocalWatchedEpisodeChanges = true;
    this.spinnerLoadingState.setState('show', true);
    try {
      await this.queueWatchedEpisodesMutation(() =>
        firstValueFrom(this.api.markAllSeriesTrackerWatchedByExternalId(this.externalProvider(), this.providerItemId()))
      );
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedWatched'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMarkAllEpisodesUnwatched(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesUnwatched'))
    );
    if (!confirmed) return;

    this.hasLocalWatchedEpisodeChanges = true;
    this.spinnerLoadingState.setState('show', true);
    try {
      await this.queueWatchedEpisodesMutation(() =>
        firstValueFrom(
          this.api.updateSeriesTrackerWatchedEpisodesByExternalId(this.externalProvider(), this.providerItemId(), {
            watchedEpisodes: [],
          })
        )
      );
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedUnwatched'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }
}
