import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, MainState, mainStateToken } from '../../main/main-store';
import { SettingsService } from '../settings-service';
import { SettingsFeatures } from './features';

describe('SettingsFeatures', () => {
  let fixture: ComponentFixture<SettingsFeatures>;
  let component: SettingsFeatures;
  let settings: { storeCollectionFeaturePreferences: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;

  beforeEach(() => {
    settings = { storeCollectionFeaturePreferences: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SettingsFeatures],
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialMainState, mainStateToken),
      ],
    });
    TestBed.overrideComponent(SettingsFeatures, { set: { template: '', imports: [] } });

    mainState = TestBed.inject(mainStateToken);
    mainState.setState('collectionFeaturePreferences', {
      wishlist: false,
      watchLater: true,
      movieTracker: false,
      seriesTracker: true,
    });
    fixture = TestBed.createComponent(SettingsFeatures);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes the form from main state preferences without saving', () => {
    expect(component['formModel']()).toEqual({
      wishlist: false,
      watchLater: true,
      movieTracker: false,
      seriesTracker: true,
    });
    expect(settings.storeCollectionFeaturePreferences).not.toHaveBeenCalled();
  });

  it('updates and stores a changed feature preference', () => {
    component['onChange']('movieTracker', true);

    expect(component['formModel']().movieTracker).toBe(true);
    expect(settings.storeCollectionFeaturePreferences).toHaveBeenCalledWith({
      wishlist: false,
      watchLater: true,
      movieTracker: true,
      seriesTracker: true,
    });
  });

  it('updates the form when API-backed main state replaces cached preferences', () => {
    mainState.setState('collectionFeaturePreferences', {
      wishlist: true,
      watchLater: false,
      movieTracker: true,
      seriesTracker: false,
    });
    fixture.detectChanges();

    expect(component['formModel']()).toEqual({
      wishlist: true,
      watchLater: false,
      movieTracker: true,
      seriesTracker: false,
    });
  });

  it('ignores non-boolean checkbox values', () => {
    component['onChange']('wishlist', null);

    expect(settings.storeCollectionFeaturePreferences).not.toHaveBeenCalled();
  });
});
