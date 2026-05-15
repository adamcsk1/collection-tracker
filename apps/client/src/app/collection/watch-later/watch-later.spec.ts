import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it, vi } from 'vitest';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { WatchLater } from './watch-later';

describe('WatchLater', () => {
  it('opens the watch later dialog from the empty CTA', () => {
    const portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [WatchLater],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: { searchItems: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    TestBed.overrideComponent(WatchLater, { set: { template: '' } });
    const fixture: ComponentFixture<WatchLater> = TestBed.createComponent(WatchLater);
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddWatchLater'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { watchLater: true });
  });
});
