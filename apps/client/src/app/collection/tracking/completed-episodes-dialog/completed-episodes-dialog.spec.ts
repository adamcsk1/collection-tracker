import { Component, viewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageDialog } from '@components/message-dialog/message-dialog';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { MESSAGE_DIALOG_COMPONENT } from '@services/message-dialog-const';
import { MessageDialogService } from '@services/message-dialog-service';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { TrackingCompletedEpisodesApiResponseModel } from '@shared/models/api-model';
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
    close: ReturnType<typeof vi.fn>;
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
    portal = { close: vi.fn(), open: vi.fn(), openStacked: vi.fn() };
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
    fixture.detectChanges();
  });

  it('loads seasons metadata and completed episodes on init', () => {
    expect(fixture.nativeElement.querySelector('[role="dialog"]').getAttribute('aria-labelledby')).toBe(
      'completed-episodes-heading'
    );
    expect(api.getTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series');
    expect(component['seasonsMetadata']()).toEqual([{ season: 1, episodes: 3, titles: [] }]);
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
  });

  it('renders shared season and episode checkboxes and handles mixed-state changes', async () => {
    await fixture.whenStable();

    const seasonToggle = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-season-toggle"] input[type="checkbox"]'
    ) as HTMLInputElement;
    const episodeCheckboxes = [
      ...fixture.nativeElement.querySelectorAll(
        '[data-test-id="completed-episodes-episode-checkbox"] input[type="checkbox"]'
      ),
    ] as HTMLInputElement[];
    const episodeLabels = [
      ...fixture.nativeElement.querySelectorAll('[data-test-id="completed-episodes-episode-checkbox"] label'),
    ].map((label) => label.textContent?.trim());

    expect(seasonToggle.checked).toBe(false);
    expect(seasonToggle.indeterminate).toBe(true);
    expect(seasonToggle.getAttribute('aria-checked')).toBe('mixed');
    expect(episodeCheckboxes.map((checkbox) => checkbox.checked)).toEqual([false, true, false]);
    expect(episodeLabels).toEqual(['Episode 1', 'Episode 2', 'Episode 3']);

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

    seasonToggle.click();
    await vi.waitFor(() =>
      expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
        ],
      })
    );
  });

  it('loads and saves shared owner episode data using owner share code', async () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');
    api.getTrackingSeasonsByExternalId.mockClear();
    api.getTrackingCompletedEpisodesByExternalId.mockClear();
    component['loadData']();

    expect(api.getTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', 'owner-code');
    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', 'owner-code');

    await component['onToggleEpisode'](1, 1);

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
      },
      'owner-code'
    );
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
    expect(portal.close).not.toHaveBeenCalled();

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
    expect(portal.close).not.toHaveBeenCalled();
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

  it('closes its own portal by default when closed', async () => {
    await component['onClose']();

    expect(portal.close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
  });

  it('uses a custom closed callback without closing the portal directly', async () => {
    const closed = vi.fn();
    fixture.componentRef.setInput('closed', closed);

    await component['onClose']();

    expect(closed).toHaveBeenCalledOnce();
    expect(portal.close).not.toHaveBeenCalled();
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

    expect(portal.close).not.toHaveBeenCalled();

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

    expect(portal.close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
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

  it('threads shared owner code to stacked metadata management', () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');

    component['onManageSeasonMetadata']();

    expect(portal.openStacked).toHaveBeenCalledWith(
      SeriesSeasonMetadataDialog,
      expect.objectContaining({ ownerShareCode: 'owner-code' })
    );
  });

  it('marks all shared owner episodes through owner-scoped update', async () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');
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

    await component['onMarkAllEpisodesCompleted']();

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
        ],
      },
      'owner-code'
    );
    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
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

    expect(confirm.open).toHaveBeenCalledWith('Confirm.MarkAllEpisodesUncompleted', {
      destructive: true,
      confirmationText: 'Dialog.Scope.Series',
      actionLabel: 'MarkAllEpisodesUncompleted',
    });
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

@Component({
  selector: 'ct-test-completed-episodes-portal-host',
  template:
    '<main data-dialog-background><button data-test-id="trigger">Open</button></main><ng-container #portalHost />',
})
class CompletedEpisodesPortalHost {
  public readonly portalHost = viewChild.required('portalHost', { read: ViewContainerRef });
}

describe('CompletedEpisodesDialog pending close', () => {
  it('keeps a newer alert open when a rejected auto-save finishes the original close', async () => {
    const pendingSave = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    const update = vi.fn(() => pendingSave.asObservable());
    TestBed.configureTestingModule({
      imports: [CompletedEpisodesPortalHost],
      providers: [
        { provide: MESSAGE_DIALOG_COMPONENT, useValue: MessageDialog },
        {
          provide: ApiService,
          useValue: {
            getTrackingSeasonsByExternalId: vi.fn(() => of({ seasons: [{ season: 1, episodes: 3 }] })),
            getTrackingCompletedEpisodesByExternalId: vi.fn(() => of({ completedEpisodes: [] })),
            updateTrackingCompletedEpisodesByExternalId: update,
          },
        },
        { provide: ConfirmService, useValue: { open: vi.fn(() => of(true)) } },
        { provide: WebstorageService, useValue: { getItem: vi.fn(() => null), setItem: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialToastState, toastStateToken),
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
      ],
    });
    const fixture = TestBed.createComponent(CompletedEpisodesPortalHost);
    fixture.detectChanges();
    const portal = TestBed.inject(PortalService);
    portal.setViewContainerRef(fixture.componentInstance.portalHost());
    const trigger = fixture.nativeElement.querySelector('[data-test-id="trigger"]') as HTMLButtonElement;
    trigger.focus();
    const saved = vi.fn();
    portal.open(CompletedEpisodesDialog, { imdbId: 'tt-series', saved });
    fixture.detectChanges();
    const original = portal.componentRef()!;
    const originalHost = original.location.nativeElement as HTMLElement;
    const component = original.instance as CompletedEpisodesDialog;
    const episodeSave = component['onToggleEpisode'](1, 1);
    const error = new Error('Auto-save failed');
    const rejectedSave = expect(episodeSave).rejects.toBe(error);
    await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
    const close = component['onClose']();
    const alertResult = vi.fn();
    TestBed.inject(MessageDialogService)
      .open({ message: 'Save failed', mode: 'alert', options: {} })
      .subscribe(alertResult);
    fixture.detectChanges();
    const alert = portal.componentRef()!;
    const alertHost = alert.location.nativeElement as HTMLElement;

    expect(originalHost.isConnected).toBe(true);
    pendingSave.error(error);
    await rejectedSave;
    await close;
    fixture.detectChanges();

    expect(originalHost.isConnected).toBe(false);
    expect(saved).not.toHaveBeenCalled();
    expect(portal.componentRef()).toBe(alert);
    expect(alertHost.isConnected).toBe(true);
    expect(alertResult).not.toHaveBeenCalled();
    expect(alertHost.hasAttribute('inert')).toBe(false);
    const confirm = alertHost.querySelector('[data-test-id="message-dialog-confirm"]') as HTMLButtonElement;
    confirm.click();

    await vi.waitFor(() => expect(alertResult).toHaveBeenCalledExactlyOnceWith(true));
    expect(portal.componentRef()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
