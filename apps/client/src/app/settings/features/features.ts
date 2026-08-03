import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { Checkbox } from '@components/checkbox/checkbox';
import { CollectionFeaturePreferencesModel } from '@shared/models/collection-feature-preferences-model';
import { DEFAULT_COLLECTION_FEATURE_PREFERENCES } from '@shared/constants/collection-feature-preferences-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../main/main-store';
import { SettingsService } from '../settings-service';

@Component({
  selector: 'ct-settings-features',
  imports: [Checkbox, FormField, FormRoot],
  templateUrl: './features.html',
  styleUrl: './features.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsFeatures {
  private readonly mainState = inject(mainStateToken);
  private readonly settings = inject(SettingsService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    message: computed(() => this.ngxSignalTranslate.translate('Message.Features')),
    wishlist: computed(() => this.ngxSignalTranslate.translate('Wishlist')),
    watchLater: computed(() => this.ngxSignalTranslate.translate('WatchLater')),
    watchTracker: computed(() => this.ngxSignalTranslate.translate('WatchTracker')),
    seriesTracker: computed(() => this.ngxSignalTranslate.translate('SeriesTracker')),
    bookTracker: computed(() => this.ngxSignalTranslate.translate('BookTracker')),
  };
  protected readonly formModel = signal<CollectionFeaturePreferencesModel>(DEFAULT_COLLECTION_FEATURE_PREFERENCES);
  protected readonly form = form(this.formModel);

  constructor() {
    effect(() => this.formModel.set(this.mainState.state.collectionFeaturePreferences()));
  }

  protected onChange(feature: keyof CollectionFeaturePreferencesModel, selectedValue: boolean | null): void {
    if (typeof selectedValue !== 'boolean') return;

    const preferences = { ...this.mainState.state.collectionFeaturePreferences(), [feature]: selectedValue };
    this.formModel.set(preferences);
    this.settings.storeCollectionFeaturePreferences(preferences);
  }
}
