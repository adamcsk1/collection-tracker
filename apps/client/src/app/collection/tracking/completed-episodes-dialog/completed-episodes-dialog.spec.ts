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
import { CompletedEpisodesDialog } from './completed-episodes-dialog';

describe('CompletedEpisodesDialog', () => {
  let fixture: ComponentFixture<CompletedEpisodesDialog>;
  let component: CompletedEpisodesDialog;
  let api: {
    getTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    getTrackingCompletedEpisodesByExternalId: ReturnType<typeof vi.fn>;
    updateTrackingCompletedEpisodesByExternalId: ReturnType<typeof vi.fn>;
    markAllTrackingCompletedByExternalId: ReturnType<typeof vi.fn>;
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
      getTrackingSeasonsByExternalId: vi.fn(() => of({ seasons: [{ season: 1, episodes: 3, titles: [] }] })),
      getTrackingCompletedEpisodesByExternalId: vi.fn(() =>
        of({ completedEpisodes: [{ season: 1, episode: 2 }], lastCompletedEpisode: { season: 1, episode: 2 } })
      ),
      updateTrackingCompletedEpisodesByExternalId: vi.fn(() =>
        of({ completedEpisodes: [{ season: 1, episode: 2 }], lastCompletedEpisode: { season: 1, episode: 2 } })
      ),
      markAllTrackingCompletedByExternalId: vi.fn(() =>
        of({
          completedEpisodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
            { season: 1, episode: 3 },
          ],
          lastCompletedEpisode: { season: 1, episode: 3 },
          item: { hash: 'completed-hash' },
        })
      ),
    };
    portal = { closeTop: vi.fn(), open: vi.fn(), openStacked: vi.fn() };
    confirm = { open: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [CompletedEpisodesDialog],
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
    fixture = TestBed.createComponent(CompletedEpisodesDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    fixture.componentRef.setInput('imdbId', 'tt-series');
    fixture.componentRef.setInput('saved', vi.fn());
    fixture.componentRef.setInput('closed', portal.closeTop);
    fixture.detectChanges();
  });

  it('loads seasons metadata and completed episodes on init', () => {
    expect(api.getTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['seasonsMetadata']()).toEqual([{ season: 1, episodes: 3, titles: [] }]);
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
  });

  it('renders the translated mark-all action for both completed states', () => {
    const markCompletedButton = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-mark-all-completed"]'
    ) as HTMLButtonElement;

    expect(markCompletedButton.type).toBe('button');
    expect(markCompletedButton.classList.contains('button-icon')).toBe(true);
    expect(markCompletedButton.getAttribute('aria-label')).toBe('MarkAllEpisodesCompleted');
    expect(markCompletedButton.title).toBe('MarkAllEpisodesCompleted');

    component['completedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    fixture.detectChanges();

    const markUncompletedButton = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-mark-all-uncompleted"]'
    ) as HTMLButtonElement;
    expect(markUncompletedButton.classList.contains('button-icon')).toBe(true);
    expect(markUncompletedButton.getAttribute('aria-label')).toBe('MarkAllEpisodesUncompleted');
    expect(markUncompletedButton.title).toBe('MarkAllEpisodesUncompleted');
  });

  it('computes completed set from episodes', () => {
    expect(component['completedSet']().has('1-2')).toBe(true);
    expect(component['completedSet']().has('1-1')).toBe(false);
  });

  it('detects fully completed season', () => {
    component['completedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);

    expect(component['isSeasonFullyCompleted'](1, 3)).toBe(true);
    expect(component['isSeasonPartiallyCompleted'](1, 3)).toBe(false);
  });

  it('detects partially completed season', () => {
    expect(component['isSeasonFullyCompleted'](1, 3)).toBe(false);
    expect(component['isSeasonPartiallyCompleted'](1, 3)).toBe(true);
  });

  it('detects uncompleted season', () => {
    component['completedEpisodes'].set([]);

    expect(component['isSeasonFullyCompleted'](1, 3)).toBe(false);
    expect(component['isSeasonPartiallyCompleted'](1, 3)).toBe(false);
  });

  it('toggles an episode completed state and saves automatically', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastCompletedEpisode: { season: 1, episode: 2 },
      })
    );
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onToggleEpisode'](1, 1);

    expect(component['completedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      completedEpisodes: [
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
    expect(toastState.state.message()).toBe('Toast.CompletedEpisodesSaved');
    expect(portal.closeTop).not.toHaveBeenCalled();

    api.updateTrackingCompletedEpisodesByExternalId.mockClear();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [{ season: 1, episode: 1 }], lastCompletedEpisode: { season: 1, episode: 1 } })
    );

    await component['onToggleEpisode'](1, 2);

    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      completedEpisodes: [{ season: 1, episode: 1 }],
    });
  });

  it('toggles all episodes in a season and saves automatically', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
        ],
        lastCompletedEpisode: { season: 1, episode: 3 },
      })
    );

    await component['onToggleSeason'](1, 3);

    expect(component['completedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      completedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    });

    api.updateTrackingCompletedEpisodesByExternalId.mockClear();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [], lastCompletedEpisode: null })
    );

    await component['onToggleSeason'](1, 3);

    expect(component['completedEpisodes']()).toEqual([]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      completedEpisodes: [],
    });
  });

  it('saves completed episodes in episode order', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
        lastCompletedEpisode: { season: 1, episode: 2 },
      })
    );
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    component['completedEpisodes'].set([{ season: 1, episode: 2 }]);

    await component['onToggleEpisode'](1, 1);

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      completedEpisodes: [
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
    expect(toastState.state.message()).toBe('Toast.CompletedEpisodesSaved');
    expect(portal.closeTop).not.toHaveBeenCalled();
  });

  it('does not apply stale auto-save responses over newer local edits', async () => {
    const pendingEpisodeSave = new Subject<{
      completedEpisodes: { season: number; episode: number }[];
      lastCompletedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateTrackingCompletedEpisodesByExternalId
      .mockReturnValueOnce(pendingEpisodeSave.asObservable())
      .mockReturnValueOnce(
        of({ completedEpisodes: [{ season: 1, episode: 1 }], lastCompletedEpisode: { season: 1, episode: 1 } })
      );

    const firstSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(1));
    const secondSave = component['onToggleEpisode'](1, 2);

    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);

    pendingEpisodeSave.next({
      completedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      lastCompletedEpisode: { season: 1, episode: 2 },
    });
    pendingEpisodeSave.complete();

    await firstSave;

    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);

    await secondSave;

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenNthCalledWith(2, 'omdb', 'tt-series', {
      completedEpisodes: [{ season: 1, episode: 1 }],
    });
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('calls the closed callback when closed', async () => {
    await component['onClose']();

    expect(portal.closeTop).toHaveBeenCalled();
  });

  it('waits for a pending auto-save before closing', async () => {
    const pendingEpisodeSave = new Subject<{
      completedEpisodes: { season: number; episode: number }[];
      lastCompletedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(pendingEpisodeSave.asObservable());

    const episodeSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalled());

    const close = component['onClose']();
    await Promise.resolve();

    expect(portal.closeTop).not.toHaveBeenCalled();

    pendingEpisodeSave.next({
      completedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      lastCompletedEpisode: { season: 1, episode: 2 },
    });
    pendingEpisodeSave.complete();

    await episodeSave;
    await close;

    expect(portal.closeTop).toHaveBeenCalled();
  });

  it('ignores a late initial completed episodes response after local edits', async () => {
    const completedEpisodesLoad = new Subject<{
      completedEpisodes: { season: number; episode: number }[];
      lastCompletedEpisode: { season: number; episode: number } | null;
    }>();
    api.getTrackingCompletedEpisodesByExternalId.mockReturnValue(completedEpisodesLoad.asObservable());
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [{ season: 1, episode: 1 }], lastCompletedEpisode: { season: 1, episode: 1 } })
    );
    const lateLoadFixture = TestBed.createComponent(CompletedEpisodesDialog);
    const lateLoadComponent = lateLoadFixture.componentInstance;
    lateLoadFixture.componentRef.setInput('imdbId', 'tt-series');
    lateLoadFixture.componentRef.setInput('saved', vi.fn());
    lateLoadFixture.componentRef.setInput('closed', portal.closeTop);
    lateLoadFixture.detectChanges();

    await lateLoadComponent['onToggleEpisode'](1, 1);
    completedEpisodesLoad.next({
      completedEpisodes: [{ season: 1, episode: 2 }],
      lastCompletedEpisode: { season: 1, episode: 2 },
    });

    expect(lateLoadComponent['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('shows no metadata message when seasons are empty', () => {
    api.getTrackingSeasonsByExternalId.mockReturnValue(of({ seasons: [] }));
    component['seasonsMetadata'].set([]);

    expect(component['hasSeasonMetadata']()).toBe(false);
  });

  it('computes openSeasons from seasonsMetadata and completedEpisodes', () => {
    component['seasonsMetadata'].set([
      { season: 1, episodes: 2, titles: [] },
      { season: 2, episodes: 2, titles: [] },
    ]);
    component['completedEpisodes'].set([{ season: 1, episode: 1 }]);

    expect(component['openSeasons']()).toEqual(new Set([1]));
    expect(component['isSeasonOpenDefault'](1)).toBe(true);
    expect(component['isSeasonOpenDefault'](2)).toBe(false);
  });

  it('delegates isSeasonOpenDefault to the openSeasons set', () => {
    component['seasonsMetadata'].set([
      { season: 1, episodes: 2, titles: [] },
      { season: 2, episodes: 2, titles: [] },
    ]);
    component['completedEpisodes'].set([{ season: 1, episode: 1 }]);

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

  it('shows toast when no season metadata exists on mark all completed', async () => {
    component['seasonsMetadata'].set([]);

    await component['onMarkAllEpisodesCompleted']();

    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.SetSeasonMetadataFirst');
  });

  it('marks all episodes completed after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onMarkAllEpisodesCompleted']();

    expect(api.markAllTrackingCompletedByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['completedEpisodes']()).toEqual([
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
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedCompleted');
  });

  it('queues mark all completed behind a pending episode auto-save', async () => {
    const pendingEpisodeSave = new Subject<{
      completedEpisodes: { season: number; episode: number }[];
      lastCompletedEpisode: { season: number; episode: number } | null;
    }>();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(pendingEpisodeSave.asObservable());

    const episodeSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalled());
    const markAllSave = component['onMarkAllEpisodesCompleted']();

    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();

    pendingEpisodeSave.next({
      completedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      lastCompletedEpisode: { season: 1, episode: 2 },
    });
    pendingEpisodeSave.complete();

    await episodeSave;
    await markAllSave;

    expect(api.markAllTrackingCompletedByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['completedEpisodes']()).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedCompleted');
  });

  it('does not mark all episodes completed when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onMarkAllEpisodesCompleted']();

    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
  });

  it('clears completed episodes after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [], lastCompletedEpisode: null, item: { hash: 'uncompleted-hash' } })
    );

    await component['onMarkAllEpisodesUncompleted']();

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      completedEpisodes: [],
    });
    expect(component['completedEpisodes']()).toEqual([]);
    expect(saved).toHaveBeenCalledWith([], { hash: 'uncompleted-hash' });
    expect(toastState.state.message()).toBe('Toast.AllEpisodesMarkedUncompleted');
  });

  it('does not clear completed episodes when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onMarkAllEpisodesUncompleted']();

    expect(api.updateTrackingCompletedEpisodesByExternalId).not.toHaveBeenCalled();
  });
});
