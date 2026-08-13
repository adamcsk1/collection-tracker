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
    mainState = TestBed.inject(mainStateToken);
    mainState.setState('collectionFeaturePreferences', {
      books: true,
      wishlist: false,
      upNext: true,
      tracking: true,
    });
    fixture = TestBed.createComponent(SettingsFeatures);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders feature guidance as an article callout', () => {
    const callout = fixture.nativeElement.querySelector('[data-test-id="features-info"]');

    expect(callout.querySelector('aside').getAttribute('role')).toBe('note');
    expect(callout.querySelector('.material-icons').textContent.trim()).toBe('article');
    expect(callout.textContent).toContain('Message.Features');
  });

  it('initializes the form from main state preferences without saving', () => {
    expect(component['formModel']()).toEqual({
      books: true,
      wishlist: false,
      upNext: true,
      tracking: true,
    });
    expect(settings.storeCollectionFeaturePreferences).not.toHaveBeenCalled();
  });

  it('updates and stores a changed feature preference', () => {
    component['onChange']('tracking', true);

    expect(component['formModel']().tracking).toBe(true);
    expect(settings.storeCollectionFeaturePreferences).toHaveBeenCalledWith({
      books: true,
      wishlist: false,
      upNext: true,
      tracking: true,
    });
  });

  it('updates the form when API-backed main state replaces cached preferences', () => {
    mainState.setState('collectionFeaturePreferences', {
      books: false,
      wishlist: true,
      upNext: false,
      tracking: true,
    });
    fixture.detectChanges();

    expect(component['formModel']()).toEqual({
      books: false,
      wishlist: true,
      upNext: false,
      tracking: true,
    });
  });

  it('ignores non-boolean checkbox values', () => {
    component['onChange']('wishlist', null);

    expect(settings.storeCollectionFeaturePreferences).not.toHaveBeenCalled();
  });
});
