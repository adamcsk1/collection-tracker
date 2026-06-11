import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
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
    getSeriesTrackerSeasons: ReturnType<typeof vi.fn>;
    getSeriesTrackerWatchedEpisodes: ReturnType<typeof vi.fn>;
    updateSeriesTrackerWatchedEpisodes: ReturnType<typeof vi.fn>;
    markAllSeriesTrackerWatched: ReturnType<typeof vi.fn>;
  };
  let portal: { close: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<ToastState>;

  beforeEach(() => {
    api = {
      getSeriesTrackerSeasons: vi.fn(() => of({ seasons: [{ season: 1, episodes: 3, titles: [] }] })),
      getSeriesTrackerWatchedEpisodes: vi.fn(() =>
        of({ watchedEpisodes: [{ season: 1, episode: 2 }], lastWatchedEpisode: { season: 1, episode: 2 } })
      ),
      updateSeriesTrackerWatchedEpisodes: vi.fn(() =>
        of({ watchedEpisodes: [{ season: 1, episode: 2 }], lastWatchedEpisode: { season: 1, episode: 2 } })
      ),
      markAllSeriesTrackerWatched: vi.fn(() =>
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
    portal = { close: vi.fn(), open: vi.fn() };
    confirm = { open: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [WatchedEpisodesDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: PortalService, useValue: portal },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialToastState, toastStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
      ],
    });
    TestBed.overrideComponent(WatchedEpisodesDialog, { set: { template: '' } });

    fixture = TestBed.createComponent(WatchedEpisodesDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    fixture.componentRef.setInput('imdbId', 'tt-series');
    fixture.componentRef.setInput('saved', vi.fn());
    fixture.componentRef.setInput('closed', portal.close);
    fixture.detectChanges();
  });

  it('loads seasons metadata and watched episodes on init', () => {
    expect(api.getSeriesTrackerSeasons).toHaveBeenCalledWith('tt-series');
    expect(api.getSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series');
    expect(component['seasonsMetadata']()).toEqual([{ season: 1, episodes: 3, titles: [] }]);
    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
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
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
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
    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', {
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
    expect(portal.close).not.toHaveBeenCalled();

    api.updateSeriesTrackerWatchedEpisodes.mockClear();
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
      of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
    );

    await component['onToggleEpisode'](1, 2);

    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
  });

  it('toggles all episodes in a season and saves automatically', async () => {
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
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
    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    });

    api.updateSeriesTrackerWatchedEpisodes.mockClear();
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(of({ watchedEpisodes: [], lastWatchedEpisode: null }));

    await component['onToggleSeason'](1, 3);

    expect(component['watchedEpisodes']()).toEqual([]);
    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', { watchedEpisodes: [] });
  });

  it('saves watched episodes in episode order', async () => {
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
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

    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', {
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
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('does not apply stale auto-save responses over newer local edits', async () => {
    const pendingEpisodeSave = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateSeriesTrackerWatchedEpisodes
      .mockReturnValueOnce(pendingEpisodeSave.asObservable())
      .mockReturnValueOnce(
        of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
      );

    const firstSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledTimes(1));
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

    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenNthCalledWith(2, 'tt-series', {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('calls the closed callback when closed', async () => {
    await component['onClose']();

    expect(portal.close).toHaveBeenCalled();
  });

  it('waits for a pending auto-save before closing', async () => {
    const pendingEpisodeSave = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(pendingEpisodeSave.asObservable());

    const episodeSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalled());

    const close = component['onClose']();
    await Promise.resolve();

    expect(portal.close).not.toHaveBeenCalled();

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

    expect(portal.close).toHaveBeenCalled();
  });

  it('ignores a late initial watched episodes response after local edits', async () => {
    const watchedEpisodesLoad = new Subject<{
      watchedEpisodes: { season: number; episode: number }[];
      lastWatchedEpisode: { season: number; episode: number } | null;
    }>();
    api.getSeriesTrackerWatchedEpisodes.mockReturnValue(watchedEpisodesLoad.asObservable());
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
      of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
    );
    const lateLoadFixture = TestBed.createComponent(WatchedEpisodesDialog);
    const lateLoadComponent = lateLoadFixture.componentInstance;
    lateLoadFixture.componentRef.setInput('imdbId', 'tt-series');
    lateLoadFixture.componentRef.setInput('saved', vi.fn());
    lateLoadFixture.componentRef.setInput('closed', portal.close);
    lateLoadFixture.detectChanges();

    await lateLoadComponent['onToggleEpisode'](1, 1);
    watchedEpisodesLoad.next({
      watchedEpisodes: [{ season: 1, episode: 2 }],
      lastWatchedEpisode: { season: 1, episode: 2 },
    });

    expect(lateLoadComponent['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('shows no metadata message when seasons are empty', () => {
    api.getSeriesTrackerSeasons.mockReturnValue(of({ seasons: [] }));
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

  it('opens metadata management and wires saved and closed callbacks', () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    component['onManageSeasonMetadata']();

    expect(portal.open).toHaveBeenCalledWith(SeriesSeasonMetadataDialog, {
      imdbId: 'tt-series',
      initialSeasons: [{ season: 1, episodes: 3, titles: [] }],
      saved: expect.any(Function),
      closed: expect.any(Function),
    });

    const metadataInputs = portal.open.mock.calls[0][1] as {
      saved: (seasons: [{ season: number; episodes: number; titles: string[] }], item?: { hash: string }) => void;
      closed: () => void;
    };
    metadataInputs.saved([{ season: 2, episodes: 4, titles: [] }], { hash: 'metadata-hash' });

    expect(component['seasonsMetadata']()).toEqual([{ season: 2, episodes: 4, titles: [] }]);
    expect(saved).toHaveBeenCalledWith([{ season: 1, episode: 2 }], { hash: 'metadata-hash' });

    metadataInputs.closed();

    expect(portal.open).toHaveBeenLastCalledWith(WatchedEpisodesDialog, {
      imdbId: 'tt-series',
      saved,
      closed: portal.close,
    });
  });

  it('shows toast when no season metadata exists on mark all watched', async () => {
    component['seasonsMetadata'].set([]);

    await component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatched).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.SetSeasonMetadataFirst');
  });

  it('marks all episodes watched after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatched).toHaveBeenCalledWith('tt-series');
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
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(pendingEpisodeSave.asObservable());

    const episodeSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalled());
    const markAllSave = component['onMarkAllEpisodesWatched']();

    expect(api.markAllSeriesTrackerWatched).not.toHaveBeenCalled();

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

    expect(api.markAllSeriesTrackerWatched).toHaveBeenCalledWith('tt-series');
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

    expect(api.markAllSeriesTrackerWatched).not.toHaveBeenCalled();
  });

  it('clears watched episodes after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
      of({ watchedEpisodes: [], lastWatchedEpisode: null, item: { hash: 'unwatched-hash' } })
    );

    await component['onMarkAllEpisodesUnwatched']();

    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', { watchedEpisodes: [] });
    expect(component['watchedEpisodes']()).toEqual([]);
    expect(saved).toHaveBeenCalledWith([], { hash: 'unwatched-hash' });
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedUnwatched');
  });

  it('does not clear watched episodes when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onMarkAllEpisodesUnwatched']();

    expect(api.updateSeriesTrackerWatchedEpisodes).not.toHaveBeenCalled();
  });
});
