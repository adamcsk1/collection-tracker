import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it, vi } from 'vitest';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { SeriesTracker } from './series-tracker';

describe('SeriesTracker', () => {
  it('opens the series tracker dialog from the empty CTA', () => {
    const portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SeriesTracker],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: { searchItems: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    TestBed.overrideComponent(SeriesTracker, { set: { template: '' } });
    const fixture: ComponentFixture<SeriesTracker> = TestBed.createComponent(SeriesTracker);
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddSeriesTracker'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { seriesTracker: true });
  });
});
