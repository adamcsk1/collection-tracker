import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { MAX_SERIES_EPISODES, MAX_SERIES_SEASONS } from '@shared/constants/tracking-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesSeasonMetadataDialog } from './series-season-metadata-dialog';

describe('SeriesSeasonMetadataDialog', () => {
  let fixture: ComponentFixture<SeriesSeasonMetadataDialog>;
  let component: SeriesSeasonMetadataDialog;
  let api: {
    getExternalMetadataProviders: ReturnType<typeof vi.fn>;
    updateTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    refreshTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    deleteTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
  };
  let portal: { close: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<ToastState>;

  beforeEach(() => {
    api = {
      getExternalMetadataProviders: vi.fn(() =>
        of({ providers: [{ name: 'omdb', supportsSeasonMetadata: true, supportsDirectImdbId: true }] })
      ),
      updateTrackingSeasonsByExternalId: vi.fn(() => of({ seasons: [{ season: 1, episodes: 2 }] })),
      refreshTrackingSeasonsByExternalId: vi.fn(() =>
        of({ seasons: [{ season: 1, episodes: 3, titles: ['Pilot'] }], item: { hash: 'refreshed-hash' } })
      ),
      deleteTrackingSeasonsByExternalId: vi.fn(() => of({ seasons: [], item: { hash: 'metadata-deleted-hash' } })),
    };
    portal = { close: vi.fn() };
    confirm = { open: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [SeriesSeasonMetadataDialog],
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
    fixture = TestBed.createComponent(SeriesSeasonMetadataDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    fixture.componentRef.setInput('imdbId', 'tt-series');
    fixture.componentRef.setInput('initialSeasons', [{ season: 1, episodes: 2, titles: [] }]);
    fixture.detectChanges();
  });

  it('initializes rows from input metadata', () => {
    expect(fixture.nativeElement.querySelector('[role="dialog"]').getAttribute('aria-labelledby')).toBe(
      'series-metadata-heading'
    );
    expect(component['seasons']()).toEqual([{ season: 1, episodes: 2 }]);
    expect(TestBed.inject(NgxSignalTranslateService).translate).toHaveBeenCalledWith('Metadata.SeasonSummary', {
      season: '1',
      episodes: '2',
    });
  });

  it('renders labelled action controls and disables save for invalid metadata', () => {
    const saveButton = fixture.nativeElement.querySelector(
      '[data-test-id="series-metadata-save"]'
    ) as HTMLButtonElement;

    expect(saveButton.type).toBe('button');
    expect(saveButton.disabled).toBe(false);
    expect(saveButton.getAttribute('aria-label')).toBe('Save');
    expect(saveButton.title).toBe('Save');
    expect(saveButton.textContent).toContain('Save');
    expect(component['actions']()).toEqual([
      { id: 'series-metadata-refresh', label: 'RefreshSeriesMetadata', icon: 'sync', destructive: true },
      { id: 'series-metadata-remove-all', label: 'RemoveSeriesMetadata', icon: 'playlist_remove', destructive: true },
    ]);

    component['form'].seasons[0].episodes().value.set(0);
    fixture.detectChanges();

    expect(saveButton.disabled).toBe(true);
  });

  it('requires positive episode counts', () => {
    component['form'].seasons[0].episodes().value.set(0);

    expect(component['valid']()).toBe(false);
  });

  it('rejects episode counts above the supported range', () => {
    component['form'].seasons[0].episodes().value.set(101);

    expect(component['valid']()).toBe(false);
  });

  it('provides named fields with linked range instructions and native numeric limits', async () => {
    component['expandedSeason'].set(0);
    await fixture.whenStable();
    const translate = TestBed.inject(NgxSignalTranslateService).translate;
    for (const [field, label, maximum, hintKey] of [
      ['season', 'Season', MAX_SERIES_SEASONS, 'Message.SeriesMetadataSeasonRange'],
      ['episodes', 'Episodes', MAX_SERIES_EPISODES, 'Message.SeriesMetadataEpisodeRange'],
    ] as const) {
      const input = fixture.nativeElement.querySelector(
        `[data-test-id="series-metadata-${field}"] input`
      ) as HTMLInputElement;
      expect(input.getAttribute('aria-label')).toBe(label);
      expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`).textContent).toContain(label);
      expect(input.min).toBe('1');
      expect(input.max).toBe(`${maximum}`);
      expect(input.step).toBe('1');
      const hintId = input.getAttribute('aria-describedby');
      expect(fixture.nativeElement.querySelector(`[id="${hintId}"]`).textContent).toContain(hintKey);
      expect(translate).toHaveBeenCalledWith(hintKey, { max: `${maximum}` });
      expect(input.getAttribute('aria-invalid')).toBeNull();
    }
  });

  it.each([
    ['season', 0],
    ['season', MAX_SERIES_SEASONS + 1],
    ['season', 1.5],
    ['season', null],
    ['episodes', 0],
    ['episodes', MAX_SERIES_EPISODES + 1],
    ['episodes', 1.5],
    ['episodes', null],
  ] as const)('links and announces actionable errors for %s value %s', async (field, value) => {
    component['expandedSeason'].set(0);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      `[data-test-id="series-metadata-${field}"] input`
    ) as HTMLInputElement;
    input.value = value === null ? '' : `${value}`;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(component['valid']()).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = fixture.nativeElement.querySelector(`[id="${input.id}-error"]`) as HTMLElement;
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(error.getAttribute('role')).toBe('alert');
    const errorKey = field === 'season' ? 'Validation.SeriesMetadataSeason' : 'Validation.SeriesMetadataEpisodes';
    expect(error.textContent).toContain(errorKey);
    expect(TestBed.inject(NgxSignalTranslateService).translate).toHaveBeenCalledWith(errorKey, {
      max: `${field === 'season' ? MAX_SERIES_SEASONS : MAX_SERIES_EPISODES}`,
    });
    const summary = fixture.nativeElement.querySelector('[data-test-id="series-metadata-validation"]');
    expect(summary.parentElement.getAttribute('aria-live')).toBe('polite');
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-save"]').disabled).toBe(true);
    await component['onSave']();
    expect(api.updateTrackingSeasonsByExternalId).not.toHaveBeenCalled();
  });

  it('links duplicate season errors to each affected season field', async () => {
    component['form']().reset({
      seasons: [
        { season: 1, episodes: 2 },
        { season: 1, episodes: 3 },
      ],
    });
    component['form'].seasons[0].season().markAsTouched();
    component['form'].seasons[1].season().markAsTouched();
    await fixture.whenStable();

    expect(component['valid']()).toBe(false);
    for (const index of [0, 1]) {
      component['expandedSeason'].set(index);
      await fixture.whenStable();
      const input = fixture.nativeElement.querySelector('[data-test-id="series-metadata-season"] input');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(fixture.nativeElement.querySelector(`[id="${input.id}-error"]`).textContent).toContain(
        'Validation.SeriesMetadataSeason'
      );
    }
  });

  it('clears errors and enables save when values return to supported boundaries', async () => {
    component['expandedSeason'].set(0);
    component['form'].seasons[0].season().value.set(MAX_SERIES_SEASONS + 1);
    component['form'].seasons[0].season().markAsTouched();
    component['form'].seasons[0].episodes().value.set(MAX_SERIES_EPISODES + 1);
    component['form'].seasons[0].episodes().markAsTouched();
    await fixture.whenStable();

    component['form'].seasons[0].season().value.set(MAX_SERIES_SEASONS);
    component['form'].seasons[0].episodes().value.set(MAX_SERIES_EPISODES);
    await fixture.whenStable();

    expect(component['valid']()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-validation"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-save"]').disabled).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('input[aria-invalid="true"]').length).toBe(0);
  });

  it('saves sorted metadata with titles and closes', async () => {
    api.updateTrackingSeasonsByExternalId.mockReturnValue(
      of({ seasons: [{ season: 1, episodes: 2, titles: ['Pilot'] }] })
    );
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    component['form']().reset({
      seasons: [
        { season: 2, episodes: 4, titles: [] },
        { season: 1, episodes: 3, titles: ['Pilot'] },
      ],
    });

    await component['onSave']();

    expect(api.updateTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', {
      seasons: [
        { season: 1, episodes: 3, titles: ['Pilot'] },
        { season: 2, episodes: 4, titles: [] },
      ],
    });
    expect(saved).toHaveBeenCalledWith([{ season: 1, episodes: 2, titles: ['Pilot'] }], undefined);
    expect(toastState.state.message()).toBe('Toast.SeriesMetadataSaved');
    expect(portal.close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
  });

  it('saves shared owner metadata using owner share code', async () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');
    fixture.detectChanges();

    await component['onSave']();

    expect(api.updateTrackingSeasonsByExternalId).toHaveBeenCalledWith(
      'omdb',
      'tt-series',
      { seasons: [{ season: 1, episodes: 2, titles: [] }] },
      'owner-code'
    );
    expect(component['actions']().map((action) => action.id)).toEqual([
      'series-metadata-refresh',
      'series-metadata-remove-all',
    ]);
  });

  it('hides refresh and remove actions without update permission', () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');
    fixture.componentRef.setInput('canUpdate', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-refresh"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-remove-all"]')).toBeNull();
  });

  it('calls the default portal close when the shell finishes closing', () => {
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;
    shell.closed.emit();

    expect(portal.close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
  });

  it('reads and writes episode titles', () => {
    component['setEpisodeTitle'](0, 0, 'Pilot');
    component['setEpisodeTitle'](0, 1, 'Episode 2');

    expect(component['getEpisodeTitle'](0, 0)).toBe('Pilot');
    expect(component['getEpisodeTitle'](0, 1)).toBe('Episode 2');
    expect(component['getEpisodeTitle'](0, 2)).toBe('');
  });

  it('calls custom closed callback without closing portal when the shell finishes closing', () => {
    const customClosed = vi.fn();
    fixture.componentRef.setInput('closed', customClosed);
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;
    shell.closed.emit();

    expect(customClosed).toHaveBeenCalled();
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('refreshes series metadata after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onRefreshSeriesMetadata']();

    expect(confirm.open).toHaveBeenCalledWith('Confirm.RefreshSeriesMetadata', {
      destructive: true,
      confirmationText: 'Dialog.Scope.SeriesMetadata',
      actionLabel: 'RefreshSeriesMetadata',
    });
    expect(api.refreshTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', undefined);
    expect(component['seasons']()).toEqual([{ season: 1, episodes: 3 }]);
    expect(component['getEpisodeTitle'](0, 0)).toBe('Pilot');
    expect(saved).toHaveBeenCalledWith([{ season: 1, episodes: 3, titles: ['Pilot'] }], { hash: 'refreshed-hash' });
    expect(toastState.state.message()).toBe('Toast.SeriesMetadataRefreshed');
  });

  it('refreshes shared owner series metadata', async () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');

    await component['onRefreshSeriesMetadata']();

    expect(api.refreshTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', 'owner-code');
  });

  it('does not refresh series metadata when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onRefreshSeriesMetadata']();

    expect(api.refreshTrackingSeasonsByExternalId).not.toHaveBeenCalled();
  });

  it('removes series metadata after confirmation', async () => {
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);

    await component['onRemoveSeriesMetadata']();

    expect(confirm.open).toHaveBeenCalledWith('Confirm.RemoveSeriesMetadata', {
      destructive: true,
      confirmationText: 'Dialog.Scope.SeriesMetadata',
      actionLabel: 'RemoveSeriesMetadata',
    });
    expect(api.deleteTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', undefined);
    expect(component['formModel']().seasons).toEqual([]);
    expect(saved).toHaveBeenCalledWith([], { hash: 'metadata-deleted-hash' });
    expect(toastState.state.message()).toBe('Toast.SeriesMetadataDeleted');
  });

  it('removes shared owner series metadata', async () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');

    await component['onRemoveSeriesMetadata']();

    expect(api.deleteTrackingSeasonsByExternalId).toHaveBeenCalledWith('omdb', 'tt-series', 'owner-code');
  });

  it('does not remove series metadata when confirmation is declined', async () => {
    confirm.open.mockReturnValue(of(false));

    await component['onRemoveSeriesMetadata']();

    expect(api.deleteTrackingSeasonsByExternalId).not.toHaveBeenCalled();
  });

  it('shows item context with visible close, cancel, and save controls', async () => {
    fixture.componentRef.setInput('itemTitle', 'Example series');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-item-title"]').textContent).toBe(
      'Example series'
    );
    expect(
      fixture.nativeElement.querySelector('[data-test-id="series-metadata-close"]').getAttribute('aria-label')
    ).toBe('Close');
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-cancel"]').textContent.trim()).toBe(
      'Dialog.Cancel'
    );
  });

  it('starts with compact summaries and opens only one inline season at a time', async () => {
    expect(
      fixture.nativeElement.querySelector('[data-test-id="series-metadata-season"]').closest('[hidden]')
    ).not.toBeNull();
    component['onAddSeason']();
    await fixture.whenStable();

    const toggles = fixture.nativeElement.querySelectorAll('[data-test-id="series-metadata-season-toggle"]');
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.card-body:not([hidden])').length).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-test-id="series-metadata-episode-titles-toggle"] details').open
    ).toBe(false);
    toggles[0].click();
    await fixture.whenStable();

    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('false');
    toggles[0].click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.card-body:not([hidden])').length).toBe(0);
  });

  it('preserves an input and its latest edit when switching to another season immediately', async () => {
    component['onAddSeason']();
    component['expandedSeason'].set(0);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      '#series-metadata-season-panel-0 [data-test-id="series-metadata-episodes"] input'
    ) as HTMLInputElement;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(component['valid']()).toBe(false);

    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.nativeElement.querySelectorAll('[data-test-id="series-metadata-season-toggle"]')[1].click();
    await fixture.whenStable();

    expect(component['formModel']().seasons[0].episodes).toBe(3);
    expect(component['valid']()).toBe(true);
    expect(fixture.nativeElement.querySelector('#series-metadata-season-panel-0 input')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '#series-metadata-season-panel-0 [data-test-id="series-metadata-episodes"] input'
      )
    ).toBe(input);
    expect(input.closest('[hidden]')).not.toBeNull();
  });

  it('keeps existing row open when an earlier row is removed', () => {
    component['onAddSeason']();
    component['onRemoveSeason'](0);
    expect(component['expandedSeason']()).toBe(0);
    component['onRemoveSeason'](0);
    expect(component['expandedSeason']()).toBeNull();
  });

  it('protects changed drafts through the discard guard', async () => {
    component['setEpisodeTitle'](0, 0, 'Unsaved title');
    confirm.open.mockReturnValue(of(false));

    expect(await component['canDiscard']()).toBe(false);

    expect(confirm.open).toHaveBeenCalledWith('Metadata.DiscardChanges');
    expect(portal.close).not.toHaveBeenCalled();
    expect(component['getEpisodeTitle'](0, 0)).toBe('Unsaved title');
  });

  it('routes close actions through the shell guard', () => {
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;
    const close = vi.spyOn(shell, 'close').mockImplementation(() => undefined);
    component['onClose']();
    expect(close).toHaveBeenCalledOnce();
    expect(portal.close).not.toHaveBeenCalled();
  });

  it.each(['series-metadata-close', 'series-metadata-cancel'])('guards %s clicks', async (testId) => {
    component['onAddSeason']();
    confirm.open.mockReturnValue(of(false));
    await fixture.whenStable();
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`).click();
    await fixture.whenStable();
    expect(confirm.open).toHaveBeenCalledWith('Metadata.DiscardChanges');
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('wires the same draft protection into shell close paths', async () => {
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;
    component['onAddSeason']();
    confirm.open.mockReturnValue(of(false));
    expect(await shell.beforeClose()!()).toBe(false);
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('does not open duplicate discard confirmations across close paths', async () => {
    const response = new Subject<boolean>();
    confirm.open.mockReturnValue(response);
    component['onAddSeason']();
    const closing = component['canDiscard']();
    expect(await component['canDiscard']()).toBe(false);
    expect(confirm.open).toHaveBeenCalledOnce();
    response.next(false);
    response.complete();
    await closing;
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('allows confirmed discard but does not prompt when edits are reverted', async () => {
    component['setEpisodeTitle'](0, 0, 'Unsaved');
    expect(await component['canDiscard']()).toBe(true);
    confirm.open.mockClear();
    component['formModel'].update((metadata) => ({
      seasons: metadata.seasons.map((season) => ({ ...season, titles: [] })),
    }));
    expect(await component['canDiscard']()).toBe(true);
    expect(confirm.open).not.toHaveBeenCalled();
  });

  it.each(['shrink', 'remove', 'renumber'])('warns and confirms persisted progress loss for %s', async (change) => {
    if (change === 'shrink') component['form'].seasons[0].episodes().value.set(1);
    if (change === 'remove') component['onRemoveSeason'](0);
    if (change === 'renumber') component['form'].seasons[0].season().value.set(2);
    confirm.open.mockReturnValue(of(false));
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-test-id="series-metadata-progress-warning"]').textContent
    ).toContain('Metadata.ProgressWarning');

    await component['onSave']();

    expect(confirm.open).toHaveBeenCalledWith('Metadata.ConfirmProgressLoss', {
      destructive: true,
      confirmationText: 'Dialog.Scope.SeriesMetadata',
      actionLabel: 'Save',
    });
    expect(api.updateTrackingSeasonsByExternalId).not.toHaveBeenCalled();
    expect(component['busy']()).toBe(false);
    expect(component['hasChanges']()).toBe(true);
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('saves confirmed reductions and resets the baseline without a discard prompt', async () => {
    component['form'].seasons[0].episodes().value.set(1);
    await component['onSave']();
    expect(api.updateTrackingSeasonsByExternalId).toHaveBeenCalledOnce();
    expect(confirm.open).toHaveBeenCalledOnce();
    expect(component['hasChanges']()).toBe(false);
    expect(component['reducesMetadata']()).toBe(false);
    expect(portal.close).toHaveBeenCalledOnce();
  });

  it('does not warn for additions, count increases, or title edits', () => {
    component['onAddSeason']();
    component['form'].seasons[0].episodes().value.set(3);
    component['setEpisodeTitle'](0, 0, 'Pilot');
    expect(component['reducesMetadata']()).toBe(false);
    component['onRemoveSeason'](1);
    expect(component['reducesMetadata']()).toBe(false);
  });

  it('does not expose or execute mutations without update permission', async () => {
    fixture.componentRef.setInput('canUpdate', false);
    component['expandedSeason'].set(0);
    await fixture.whenStable();
    expect(component['actions']()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-save"]').disabled).toBe(true);
    for (const testId of [
      'series-metadata-add',
      'series-metadata-remove',
      'series-metadata-season',
      'series-metadata-episode-title',
    ]) {
      expect(fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`)).toBeNull();
    }
    component['onAddSeason']();
    component['onRemoveSeason'](0);
    component['setEpisodeTitle'](0, 0, 'Forbidden');
    await component['onSave']();
    await component['onRefreshSeriesMetadata']();
    await component['onRemoveSeriesMetadata']();
    expect(component['seasons']()).toEqual([{ season: 1, episodes: 2 }]);
    expect(component['getEpisodeTitle'](0, 0)).toBe('');
    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.updateTrackingSeasonsByExternalId).not.toHaveBeenCalled();
    expect(api.refreshTrackingSeasonsByExternalId).not.toHaveBeenCalled();
    expect(api.deleteTrackingSeasonsByExternalId).not.toHaveBeenCalled();
  });

  it('does not offer provider refresh when capability is absent', async () => {
    fixture.componentRef.setInput('externalProvider', 'openlibrary');
    await fixture.whenStable();
    expect(component['actions']().map((action) => action.id)).toEqual(['series-metadata-remove-all']);
    await component['onRefreshSeriesMetadata']();
    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.refreshTrackingSeasonsByExternalId).not.toHaveBeenCalled();
  });

  it('hides unsupported fetch when provider capability loading fails', () => {
    api.getExternalMetadataProviders.mockReturnValue(throwError(() => new Error('Unavailable')));
    component.ngOnInit();
    expect(component['supportsRefresh']()).toBe(false);
  });

  it('dispatches shared menu action IDs to the existing handlers', async () => {
    await component['onActionSelected']('series-metadata-refresh');
    await component['onActionSelected']('series-metadata-remove-all');
    expect(api.refreshTrackingSeasonsByExternalId).toHaveBeenCalledOnce();
    expect(api.deleteTrackingSeasonsByExternalId).toHaveBeenCalledOnce();
  });

  it.each(['onSave', 'onRefreshSeriesMetadata', 'onRemoveSeriesMetadata'] as const)(
    'preserves draft after failed %s',
    async (method) => {
      const error = new Error('Server unavailable');
      api.updateTrackingSeasonsByExternalId.mockReturnValue(throwError(() => error));
      api.refreshTrackingSeasonsByExternalId.mockReturnValue(throwError(() => error));
      api.deleteTrackingSeasonsByExternalId.mockReturnValue(throwError(() => error));
      component['setEpisodeTitle'](0, 0, 'Keep draft');

      await expect(component[method]()).resolves.toBeUndefined();

      expect(component['getEpisodeTitle'](0, 0)).toBe('Keep draft');
      expect(component['hasChanges']()).toBe(true);
      expect(component['busy']()).toBe(false);
      expect(component['updateFailed']()).toBe(true);
      expect(portal.close).not.toHaveBeenCalled();
      expect(TestBed.inject(spinnerLoadingStateToken).state.show()).toBe(false);
    }
  );

  it('blocks duplicate saves, further mutations, and closing while a save is pending', async () => {
    const response = new Subject<{ seasons: { season: number; episodes: number }[] }>();
    api.updateTrackingSeasonsByExternalId.mockReturnValue(response);
    const saving = component['onSave']();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-save"]').disabled).toBe(true);
    expect(await component['canDiscard']()).toBe(false);
    await component['onSave']();
    component['onAddSeason']();
    expect(component['seasons']()).toEqual([{ season: 1, episodes: 2 }]);
    expect(api.updateTrackingSeasonsByExternalId).toHaveBeenCalledOnce();
    response.next({ seasons: [{ season: 1, episodes: 2 }] });
    response.complete();
    await saving;
    expect(component['busy']()).toBe(false);
  });

  it('retries a failed save with the retained draft and clears the failure state after success', async () => {
    component['setEpisodeTitle'](0, 0, 'Retained title');
    api.updateTrackingSeasonsByExternalId.mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    await component['onSave']();
    expect(component['updateFailed']()).toBe(true);
    expect(component['hasChanges']()).toBe(true);
    api.updateTrackingSeasonsByExternalId.mockReturnValueOnce(
      of({ seasons: [{ season: 1, episodes: 2, titles: ['Retained title'] }] })
    );
    await component['onSave']();
    expect(api.updateTrackingSeasonsByExternalId).toHaveBeenLastCalledWith('omdb', 'tt-series', {
      seasons: [{ season: 1, episodes: 2, titles: ['Retained title'] }],
    });
    expect(component['updateFailed']()).toBe(false);
    expect(component['hasChanges']()).toBe(false);
    expect(portal.close).toHaveBeenCalledOnce();
  });

  it('refresh and delete update the persisted baseline without closing', async () => {
    component['setEpisodeTitle'](0, 0, 'Unsaved draft');
    await component['onRefreshSeriesMetadata']();
    expect(component['hasChanges']()).toBe(false);
    component['form'].seasons[0].episodes().value.set(2);
    expect(component['reducesMetadata']()).toBe(true);
    await component['onRemoveSeriesMetadata']();
    expect(component['hasChanges']()).toBe(false);
    expect(component['reducesMetadata']()).toBe(false);
    expect(component['actions']().map((action) => action.id)).not.toContain('series-metadata-remove-all');
    expect(portal.close).not.toHaveBeenCalled();
  });
});
