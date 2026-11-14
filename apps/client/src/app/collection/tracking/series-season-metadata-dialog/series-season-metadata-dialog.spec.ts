import { ComponentFixture, TestBed } from '@angular/core/testing';
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
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesSeasonMetadataDialog } from './series-season-metadata-dialog';

describe('SeriesSeasonMetadataDialog', () => {
  let fixture: ComponentFixture<SeriesSeasonMetadataDialog>;
  let component: SeriesSeasonMetadataDialog;
  let api: {
    updateTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    refreshTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
    deleteTrackingSeasonsByExternalId: ReturnType<typeof vi.fn>;
  };
  let portal: { close: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<ToastState>;

  beforeEach(() => {
    api = {
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
  });

  it('renders labelled action controls and disables save for invalid metadata', () => {
    const saveButton = fixture.nativeElement.querySelector(
      '[data-test-id="series-metadata-save"]'
    ) as HTMLButtonElement;
    const refreshButton = fixture.nativeElement.querySelector(
      '[data-test-id="series-metadata-refresh"]'
    ) as HTMLButtonElement;
    const removeButton = fixture.nativeElement.querySelector(
      '[data-test-id="series-metadata-remove-all"]'
    ) as HTMLButtonElement;

    expect(saveButton.type).toBe('button');
    expect(saveButton.disabled).toBe(false);
    expect(saveButton.getAttribute('aria-label')).toBe('Save');
    expect(saveButton.title).toBe('Save');
    expect(refreshButton.classList.contains('button-icon')).toBe(true);
    expect(refreshButton.getAttribute('aria-label')).toBe('RefreshSeriesMetadata');
    expect(removeButton.classList.contains('button-danger')).toBe(true);
    expect(removeButton.getAttribute('aria-label')).toBe('RemoveSeriesMetadata');

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
    const inputs = fixture.nativeElement.querySelectorAll('[data-test-id="series-metadata-season"] input');
    for (const input of inputs) {
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(fixture.nativeElement.querySelector(`[id="${input.id}-error"]`).textContent).toContain(
        'Validation.SeriesMetadataSeason'
      );
    }
  });

  it('clears errors and enables save when values return to supported boundaries', async () => {
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
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-refresh"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-remove-all"]')).not.toBeNull();
  });

  it('hides refresh and remove actions without update permission', () => {
    fixture.componentRef.setInput('ownerShareCode', 'owner-code');
    fixture.componentRef.setInput('canUpdate', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-refresh"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="series-metadata-remove-all"]')).toBeNull();
  });

  it('calls the default portal close when closed', () => {
    component['onClose']();

    expect(portal.close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
  });

  it('reads and writes episode titles', () => {
    component['setEpisodeTitle'](0, 0, 'Pilot');
    component['setEpisodeTitle'](0, 1, 'Episode 2');

    expect(component['getEpisodeTitle'](0, 0)).toBe('Pilot');
    expect(component['getEpisodeTitle'](0, 1)).toBe('Episode 2');
    expect(component['getEpisodeTitle'](0, 2)).toBe('');
  });

  it('calls custom closed callback without closing portal', () => {
    const customClosed = vi.fn();
    fixture.componentRef.setInput('closed', customClosed);
    component['onClose']();

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
});
