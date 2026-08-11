import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Checkbox } from '@components/checkbox/checkbox';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { RevealLabel } from '@components/reveal-label/reveal-label';
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
import { firstValueFrom } from 'rxjs';

import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { getOpenSeasons } from './utils/get-open-seasons-util';

@Component({
  selector: 'ct-completed-episodes-dialog',
  imports: [Checkbox, DialogShell, Details, RevealLabel],
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
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private saveCompletedEpisodesQueue = Promise.resolve();
  private saveCompletedEpisodesVersion = 0;
  private hasLocalCompletedEpisodeChanges = false;
  public readonly imdbId = input<string | undefined>();
  public readonly externalProvider = input(DEFAULT_EXTERNAL_METADATA_PROVIDER);
  public readonly externalItemId = input<string | undefined>();
  public readonly ownerShareCode = input<string | undefined>();
  public readonly saved = input<
    (completedEpisodes: TrackingCompletedEpisodeModel[], item?: CollectionItemApiModel) => void
  >(() => undefined);
  public readonly closed = input<() => void>(() => this.portal.closeTop());
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('Title.CompletedEpisodes')),
    setSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('Message.SetSeasonMetadata')),
    manageSeasonMetadata: computed(() => this.ngxSignalTranslate.translate('ManageSeriesMetadata')),
    season: computed(() => this.ngxSignalTranslate.translate('Season')),
    markAllEpisodesCompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesCompleted')),
    markAllEpisodesUncompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllEpisodesUncompleted')),
    episode: computed(() => this.ngxSignalTranslate.translate('Episode')),
  };
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

  protected readonly openSeasons = computed<Set<number>>(() =>
    getOpenSeasons(this.seasonsMetadata(), this.completedSet())
  );

  public ngOnInit(): void {
    this.loadData();
  }

  private providerItemId(): string {
    return this.externalItemId() ?? this.imdbId() ?? '';
  }

  private loadData(): void {
    const ownerShareCode = this.ownerShareCode();
    const seasonsRequest = ownerShareCode
      ? this.api.getTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId(), ownerShareCode)
      : this.api.getTrackingSeasonsByExternalId(this.externalProvider(), this.providerItemId());
    seasonsRequest.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((seasonsResponse) => {
      this.seasonsMetadata.set(seasonsResponse.seasons);
    });
    const completedEpisodesRequest = ownerShareCode
      ? this.api.getTrackingCompletedEpisodesByExternalId(
          this.externalProvider(),
          this.providerItemId(),
          ownerShareCode
        )
      : this.api.getTrackingCompletedEpisodesByExternalId(this.externalProvider(), this.providerItemId());
    completedEpisodesRequest.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((completedResponse) => {
      if (!this.hasLocalCompletedEpisodeChanges) this.completedEpisodes.set(completedResponse.completedEpisodes);
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
    await this.saveCompletedEpisodes();
  }

  protected async onToggleSeason(season: number, episodesCount: number): Promise<void> {
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
    await this.saveCompletedEpisodes();
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
    const version = ++this.saveCompletedEpisodesVersion;
    const save = this.saveCompletedEpisodesQueue
      .catch(() => undefined)
      .then(async () => {
        const ownerShareCode = this.ownerShareCode();
        const updateRequest = ownerShareCode
          ? this.api.updateTrackingCompletedEpisodesByExternalId(
              this.externalProvider(),
              this.providerItemId(),
              { completedEpisodes: episodes },
              ownerShareCode
            )
          : this.api.updateTrackingCompletedEpisodesByExternalId(this.externalProvider(), this.providerItemId(), {
              completedEpisodes: episodes,
            });
        const result = await firstValueFrom(updateRequest);
        if (version === this.saveCompletedEpisodesVersion) this.applySavedCompletedEpisodes(result);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CompletedEpisodesSaved'));
      });
    this.saveCompletedEpisodesQueue = save;
    await save;
  }

  private async queueCompletedEpisodesMutation(
    action: () => Promise<TrackingCompletedEpisodesApiResponseModel>
  ): Promise<TrackingCompletedEpisodesApiResponseModel> {
    const version = ++this.saveCompletedEpisodesVersion;
    const save = this.saveCompletedEpisodesQueue
      .catch(() => undefined)
      .then(async () => {
        const result = await action();
        if (version === this.saveCompletedEpisodesVersion) this.applySavedCompletedEpisodes(result);
        return result;
      });
    this.saveCompletedEpisodesQueue = save.then(() => undefined);
    return save;
  }

  private applySavedCompletedEpisodes(result: TrackingCompletedEpisodesApiResponseModel): void {
    this.completedEpisodes.set(result.completedEpisodes);
    this.saved()(result.completedEpisodes, result.item);
  }

  protected async onClose(): Promise<void> {
    await this.saveCompletedEpisodesQueue.catch(() => undefined);
    this.closed()();
  }

  protected onManageSeasonMetadata(): void {
    this.portal.openStacked(SeriesSeasonMetadataDialog, {
      imdbId: this.imdbId(),
      externalProvider: this.externalProvider(),
      externalItemId: this.providerItemId(),
      ...(this.ownerShareCode() ? { ownerShareCode: this.ownerShareCode() } : {}),
      initialSeasons: this.seasonsMetadata(),
      saved: (seasons: TrackingSeasonMetadataModel[], item?: CollectionItemApiModel) => {
        this.seasonsMetadata.set(seasons);
        if (item) this.saved()(this.completedEpisodes(), item);
      },
    });
  }

  protected async onMarkAllEpisodesCompleted(): Promise<void> {
    if (!this.hasSeasonMetadata()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SetSeasonMetadataFirst'));
      return;
    }
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesCompleted'))
    );
    if (!confirmed) return;

    this.hasLocalCompletedEpisodeChanges = true;
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
                    Array.from({ length: season.episodes }, (_, index) => ({
                      season: season.season,
                      episode: index + 1,
                    }))
                  ),
                },
                ownerShareCode
              )
            )
          : firstValueFrom(
              this.api.markAllTrackingCompletedByExternalId(this.externalProvider(), this.providerItemId())
            )
      );
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedCompleted'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }

  protected async onMarkAllEpisodesUncompleted(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirm.open(this.ngxSignalTranslate.translate('Confirm.MarkAllEpisodesUncompleted'))
    );
    if (!confirmed) return;

    this.hasLocalCompletedEpisodeChanges = true;
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
                ownerShareCode
              )
            : this.api.updateTrackingCompletedEpisodesByExternalId(this.externalProvider(), this.providerItemId(), {
                completedEpisodes: [],
              })
        )
      );
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AllEpisodesMarkedUncompleted'));
    } finally {
      this.spinnerLoadingState.setState('show', false);
    }
  }
}
