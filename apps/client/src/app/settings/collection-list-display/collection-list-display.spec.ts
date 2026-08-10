import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../settings-service';
import { SettingsCollectionListDisplay } from './collection-list-display';

describe('SettingsCollectionListDisplay', () => {
  let fixture: ComponentFixture<SettingsCollectionListDisplay>;
  let component: SettingsCollectionListDisplay;
  let settings: { storeCollectionListDisplayPreferences: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    settings = { storeCollectionListDisplayPreferences: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsCollectionListDisplay],
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialMainState, mainStateToken),
      ],
    });
    TestBed.overrideComponent(SettingsCollectionListDisplay, {
      set: {
        template: '',
      },
    });

    fixture = TestBed.createComponent(SettingsCollectionListDisplay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes from main state preferences', () => {
    expect(component['form'].showYear().value()).toBe(true);
    expect(component['form'].showSharedIcon().value()).toBe(true);
    expect(component['form'].preferredRating().value()).toBe('imdb');
    expect(component['form'].imdbRatingFallback().value()).toBe(false);
  });

  it('exposes translated labels and rating options', () => {
    expect(component['translations'].collectionListDisplay()).toBe('CollectionListDisplay');
    expect(component['translations'].messageCollectionListDisplay()).toBe('Message.CollectionListDisplay');
    expect(component['translations'].showYear()).toBe('ShowYear');
    expect(component['translations'].showSharedIcon()).toBe('ShowSharedIcon');
    expect(component['translations'].preferredRating()).toBe('PreferredRating');
    expect(component['translations'].imdbRatingFallback()).toBe('IMDbRatingFallback');
    expect(component['translations'].messageImdbRatingFallback()).toBe('Message.IMDbRatingFallback');
    expect(component['ratingOptions']()).toEqual([
      { text: 'IMDbRate', value: 'imdb' },
      { text: 'RottenTomatoes', value: 'rottenTomatoes' },
      { text: 'Metacritic', value: 'metacritic' },
      { text: 'UserRate', value: 'user' },
    ]);
  });

  it('stores checkbox changes', () => {
    component['onShowYearChange'](false);

    expect(settings.storeCollectionListDisplayPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ showYear: false })
    );
  });

  it('stores shared icon and IMDb fallback checkbox changes', () => {
    component['onShowSharedIconChange'](false);
    component['onImdbRatingFallbackChange'](true);

    expect(settings.storeCollectionListDisplayPreferences).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ showSharedIcon: false })
    );
    expect(settings.storeCollectionListDisplayPreferences).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ imdbRatingFallback: true })
    );
  });

  it('ignores non-boolean checkbox changes', () => {
    component['onShowYearChange'](null);
    component['onShowSharedIconChange'](null);
    component['onImdbRatingFallbackChange'](null);

    expect(settings.storeCollectionListDisplayPreferences).not.toHaveBeenCalled();
  });

  it('stores preferred rating changes', () => {
    component['onPreferredRatingChange']('metacritic');

    expect(settings.storeCollectionListDisplayPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ preferredRating: 'metacritic' })
    );
  });

  it('ignores invalid preferred rating changes', () => {
    component['onPreferredRatingChange']('letterboxd');

    expect(settings.storeCollectionListDisplayPreferences).not.toHaveBeenCalled();
  });
});
