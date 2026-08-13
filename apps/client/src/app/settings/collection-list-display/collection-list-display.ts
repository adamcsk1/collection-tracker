import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { Callout } from '@components/callout/callout';
import { Checkbox } from '@components/checkbox/checkbox';
import { Select } from '@components/select/select';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
  DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES,
} from '@shared/models/collection-list-display-preferences-model';
import { SelectDataModel } from '@shared/models/select-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../main/main-store';
import { SettingsService } from '../settings-service';

@Component({
  selector: 'ct-settings-collection-list-display',
  imports: [Callout, Checkbox, FormField, FormRoot, Select],
  templateUrl: './collection-list-display.html',
  styleUrl: './collection-list-display.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsCollectionListDisplay implements OnInit {
  private readonly mainState = inject(mainStateToken);
  private readonly settings = inject(SettingsService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    collectionListDisplay: computed(() => this.ngxSignalTranslate.translate('CollectionListDisplay')),
    messageCollectionListDisplay: computed(() => this.ngxSignalTranslate.translate('Message.CollectionListDisplay')),
    showYear: computed(() => this.ngxSignalTranslate.translate('ShowYear')),
    showSharedIcon: computed(() => this.ngxSignalTranslate.translate('ShowSharedIcon')),
    preferredRating: computed(() => this.ngxSignalTranslate.translate('PreferredRating')),
    imdbRate: computed(() => this.ngxSignalTranslate.translate('IMDbRate')),
    rottenTomatoes: computed(() => this.ngxSignalTranslate.translate('RottenTomatoes')),
    metacritic: computed(() => this.ngxSignalTranslate.translate('Metacritic')),
    userRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    imdbRatingFallback: computed(() => this.ngxSignalTranslate.translate('IMDbRatingFallback')),
    messageImdbRatingFallback: computed(() => this.ngxSignalTranslate.translate('Message.IMDbRatingFallback')),
  };
  protected readonly formModel = signal<CollectionListDisplayPreferencesModel>(
    DEFAULT_COLLECTION_LIST_DISPLAY_PREFERENCES
  );
  protected readonly form = form(this.formModel);
  protected readonly ratingOptions = computed(() => [
    { text: this.translations.imdbRate(), value: 'imdb' },
    { text: this.translations.rottenTomatoes(), value: 'rottenTomatoes' },
    { text: this.translations.metacritic(), value: 'metacritic' },
    { text: this.translations.userRate(), value: 'user' },
  ]);

  public ngOnInit(): void {
    this.formModel.set(this.mainState.state.collectionListDisplayPreferences());
  }

  protected onShowYearChange(selectedValue: boolean | null): void {
    if (typeof selectedValue !== 'boolean') return;

    this.storePreferences({ showYear: selectedValue });
  }

  protected onShowSharedIconChange(selectedValue: boolean | null): void {
    if (typeof selectedValue !== 'boolean') return;

    this.storePreferences({ showSharedIcon: selectedValue });
  }

  protected onPreferredRatingChange(selectedValue: SelectDataModel['value']): void {
    const preferredRating = COLLECTION_LIST_DISPLAY_RATINGS.find((rating) => rating === selectedValue);
    if (!preferredRating) return;

    this.storePreferences({ preferredRating });
  }

  protected onImdbRatingFallbackChange(selectedValue: boolean | null): void {
    if (typeof selectedValue !== 'boolean') return;

    this.storePreferences({ imdbRatingFallback: selectedValue });
  }

  private storePreferences(changes: Partial<CollectionListDisplayPreferencesModel>): void {
    const updatedPreferences = { ...this.formModel(), ...changes };
    this.formModel.set(updatedPreferences);
    this.settings.storeCollectionListDisplayPreferences(updatedPreferences);
  }
}
