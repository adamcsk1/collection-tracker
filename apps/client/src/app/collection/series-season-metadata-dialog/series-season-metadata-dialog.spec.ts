import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesSeasonMetadataDialog } from './series-season-metadata-dialog';

describe('SeriesSeasonMetadataDialog', () => {
  let fixture: ComponentFixture<SeriesSeasonMetadataDialog>;
  let component: SeriesSeasonMetadataDialog;
  let api: { updateSeriesTrackerSeasons: ReturnType<typeof vi.fn> };
  let portal: { close: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<ToastState>;

  beforeEach(() => {
    api = { updateSeriesTrackerSeasons: vi.fn(() => of({ seasons: [{ season: 1, episodes: 2 }] })) };
    portal = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SeriesSeasonMetadataDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialToastState, toastStateToken),
      ],
    });
    TestBed.overrideComponent(SeriesSeasonMetadataDialog, { set: { template: '' } });

    fixture = TestBed.createComponent(SeriesSeasonMetadataDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    fixture.componentRef.setInput('imdbId', 'tt-series');
    fixture.componentRef.setInput('initialSeasons', [{ season: 1, episodes: 2 }]);
    fixture.detectChanges();
  });

  it('initializes rows from input metadata', () => {
    expect(component['seasons']()).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('requires positive episode counts', () => {
    component['form'].seasons[0].episodes().value.set(0);

    expect(component['valid']()).toBe(false);
  });

  it('rejects episode counts above the supported range', () => {
    component['form'].seasons[0].episodes().value.set(101);

    expect(component['valid']()).toBe(false);
  });

  it('saves sorted metadata and closes', async () => {
    const saved = vi.fn();
    const closed = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    fixture.componentRef.setInput('closed', closed);
    component['form']().reset({
      seasons: [
        { season: 2, episodes: 4 },
        { season: 1, episodes: 3 },
      ],
    });

    await component['save']();

    expect(api.updateSeriesTrackerSeasons).toHaveBeenCalledWith('tt-series', {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 4 },
      ],
    });
    expect(saved).toHaveBeenCalledWith([{ season: 1, episodes: 2 }]);
    expect(toastState.state.message()).toBe('Toast.SeriesMetadataSaved');
    expect(closed).toHaveBeenCalled();
    expect(portal.close).not.toHaveBeenCalled();
  });

  it('calls the close callback when closed', () => {
    const closed = vi.fn();
    fixture.componentRef.setInput('closed', closed);

    component['close']();

    expect(closed).toHaveBeenCalled();
  });
});
