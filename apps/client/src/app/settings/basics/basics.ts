import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { Checkbox } from '@components/checkbox/checkbox';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { SelectDataModel } from '@shared/models/select-model';
import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../main/main-store';
import { SENSITIVE_DATA_STORAGE_MODES } from '../settings-const';
import { SettingsModel } from '../settings-model';
import { SettingsService } from '../settings-service';

@Component({
  selector: 'ct-settings-basics',
  imports: [Select, FormField, FormRoot, Checkbox],
  templateUrl: './basics.html',
  styleUrl: './basics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsBasics implements OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly settings = inject(SettingsService);
  private readonly mainState = inject(mainStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly translate = inject(TranslateService);
  private readonly theme = inject(ThemeService);
  protected readonly translations = {
    language: computed(() => this.ngxSignalTranslate.translate('Language')),
    theme: computed(() => this.ngxSignalTranslate.translate('Theme')),
    animatedBackground: computed(() => this.ngxSignalTranslate.translate('AnimatedBackground')),
    messageAnimatedBackground: computed(() => this.ngxSignalTranslate.translate('Message.AnimatedBackground')),
    messageStorageSettings: computed(() => this.ngxSignalTranslate.translate('Message.StorageSettings')),
    sensitiveDataStorage: computed(() => this.ngxSignalTranslate.translate('SensitiveDataStorage')),
    messageSensitiveDataStorage: computed(() => this.ngxSignalTranslate.translate('Message.SensitiveDataStorage')),
    localStorage: computed(() => this.ngxSignalTranslate.translate('LocalStorage')),
    sessionStorage: computed(() => this.ngxSignalTranslate.translate('SessionStorage')),
    clearLocalStorageAfterLogout: computed(() => this.ngxSignalTranslate.translate('ClearLocalStorageAfterLogout')),
  };
  protected readonly settingsModel = signal<SettingsModel>({
    sensitiveDataStorage: 'local',
    clearLocalStorageAfterLogout: false,
    animatedBackground: true,
    theme: 'system',
    language: 'en',
  });
  protected readonly form = form(this.settingsModel, (settings) => {
    required(settings.sensitiveDataStorage);
    required(settings.theme);
    required(settings.language);
  });
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly themeOptions = this.theme.themeOptions;
  protected readonly languageOptions = this.translate.languageOptions;

  public ngOnInit(): void {
    this.settingsModel.set({
      sensitiveDataStorage: this.mainState.state.sensitiveDataStorage(),
      theme: this.themeState.state.theme(),
      clearLocalStorageAfterLogout: this.mainState.state.clearLocalStorageAfterLogout(),
      animatedBackground: this.mainState.state.animatedBackground(),
      language: this.mainState.state.language(),
    });
  }

  protected onLanguageChange(selectedValue: SelectDataModel['value']): void {
    const language = LANGUAGES.find((allowedLanguage) => allowedLanguage === selectedValue);
    if (!language) return;

    this.storeSettings({ language });
  }

  protected onThemeChange(selectedValue: SelectDataModel['value']): void {
    const theme = THEMES.find((allowedTheme) => allowedTheme === selectedValue);
    if (!theme) return;

    this.storeSettings({ theme });
  }

  protected onAnimatedBackgroundChange(selectedValue: boolean | null): void {
    if (typeof selectedValue !== 'boolean') return;

    this.storeSettings({ animatedBackground: selectedValue });
  }

  protected onSensitiveDataStorageChange(selectedValue: SelectDataModel['value']): void {
    const sensitiveDataStorage = SENSITIVE_DATA_STORAGE_MODES.find((storageMode) => storageMode === selectedValue);
    if (!sensitiveDataStorage) return;

    this.storeSettings({ sensitiveDataStorage });
  }

  protected onClearLocalStorageAfterLogoutChange(selectedValue: boolean | null): void {
    if (typeof selectedValue !== 'boolean') return;

    this.storeSettings({ clearLocalStorageAfterLogout: selectedValue });
  }

  private storeSettings(changes: Partial<SettingsModel>): void {
    const updatedSettings = { ...this.settingsModel(), ...changes };
    this.settingsModel.set(updatedSettings);
    if (this.form().invalid()) return;

    this.settings.storeFormData(updatedSettings);
  }
}
