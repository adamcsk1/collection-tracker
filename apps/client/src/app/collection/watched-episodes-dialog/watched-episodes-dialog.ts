import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { spinnerLoadingStateToken } from '@components/spinner-loading/spinner-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import {
  CollectionItemApiModel,
  SeriesTrackerSeasonMetadataModel,
  SeriesTrackerWatchedEpisodeModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { getOpenSeasons } from './utils/get-open-seasons-util';

@Component({
  selector: 'ct-watched-episodes-dialog',
  imports: [DialogShell, Details],
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
  public readonly imdbId = input.required<string>();
  public readonly saved = input<
    (watchedEpisodes: SeriesTrackerWatchedEpisodeModel[], item?: CollectionItemApiModel) => void
  >(() => undefined);
  public readonly closed = input<() => void>(() => this.portal.close());
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('Title.WatchedEpisodes')),
    setSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('Message.SetSeasonMetadata')),
    manageSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    season: computed(() => this.ngxSignalTranslate.translate('Season')),
    markAllEpisodesWatched: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesWatched')),
    markAllEpisodesUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesUnwatched')),
    episode: computed(() => this.ngxSignalTranslate.translate('Episode')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
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

  private loadData(): void {
    this.api
      .getSeriesTrackerSeasons(this.imdbId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((seasonsResponse) => {
        this.seasonsMetadata.set(seasonsResponse.seasons);
      });
    this.api
      .getSeriesTrackerWatchedEpisodes(this.imdbId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((watchedResponse) => {
        this.watchedEpisodes.set(watchedResponse.watchedEpisodes);
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

  protected onToggleEpisode(season: number, episode: number): void {
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
  }

  protected onToggleSeason(season: number, episodesCount: number): void {
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
  }

  protected isSeasonOpenDefault(season: number): boolean {
    return this.openSeasons().has(season);
  }

  protected getEpisodeTitle(seasonIndex: number, episodeIndex: number): string | undefined {
    return this.seasonsMetadata()[seasonIndex]?.titles?.[episodeIndex];
  }

  protected async onSave(): Promise<void> {
    const episodes = this.watchedEpisodes()
      .slice()
      .sort((firstEpisode, secondEpisode) => {
        if (firstEpisode.season !== secondEpisode.season) {
          return firstEpisode.season - secondEpisode.season;
        }
        return firstEpisode.episode - secondEpisode.episode;
      });
    const result = await firstValueFrom(
      this.api.updateSeriesTrackerWatchedEpisodes(this.imdbId(), { watchedEpisodes: episodes })
    );
    this.saved()(result.watchedEpisodes, result.item);
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.WatchedEpisodesSaved'));
    this.onClose();
  }

  protected onClose(): void {
    this.closed()();
  }

  protected onManageSeasonMetadata(): void {
    this.portal.open(SeriesSeasonMetadataDialog, {
      imdbId: this.imdbId(),
      initialSeasons: this.seasonsMetadata(),
      saved: (seasons: SeriesTrackerSeasonMetadataModel[], item?: CollectionItemApiModel) => {
        this.seasonsMetadata.set(seasons);
        if (item) this.saved()(this.watchedEpisodes(), item);
      },
      closed: () =>
        this.portal.open(WatchedEpisodesDialog, {
          imdbId: this.imdbId(),
          saved: this.saved(),
          closed: this.closed(),
        }),
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

    this.spinnerLoadingState.setState('show', true);
    try {
      const result = await firstValueFrom(this.api.markAllSeriesTrackerWatched(this.imdbId()));
      this.watchedEpisodes.set(result.watchedEpisodes);
      this.saved()(result.watchedEpisodes, result.item);
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

    this.spinnerLoadingState.setState('show', true);
    try {
      const result = await firstValueFrom(
        this.api.updateSeriesTrackerWatchedEpisodes(this.imdbId(), { watchedEpisodes: [] })
      );
      this.watchedEpisodes.set(result.watchedEpisodes);
      this.saved()(result.watchedEpisodes, result.item);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedUnwatched'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }
}
