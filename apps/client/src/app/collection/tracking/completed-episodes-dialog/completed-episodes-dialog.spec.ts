import { Component, viewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
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
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesSeasonMetadataDialog } from '../series-season-metadata-dialog/series-season-metadata-dialog';
import { CompletedEpisodesDialog } from './completed-episodes-dialog';

describe('CompletedEpisodesDialog', () => {
  let fixture: ComponentFixture<CompletedEpisodesDialog>;
  let component: CompletedEpisodesDialog;
  let api: {
    getExternalMetadataProviders: ReturnType<typeof vi.fn>;
    refreshTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
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
      getExternalMetadataProviders: vi.fn(() =>
        of({ providers: [{ name: 'omdb', supportsSeasonMetadata: true, supportsDirectImdbId: true }] })
      ),
      refreshTrackingSeasonsByExternalId: vi.fn(() => of({ seasons: [{ season: 1, episodes: 3 }] })),
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
    const action = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-mark-all-completed"]'
    ) as HTMLButtonElement;
    expect(action.classList.contains('dialog-action')).toBe(true);
    expect(action.querySelector('span')?.textContent?.trim()).toBe('MarkAllEpisodesCompleted');
    expect(action.classList.contains('button-reveal-label')).toBe(false);
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
        undefined,
        { suppressErrorAlert: true }
      )
    );
  });

  it('separates episode titles with a colon and leaves untitled episode labels unpunctuated', async () => {
    component['seasonsMetadata'].set([{ season: 1, episodes: 2, titles: ['Pilot'] }]);
    await fixture.whenStable();

    const episodeCheckboxes = [
      ...fixture.nativeElement.querySelectorAll(
        '[data-test-id="completed-episodes-episode-checkbox"] input[type="checkbox"]'
      ),
    ] as HTMLInputElement[];
    const episodeLabels = [
      ...fixture.nativeElement.querySelectorAll('[data-test-id="completed-episodes-episode-checkbox"] label'),
    ].map((label) => label.textContent?.trim());
    const accessibleLabels = episodeCheckboxes.map((checkbox) => checkbox.getAttribute('aria-label'));

    expect(accessibleLabels).toEqual(['Episode 1: Pilot', 'Episode 2']);
    expect(episodeLabels).toEqual(['Episode 1: Pilot', 'Episode 2']);
    expect([...accessibleLabels, ...episodeLabels].every((label) => !label?.includes('\u2014'))).toBe(true);
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
      'owner-code',
      { suppressErrorAlert: true }
    );
  });

  it('renders translated bulk actions inside More with reset available for partial progress', () => {
    const markCompletedButton = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-mark-all-completed"]'
    ) as HTMLButtonElement;

    expect(markCompletedButton.type).toBe('button');
    expect(markCompletedButton.querySelector('span')?.textContent?.trim()).toBe('MarkAllEpisodesCompleted');
    expect(markCompletedButton.closest('dialog')?.getAttribute('data-test-id')).toBe('completed-episodes-more-actions');
    expect(component['menuActions']().map((action) => action.id)).toEqual([
      'completed-episodes-mark-all-completed',
      'completed-episodes-manage-season-metadata',
      'completed-episodes-mark-all-uncompleted',
    ]);

    component['completedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]);
    fixture.detectChanges();

    const markUncompletedButton = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-mark-all-uncompleted"]'
    ) as HTMLButtonElement;
    expect(markUncompletedButton.classList.contains('dialog-action')).toBe(true);
    expect(markUncompletedButton.querySelector('span')?.textContent?.trim()).toBe('MarkAllEpisodesUncompleted');
    expect(markUncompletedButton.classList.contains('button-danger')).toBe(true);
    expect(component['menuActions']().some((action) => action.id === 'completed-episodes-mark-all-completed')).toBe(
      false
    );
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
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
      },
      undefined,
      { suppressErrorAlert: true }
    );
    expect(saved).toHaveBeenCalledWith(
      [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      undefined
    );
    expect(component['saveStatus']()).toBe('saved');
    expect(toastState.state.message()).toBe('');
    expect(portal.close).not.toHaveBeenCalled();

    api.updateTrackingCompletedEpisodesByExternalId.mockClear();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [{ season: 1, episode: 1 }], lastCompletedEpisode: { season: 1, episode: 1 } })
    );

    await component['onToggleEpisode'](1, 2);

    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [{ season: 1, episode: 1 }],
      },
      undefined,
      { suppressErrorAlert: true }
    );
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
      undefined,
      { suppressErrorAlert: true }
    );

    api.updateTrackingCompletedEpisodesByExternalId.mockClear();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [], lastCompletedEpisode: null })
    );

    await component['onToggleSeason'](1, 3);

    expect(component['completedEpisodes']()).toEqual([]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [],
      },
      undefined,
      { suppressErrorAlert: true }
    );
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

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
        ],
      },
      undefined,
      { suppressErrorAlert: true }
    );
    expect(saved).toHaveBeenCalledWith(
      [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
      undefined
    );
    expect(component['saveStatus']()).toBe('saved');
    expect(toastState.state.message()).toBe('');
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('does not apply stale auto-save responses over newer local edits', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
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
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(1);

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

    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenNthCalledWith(
      2,
      'omdb',
      'tt-series',
      {
        completedEpisodes: [{ season: 1, episode: 1 }],
      },
      undefined,
      { suppressErrorAlert: true }
    );
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(saved).toHaveBeenCalledExactlyOnceWith([{ season: 1, episode: 1 }], undefined);
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
    completedEpisodesLoad.complete();

    expect(lateLoadComponent['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
  });

  it('retains the optimistic draft after a failed auto-save without rejecting the event handler', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(throwError(() => new Error('Save failed')));

    await expect(component['onToggleEpisode'](1, 1)).resolves.toBeUndefined();

    expect(component['completedEpisodes']()).toEqual([
      { season: 1, episode: 2 },
      { season: 1, episode: 1 },
    ]);
    expect(saved).not.toHaveBeenCalled();
    expect(toastState.state.message()).not.toBe('Toast.CompletedEpisodesSaved');
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('asks before discarding a failed draft and preserves it when closing is cancelled', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(throwError(() => new Error('Save failed')));
    await component['onToggleEpisode'](1, 1);
    confirm.open.mockReturnValueOnce(of(false)).mockReturnValueOnce(of(true));
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;
    const beforeClose = shell.beforeClose();
    expect(beforeClose).not.toBeNull();

    expect(await beforeClose!()).toBe(false);
    expect(confirm.open).toHaveBeenCalledWith('EpisodeTracking.CloseUnsaved');
    expect(component['completedSet']().has('1-1')).toBe(true);
    expect(portal.close).not.toHaveBeenCalled();
    expect(await beforeClose!()).toBe(true);
  });

  it('waits for saves queued while close is pending before allowing the shell to close', async () => {
    const firstResponse = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    const secondResponse = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    api.updateTrackingCompletedEpisodesByExternalId
      .mockReturnValueOnce(firstResponse.asObservable())
      .mockReturnValueOnce(secondResponse.asObservable());
    const firstSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledOnce());
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;
    const allowed = vi.fn();
    const closing = shell.beforeClose()!().then(allowed);
    const secondSave = component['onToggleEpisode'](1, 2);
    firstResponse.next({
      completedEpisodes: [{ season: 1, episode: 1 }],
      lastCompletedEpisode: { season: 1, episode: 1 },
    });
    firstResponse.complete();
    await firstSave;
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(2));
    expect(allowed).not.toHaveBeenCalled();
    secondResponse.next({
      completedEpisodes: [{ season: 1, episode: 1 }],
      lastCompletedEpisode: { season: 1, episode: 1 },
    });
    secondResponse.complete();
    await secondSave;
    await closing;
    expect(allowed).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('waits for saves added during metadata navigation before opening the editor', async () => {
    const firstResponse = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    const secondResponse = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    api.updateTrackingCompletedEpisodesByExternalId
      .mockReturnValueOnce(firstResponse.asObservable())
      .mockReturnValueOnce(secondResponse.asObservable());
    const firstSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledOnce());
    const navigation = component['onManageSeasonMetadata']();
    const secondSave = component['onToggleEpisode'](1, 3);
    firstResponse.next({
      completedEpisodes: [{ season: 1, episode: 1 }],
      lastCompletedEpisode: { season: 1, episode: 1 },
    });
    firstResponse.complete();
    await firstSave;
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(2));
    expect(portal.openStacked).not.toHaveBeenCalled();
    secondResponse.next({
      completedEpisodes: [{ season: 1, episode: 3 }],
      lastCompletedEpisode: { season: 1, episode: 3 },
    });
    secondResponse.complete();
    await secondSave;
    await navigation;
    expect(portal.openStacked).toHaveBeenCalledOnce();
  });

  it('shows no metadata message when seasons are empty', () => {
    api.getTrackingSeasonsByExternalId.mockReturnValue(of({ seasons: [] }));
    component['seasonsMetadata'].set([]);

    expect(component['hasSeasonMetadata']()).toBe(false);
  });

  it('renders progress and keeps the season expanded when its last episode is checked', async () => {
    expect(component['completedCount']()).toBe(1);
    expect(component['totalCount']()).toBe(3);
    expect(component['seasonProgress']()[0].completed).toBe(1);
    api.updateTrackingCompletedEpisodesByExternalId.mockImplementation(
      (_provider: string, _itemId: string, draft: { completedEpisodes: { season: number; episode: number }[] }) =>
        of({ completedEpisodes: draft.completedEpisodes })
    );
    await component['onToggleEpisode'](1, 1);
    await component['onToggleEpisode'](1, 3);
    expect(component['completedCount']()).toBe(3);
    expect(component['openSeasons']()).toEqual(new Set([1]));
    expect(component['saveStatus']()).toBe('saved');
    expect(toastState.state.message()).toBe('');
  });

  it('retries the latest failed optimistic snapshot without losing newer edits', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(throwError(() => new Error('Save failed')));
    await component['onToggleEpisode'](1, 1);
    await component['onToggleEpisode'](1, 2);
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    expect(component['saveStatus']()).toBe('error');
    expect(saved).not.toHaveBeenCalled();
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [{ season: 1, episode: 1 }] })
    );
    await component['onRetrySave']();
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenLastCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [{ season: 1, episode: 1 }],
      },
      undefined,
      { suppressErrorAlert: true }
    );
    expect(component['saveStatus']()).toBe('saved');
    expect(saved).toHaveBeenCalledExactlyOnceWith([{ season: 1, episode: 1 }], undefined);
  });

  it('continues the serialized queue after an earlier save fails without applying stale failure state', async () => {
    const firstResponse = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    const secondResponse = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    api.updateTrackingCompletedEpisodesByExternalId
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);
    const firstSave = component['onToggleEpisode'](1, 1);
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledOnce());
    const secondSave = component['onToggleEpisode'](1, 2);
    firstResponse.error(new Error('First save failed'));
    await firstSave;
    await vi.waitFor(() => expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(2));
    expect(component['saveStatus']()).toBe('saving');
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 1 }]);
    secondResponse.next({
      completedEpisodes: [{ season: 1, episode: 1 }],
      lastCompletedEpisode: { season: 1, episode: 1 },
    });
    secondResponse.complete();
    await secondSave;
    expect(component['saveStatus']()).toBe('saved');
  });

  it('shows loading until both initial requests finish and supports retry after a load failure', async () => {
    const completed = new Subject<TrackingCompletedEpisodesApiResponseModel>();
    api.getTrackingCompletedEpisodesByExternalId.mockReturnValueOnce(completed);
    component['loadData']();
    expect(component['loading']()).toBe(true);
    completed.error(new Error('Load failed'));
    expect(component['loading']()).toBe(false);
    expect(component['loadError']()).toBe(true);
    component['loadData']();
    expect(component['loadError']()).toBe(false);
    expect(component['loading']()).toBe(false);
    expect(component['completedCount']()).toBe(1);
  });

  it('offers fetching only when the matching provider supports season metadata', async () => {
    component['seasonsMetadata'].set([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-test-id="completed-episodes-fetch-metadata"]')).not.toBeNull();
    api.getExternalMetadataProviders.mockReturnValue(
      of({ providers: [{ name: 'other', supportsSeasonMetadata: true }] })
    );
    component.ngOnInit();
    await fixture.whenStable();
    expect(component['supportsFetch']()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-test-id="completed-episodes-fetch-metadata"]')).toBeNull();
    await component['onFetchMetadata']();
    expect(api.refreshTrackingSeasonsByExternalId).not.toHaveBeenCalled();
  });

  it('keeps episode data usable when provider capabilities are unavailable', () => {
    api.getExternalMetadataProviders.mockReturnValue(throwError(() => new Error('Capabilities unavailable')));
    component.ngOnInit();
    expect(component['supportsFetch']()).toBe(false);
    expect(component['loadError']()).toBe(false);
    expect(component['completedCount']()).toBe(1);
  });

  it('hides fetching when the matching provider does not support season metadata', () => {
    api.getExternalMetadataProviders.mockReturnValue(
      of({ providers: [{ name: 'omdb', supportsSeasonMetadata: false, supportsDirectImdbId: true }] })
    );
    component.ngOnInit();
    expect(component['supportsFetch']()).toBe(false);
  });

  it('shows a recoverable load error and retries both requests', async () => {
    api.getTrackingSeasonsByExternalId.mockReturnValueOnce(throwError(() => new Error('Load failed')));
    component['loadData']();
    await fixture.whenStable();
    expect(component['loading']()).toBe(false);
    expect(component['loadError']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-test-id="completed-episodes-load-error"]')).not.toBeNull();
    const retry = fixture.nativeElement.querySelector(
      '[data-test-id="completed-episodes-retry-load"]'
    ) as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    expect(component['loadError']()).toBe(false);
    expect(component['completedCount']()).toBe(1);
  });

  it('shows fetch errors without leaving the dialog loading', async () => {
    api.refreshTrackingSeasonsByExternalId.mockReturnValue(throwError(() => new Error('Fetch failed')));
    await component['onFetchMetadata']();
    expect(component['loading']()).toBe(false);
    expect(component['loadError']()).toBe(true);
  });

  it('retains optimistic bulk completion after failure and retries that full snapshot', async () => {
    api.markAllTrackingCompletedByExternalId.mockReturnValue(throwError(() => new Error('Bulk save failed')));
    await component['onMarkAllEpisodesCompleted']();
    expect(component['saveStatus']()).toBe('error');
    expect(component['completedCount']()).toBe(3);
    expect(toastState.state.message()).toBe('');
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({
        completedEpisodes: [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 1, episode: 3 },
        ],
      })
    );
    await component['onRetrySave']();
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
      undefined,
      { suppressErrorAlert: true }
    );
    expect(component['saveStatus']()).toBe('saved');
  });

  it('retains an optimistic reset after failure and retries the empty snapshot', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValueOnce(throwError(() => new Error('Reset failed')));
    await component['onMarkAllEpisodesUncompleted']();
    expect(component['saveStatus']()).toBe('error');
    expect(component['completedCount']()).toBe(0);
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValueOnce(of({ completedEpisodes: [] }));
    await component['onRetrySave']();
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenLastCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [],
      },
      undefined,
      { suppressErrorAlert: true }
    );
    expect(component['saveStatus']()).toBe('saved');
  });

  it('fetches supported metadata then reloads metadata and progress', async () => {
    api.getTrackingSeasonsByExternalId.mockReturnValue(of({ seasons: [{ season: 1, episodes: 4 }] }));
    await component['onFetchMetadata']();
    expect(api.refreshTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', undefined);
    expect(component['totalCount']()).toBe(4);
    expect(component['loading']()).toBe(false);
    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(2);
  });

  it('does not expose or execute mutations without update permission', async () => {
    fixture.componentRef.setInput('canUpdate', false);
    await fixture.whenStable();
    await component['onToggleEpisode'](1, 1);
    await component['onToggleSeason'](1, 3);
    await component['onManageSeasonMetadata']();
    await component['onFetchMetadata']();
    await component['onMarkAllEpisodesCompleted']();
    await component['onMarkAllEpisodesUncompleted']();
    expect(component['menuActions']()).toEqual([]);
    expect(api.updateTrackingCompletedEpisodesByExternalId).not.toHaveBeenCalled();
    expect(api.markAllTrackingCompletedByExternalId).not.toHaveBeenCalled();
    expect(api.refreshTrackingSeasonsByExternalId).not.toHaveBeenCalled();
    expect(portal.openStacked).not.toHaveBeenCalled();
    expect(confirm.open).not.toHaveBeenCalled();
  });

  it('initializes open seasons from loaded metadata and preserves expansion after progress changes', () => {
    api.getTrackingSeasonsByExternalId.mockReturnValue(
      of({
        seasons: [
          { season: 1, episodes: 2, titles: [] },
          { season: 2, episodes: 2, titles: [] },
        ],
      })
    );
    api.getTrackingCompletedEpisodesByExternalId.mockReturnValue(
      of({ completedEpisodes: [{ season: 1, episode: 1 }] })
    );
    component['loadData']();

    expect(component['openSeasons']()).toEqual(new Set([1]));
    expect(component['isSeasonOpenDefault'](1)).toBe(true);
    expect(component['isSeasonOpenDefault'](2)).toBe(false);
    component['completedEpisodes'].set([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    expect(component['openSeasons']()).toEqual(new Set([1]));
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

  it('opens stacked metadata management and reloads server-pruned progress after saving', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onManageSeasonMetadata']();

    expect(portal.openStacked).toHaveBeenCalledWith(SeriesSeasonMetadataDialog, {
      imdbId: 'tt-series',
      externalProvider: 'omdb',
      externalItemId: 'tt-series',
      itemTitle: '',
      canUpdate: true,
      initialSeasons: [{ season: 1, episodes: 3, titles: [] }],
      saved: expect.any(Function),
    });

    const metadataInputs = portal.openStacked.mock.calls[0][1] as {
      saved: (seasons: [{ season: number; episodes: number; titles: string[] }], item?: { hash: string }) => void;
    };
    api.getTrackingSeasonsByExternalId.mockReturnValue(of({ seasons: [{ season: 2, episodes: 4, titles: [] }] }));
    api.getTrackingCompletedEpisodesByExternalId.mockReturnValue(of({ completedEpisodes: [] }));
    metadataInputs.saved([{ season: 2, episodes: 4, titles: [] }], { hash: 'metadata-hash' });

    expect(component['seasonsMetadata']()).toEqual([{ season: 2, episodes: 4, titles: [] }]);
    expect(saved).toHaveBeenCalledWith([], { hash: 'metadata-hash' });
  });

  it('keeps failed optimistic progress when metadata discard is cancelled', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(throwError(() => new Error('Save failed')));
    await component['onToggleEpisode'](1, 1);
    api.getTrackingSeasonsByExternalId.mockClear();
    api.getTrackingCompletedEpisodesByExternalId.mockClear();
    confirm.open.mockReturnValue(of(false));

    await component['onManageSeasonMetadata']();

    expect(confirm.open).toHaveBeenCalledExactlyOnceWith('EpisodeTracking.DiscardForMetadata');
    expect(portal.openStacked).not.toHaveBeenCalled();
    expect(component['completedSet']().has('1-1')).toBe(true);
    expect(component['completedSet']().has('1-2')).toBe(true);
    expect(component['saveStatus']()).toBe('error');
    expect(api.getTrackingSeasonsByExternalId).not.toHaveBeenCalled();
    expect(api.getTrackingCompletedEpisodesByExternalId).not.toHaveBeenCalled();
  });

  it('opens metadata only after explicit discard and reloads progress before a metadata save callback', async () => {
    api.updateTrackingCompletedEpisodesByExternalId.mockReturnValue(throwError(() => new Error('Save failed')));
    await component['onToggleEpisode'](1, 1);
    const discard = new Subject<boolean>();
    confirm.open.mockReturnValue(discard);
    const managing = component['onManageSeasonMetadata']();
    await vi.waitFor(() => expect(confirm.open).toHaveBeenCalledWith('EpisodeTracking.DiscardForMetadata'));
    expect(portal.openStacked).not.toHaveBeenCalled();
    expect(component['saveStatus']()).toBe('error');
    expect(component['completedSet']().has('1-1')).toBe(true);

    discard.next(true);
    discard.complete();
    await managing;

    expect(component['saveStatus']()).toBe('idle');
    expect(component['completedEpisodes']()).toEqual([{ season: 1, episode: 2 }]);
    expect(api.getTrackingCompletedEpisodesByExternalId).toHaveBeenCalledTimes(2);
    expect(portal.openStacked).toHaveBeenCalledOnce();
    const metadataInputs = portal.openStacked.mock.calls[0][1] as {
      saved: (seasons: { season: number; episodes: number }[]) => void;
    };
    api.getTrackingSeasonsByExternalId.mockReturnValue(of({ seasons: [{ season: 1, episodes: 1 }] }));
    api.getTrackingCompletedEpisodesByExternalId.mockReturnValue(of({ completedEpisodes: [] }));
    metadataInputs.saved([{ season: 1, episodes: 1 }]);
    expect(component['completedEpisodes']()).toEqual([]);
    expect(component['totalCount']()).toBe(1);
    expect(confirm.open).toHaveBeenCalledOnce();
  });

  it.each(['response', 'error'] as const)(
    'ignores a stale reload %s after a newer metadata reload succeeds',
    (outcome) => {
      const olderSeasons = new Subject<{ seasons: { season: number; episodes: number }[] }>();
      const olderCompleted = new Subject<TrackingCompletedEpisodesApiResponseModel>();
      api.getTrackingSeasonsByExternalId.mockReturnValueOnce(olderSeasons);
      api.getTrackingCompletedEpisodesByExternalId.mockReturnValueOnce(olderCompleted);
      component['loadData']();
      expect(component['loading']()).toBe(true);
      api.getTrackingSeasonsByExternalId.mockReturnValueOnce(of({ seasons: [{ season: 2, episodes: 1 }] }));
      api.getTrackingCompletedEpisodesByExternalId.mockReturnValueOnce(
        of({ completedEpisodes: [{ season: 2, episode: 1 }] })
      );
      component['loadData']();

      if (outcome === 'error') olderSeasons.error(new Error('Stale load failed'));
      else {
        olderSeasons.next({ seasons: [{ season: 1, episodes: 3 }] });
        olderSeasons.complete();
        olderCompleted.next({
          completedEpisodes: [{ season: 1, episode: 2 }],
          lastCompletedEpisode: { season: 1, episode: 2 },
        });
        olderCompleted.complete();
      }

      expect(component['seasonsMetadata']()).toEqual([{ season: 2, episodes: 1 }]);
      expect(component['completedEpisodes']()).toEqual([{ season: 2, episode: 1 }]);
      expect(component['loading']()).toBe(false);
      expect(component['loadError']()).toBe(false);
      expect(component['saveStatus']()).toBe('idle');
    }
  );

  it('threads shared owner code to stacked metadata management', async () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');

    await component['onManageSeasonMetadata']();

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
      'owner-code',
      { suppressErrorAlert: true }
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

    expect(api.markAllTrackingCompletedByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      suppressErrorAlert: true,
    });
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

    expect(api.markAllTrackingCompletedByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      suppressErrorAlert: true,
    });
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
    expect(api.updateTrackingCompletedEpisodesByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      {
        completedEpisodes: [],
      },
      undefined,
      { suppressErrorAlert: true }
    );
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
            getExternalMetadataProviders: vi.fn(() => of({ providers: [] })),
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
    const handledSave = expect(episodeSave).resolves.toBeUndefined();
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
    await handledSave;
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
