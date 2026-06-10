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
    fixture.componentRef.setInput('initialSeasons', [{ season: 1, episodes: 2, titles: [] }]);
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

  it('saves sorted metadata with titles and closes', async () => {
    api.updateSeriesTrackerSeasons.mockReturnValue(of({ seasons: [{ season: 1, episodes: 2, titles: ['Pilot'] }] }));
    const saved = vi.fn();
    fixture.componentRef.setInput('saved', saved);
    component['form']().reset({
      seasons: [
        { season: 2, episodes: 4, titles: [] },
        { season: 1, episodes: 3, titles: ['Pilot'] },
      ],
    });

    await component['onSave']();

    expect(api.updateSeriesTrackerSeasons).toHaveBeenCalledWith('tt-series', {
      seasons: [
        { season: 1, episodes: 3, titles: ['Pilot'] },
        { season: 2, episodes: 4, titles: [] },
      ],
    });
    expect(saved).toHaveBeenCalledWith([{ season: 1, episodes: 2, titles: ['Pilot'] }], undefined);
    expect(toastState.state.message()).toBe('Toast.SeriesMetadataSaved');
    expect(portal.close).toHaveBeenCalled();
  });

  it('calls the default portal close when closed', () => {
    component['onClose']();

    expect(portal.close).toHaveBeenCalled();
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
});
