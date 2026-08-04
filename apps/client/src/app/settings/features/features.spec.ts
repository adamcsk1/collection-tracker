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
      books: true,
      wishlist: false,
      watchlist: true,
      watched: false,
      watching: true,
    });
    fixture = TestBed.createComponent(SettingsFeatures);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes the form from main state preferences without saving', () => {
    expect(component['formModel']()).toEqual({
      books: true,
      wishlist: false,
      watchlist: true,
      watched: false,
      watching: true,
    });
    expect(settings.storeCollectionFeaturePreferences).not.toHaveBeenCalled();
  });

  it('updates and stores a changed feature preference', () => {
    component['onChange']('watched', true);

    expect(component['formModel']().watched).toBe(true);
    expect(settings.storeCollectionFeaturePreferences).toHaveBeenCalledWith({
      books: true,
      wishlist: false,
      watchlist: true,
      watched: true,
      watching: true,
    });
  });

  it('updates the form when API-backed main state replaces cached preferences', () => {
    mainState.setState('collectionFeaturePreferences', {
      books: false,
      wishlist: true,
      watchlist: false,
      watched: true,
      watching: false,
    });
    fixture.detectChanges();

    expect(component['formModel']()).toEqual({
      books: false,
      wishlist: true,
      watchlist: false,
      watched: true,
      watching: false,
    });
  });

  it('ignores non-boolean checkbox values', () => {
    component['onChange']('wishlist', null);

    expect(settings.storeCollectionFeaturePreferences).not.toHaveBeenCalled();
  });
});
