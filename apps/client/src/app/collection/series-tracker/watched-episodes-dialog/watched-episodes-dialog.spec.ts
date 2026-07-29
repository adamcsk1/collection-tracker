import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { WatchedEpisodesDialog } from './watched-episodes-dialog';

describe('WatchedEpisodesDialog', () => {
  let fixture: ComponentFixture<WatchedEpisodesDialog>;
  let component: WatchedEpisodesDialog;
  let api: {
    getSeriesTrackerSeasonsByExternalId: ReturnType<typeof vi.fn>;
    getSeriesTrackerWatchedEpisodesByExternalId: ReturnType<typeof vi.fn>;
    updateSeriesTrackerWatchedEpisodesByExternalId: ReturnType<typeof vi.fn>;
    markAllSeriesTrackerWatchedByExternalId: ReturnType<typeof vi.fn>;
  };
  let portal: {
    closeTop: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    openStacked: ReturnType<typeof vi.fn>;
  };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<ToastState>;

  beforeEach(() => {
    api = {
      getSeriesTrackerSeasonsByExternalId: vi.fn(() => of({ seasons: [{ season: 1, episodes: 3, titles: [] }] })),
      getSeriesTrackerWatchedEpisodesByExternalId: vi.fn(() =>
        of({ watchedEpisodes: [{ season: 1, episode: 2 }], lastWatchedEpisode: { season: 1, episode: 2 } })
      ),
      updateSeriesTrackerWatchedEpisodesByExternalId: vi.fn(() =>
        of({ watchedEpisodes: [{ season: 1, episode: 2 }], lastWatchedEpisode: { season: 1, episode: 2 } })
      ),
      markAllSeriesTrackerWatchedByExternalId: vi.fn(() =>
        of({
          watchedEpisodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
            { season: 1, episode: 3 },
          ],
          lastWatchedEpisode: { season: 1, episode: 3 },
          item: { hash: 'completed-hash' },
        })
      ),
    };
    portal = { closeTop: vi.fn(), open: vi.fn(), openStacked: vi.fn() };
    confirm = { open: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [WatchedEpisodesDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: PortalService, useValue: portal },
        { provide: ConfirmService, useValue: confirm },
        { provide: WebstorageService, useValue: { getItem: vi.fn(() => null), setItem: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialToastState, toastStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
      ],
    });
    fixture = TestBed.createComponent(WatchedEpisodesDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    fixture.componentRef.setInput('imdbId', 'tt-series');
    fixture.componentRef.setInput('saved', vi.fn());
    fixture.componentRef.setInput('closed', portal.closeTop);
    fixture.detectChanges();
  });

  it('loads seasons metadata and watched episodes on init', () => {
    expect(api.getSeriesTrackerSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(api.getSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['seasonsMetadata']()).toEqual([{ season: 1, episodes: 3, titles: [] }]);
    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
  });

  it('renders the translated mark-all action for both watched states', () => {
    const markWatchedButton = fixture.nativeElement.querySelector(
      '[data-test-id="watched-episodes-mark-all-watched"]'
    ) as HTMLButtonElement;

    expect(markWatchedButton.type).toBe('button');
    expect(markWatchedButton.classList.contains('button-icon')).toBe(true);
    expect(markWatchedButton.getAttribute('aria-label')).toBe('MarkAllEpisodesWatched');
    expect(markWatchedButton.title).toBe('MarkAllEpisodesWatched');

    component['watchedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    fixture.detectChanges();

    const markUnwatchedButton = fixture.nativeElement.querySelector(
      '[data-test-id="watched-episodes-mark-all-unwatched"]'
    ) as HTMLButtonElement;
    expect(markUnwatchedButton.classList.contains('button-icon')).toBe(true);
    expect(markUnwatchedButton.getAttribute('aria-label')).toBe('MarkAllEpisodesUnwatched');
    expect(markUnwatchedButton.title).toBe('MarkAllEpisodesUnwatched');
  });

  it('computes watched set from episodes', () => {
    expect(component['watchedSet']().has('1-2')).toBe(true);
    expect(component['watchedSet']().has('1-1')).toBe(false);
  });

  it('detects fully watched season', () => {
    component['watchedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);

    expect(component['isSeasonFullyWatched'](1, 3)).toBe(true);
    expect(component['isSeasonPartiallyWatched'](1, 3)).toBe(false);
  });

  it('detects partially watched season', () => {
    expect(component['isSeasonFullyWatched'](1, 3)).toBe(false);
    expect(component['isSeasonPartiallyWatched'](1, 3)).toBe(true);
  });

  it('detects unwatched season', () => {
    component['watchedEpisodes'].set([]);

    expect(component['isSeasonFullyWatched'](1, 3)).toBe(false);
    expect(component['isSeasonPartiallyWatched'](1, 3)).toBe(false);
  });

  it('toggles an episode watched state and saves automatically', async () => {
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastWatchedEpisode: { season: 1, episode: 2 },
      })
    );
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onToggleEpisode'](1, 1);

    expect(component['watchedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
    });
    expect(saved).toHaveBeenCalledWith(
      [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      undefined
    );
    expect(toastState.state.message()).toBe('Toast.WatchedEpisodesSaved');
    expect(portal.closeTop).not.toHaveBeenCalled();

    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockClear();
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
    );

    await component['onToggleEpisode'](1, 2);

    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
  });

  it('toggles all episodes in a season and saves automatically', async () => {
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
        ],
        lastWatchedEpisode: { season: 1, episode: 3 },
      })
    );

    await component['onToggleSeason'](1, 3);

    expect(component['watchedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    });

    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockClear();
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({ watchedEpisodes: [], lastWatchedEpisode: null })
    );

    await component['onToggleSeason'](1, 3);

    expect(component['watchedEpisodes']()).toEqual([]);
    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      watchedEpisodes: [],
    });
  });

  it('saves watched episodes in episode order', async () => {
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({
        watchedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastWatchedEpisode: { season: 1, episode: 2 },
      })
    );
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    component['watchedEpisodes'].set([{ season: 1, episode: 2 }]);

    await component['onToggleEpisode'](1, 1);

    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
    });
    expect(saved).toHaveBeenCalledWith(
      [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      undefined
    );
    expect(toastState.state.message()).toBe('Toast.WatchedEpisodesSaved');
    expect(portal.closeTop).not.toHaveBeenCalled();
  });

  it('does not apply stale auto-save responses over newer local edits', async () => {
    const pendingEpisodeSave = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateSeriesTrackerWatchedEpisodesByExternalId
      .mockReturnValueOnce(pendingEpisodeSave.asObservable())
      .mockReturnValueOnce(
        of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
      );

    const firstSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledTimes(1));
    const secondSave = component['onToggleEpisode'](1, 2);

    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);

    pendingEpisodeSave.next({
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      lastWatchedEpisode: { season: 1, episode: 2 },
    });
    pendingEpisodeSave.complete();

    await firstSave;

    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);

    await secondSave;

    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenNthCalledWith(2, 'omdb', 'tt-series', {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('calls the closed callback when closed', async () => {
    await component['onClose']();

    expect(portal.closeTop).toHaveBeenCalled();
  });

  it('waits for a pending auto-save before closing', async () => {
    const pendingEpisodeSave = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(pendingEpisodeSave.asObservable());

    const episodeSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalled());

    const close = component['onClose']();
    await Promise.resolve();

    expect(portal.closeTop).not.toHaveBeenCalled();

    pendingEpisodeSave.next({
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      lastWatchedEpisode: { season: 1, episode: 2 },
    });
    pendingEpisodeSave.complete();

    await episodeSave;
    await close;

    expect(portal.closeTop).toHaveBeenCalled();
  });

  it('ignores a late initial watched episodes response after local edits', async () => {
    const watchedEpisodesLoad = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.getSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(watchedEpisodesLoad.asObservable());
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
    );
    const lateLoadFixture = TestBed.createComponent(WatchedEpisodesDialog);
    const lateLoadComponent = lateLoadFixture.componentInstance;
    lateLoadFixture.componentRef.setInput('imdbId', 'tt-series');
    lateLoadFixture.componentRef.setInput('saved', vi.fn());
    lateLoadFixture.componentRef.setInput('closed', portal.closeTop);
    lateLoadFixture.detectChanges();

    await lateLoadComponent['onToggleEpisode'](1, 1);
    watchedEpisodesLoad.next({
      watchedEpisodes: [{ season: 1, episode: 2 }],
      lastWatchedEpisode: { season: 1, episode: 2 },
    });

    expect(lateLoadComponent['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('shows no metadata message when seasons are empty', () => {
    api.getSeriesTrackerSeasonsByExternalId.mockReturnValue(of({ seasons: [] }));
    component['seasonsMetadata'].set([]);

    expect(component['hasSeasonMetadata']()).toBe(false);
  });

  it('computes openSeasons from seasonsMetadata and watchedEpisodes', () => {
    component['seasonsMetadata'].set([
      { season: 1, episodes: 2, titles: [] },
      { season: 2, episodes: 2, titles: [] },
    ]);
    component['watchedEpisodes'].set([{ season: 1, episode: 1 }]);

    expect(component['openSeasons']()).toEqual(new Set([1]));
    expect(component['isSeasonOpenDefault'](1)).toBe(true);
    expect(component['isSeasonOpenDefault'](2)).toBe(false);
  });

  it('delegates isSeasonOpenDefault to the openSeasons set', () => {
    component['seasonsMetadata'].set([
      { season: 1, episodes: 2, titles: [] },
      { season: 2, episodes: 2, titles: [] },
    ]);
    component['watchedEpisodes'].set([{ season: 1, episode: 1 }]);

    expect(component['isSeasonOpenDefault'](1)).toBe(true);
    expect(component['isSeasonOpenDefault'](2)).toBe(false);
  });

  it('opens stacked metadata management and wires saved callback', () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    component['onManageSeasonMetadata']();

    expect(portal.openStacked).toHaveBeenCalledWith(SeriesSeasonMetadataDialog, {
      imdbId: 'tt-series',
      externalProvider: 'omdb',
      externalItemId: 'tt-series',
      initialSeasons: [{ season: 1, episodes: 3, titles: [] }],
      saved: expect.any(Function),
    });

    const metadataInputs = portal.openStacked.mock.calls[0][1] as {
      saved: (seasons: [{ season: number; episodes: number; titles: string[] }], item?: { hash: string }) => void;
    };
    metadataInputs.saved([{ season: 2, episodes: 4, titles: [] }], { hash: 'metadata-hash' });

    expect(component['seasonsMetadata']()).toEqual([{ season: 2, episodes: 4, titles: [] }]);
    expect(saved).toHaveBeenCalledWith([{ season: 1, episode: 2 }], { hash: 'metadata-hash' });
  });

  it('shows toast when no season metadata exists on mark all watched', async () => {
    component['seasonsMetadata'].set([]);

    await component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatchedByExternalId).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.SetSeasonMetadataFirst');
  });

  it('marks all episodes watched after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatchedByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['watchedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    expect(saved).toHaveBeenCalledWith(
      [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
      { hash: 'completed-hash' }
    );
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedWatched');
  });

  it('queues mark all watched behind a pending episode auto-save', async () => {
    const pendingEpisodeSave = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(pendingEpisodeSave.asObservable());

    const episodeSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalled());
    const markAllSave = component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatchedByExternalId).not.toHaveBeenCalled();

    pendingEpisodeSave.next({
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      lastWatchedEpisode: { season: 1, episode: 2 },
    });
    pendingEpisodeSave.complete();

    await episodeSave;
    await markAllSave;

    expect(api.markAllSeriesTrackerWatchedByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['watchedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedWatched');
  });

  it('does not mark all episodes watched when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatchedByExternalId).not.toHaveBeenCalled();
  });

  it('clears watched episodes after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    api.updateSeriesTrackerWatchedEpisodesByExternalId.mockReturnValue(
      of({ watchedEpisodes: [], lastWatchedEpisode: null, item: { hash: 'unwatched-hash' } })
    );

    await component['onMarkAllEpisodesUnwatched']();

    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      watchedEpisodes: [],
    });
    expect(component['watchedEpisodes']()).toEqual([]);
    expect(saved).toHaveBeenCalledWith([], { hash: 'unwatched-hash' });
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedUnwatched');
  });

  it('does not clear watched episodes when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onMarkAllEpisodesUnwatched']();

    expect(api.updateSeriesTrackerWatchedEpisodesByExternalId).not.toHaveBeenCalled();
  });
});
