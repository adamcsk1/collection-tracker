import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WatchedEpisodesDialog } from './watched-episodes-dialog';

describe('WatchedEpisodesDialog', () => {
  let fixture: ComponentFixture<WatchedEpisodesDialog>;
  let component: WatchedEpisodesDialog;
  let api: {
    getSeriesTrackerSeasons: ReturnType<typeof vi.fn>;
    getSeriesTrackerWatchedEpisodes: ReturnType<typeof vi.fn>;
    updateSeriesTrackerWatchedEpisodes: ReturnType<typeof vi.fn>;
  };
  let portal: { close: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
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
    };
    portal = { close: vi.fn(), open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [WatchedEpisodesDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialToastState, toastStateToken),
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

  it('toggles an episode watched state', () => {
    component['onToggleEpisode'](1, 1);

    expect(component['watchedEpisodes']()).toEqual([
      { season: 1, episode: 2 },
      { season: 1, episode: 1 },
    ]);

    component['onToggleEpisode'](1, 2);

    expect(component['watchedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('toggles all episodes in a season', () => {
    component['onToggleSeason'](1, 3);

    expect(component['watchedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);

    component['onToggleSeason'](1, 3);

    expect(component['watchedEpisodes']()).toEqual([]);
  });

  it('saves watched episodes and notifies parent', async () => {
    api.updateSeriesTrackerWatchedEpisodes.mockReturnValue(
      of({ watchedEpisodes: [{ season: 1, episode: 1 }], lastWatchedEpisode: { season: 1, episode: 1 } })
    );
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    component['watchedEpisodes'].set([{ season: 1, episode: 1 }]);

    await component['onSave']();

    expect(api.updateSeriesTrackerWatchedEpisodes).toHaveBeenCalledWith('tt-series', {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
    expect(saved).toHaveBeenCalledWith([{ season: 1, episode: 1 }], undefined);
    expect(toastState.state.message()).toBe('Toast.WatchedEpisodesSaved');
    expect(portal.close).toHaveBeenCalled();
  });

  it('calls the closed callback when closed', () => {
    component['onClose']();

    expect(portal.close).toHaveBeenCalled();
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
});
