import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { Checkbox } from '@components/checkbox/checkbox';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../main/main-store';
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
    appMode: computed(() => this.ngxSignalTranslate.translate('AppMode')),
    messageAppMode: computed(() => this.ngxSignalTranslate.translate('Message.AppMode')),
    basicAccess: computed(() => this.ngxSignalTranslate.translate('BasicAccess')),
    limitedAccess: computed(() => this.ngxSignalTranslate.translate('LimitedAccess')),
    fullAccess: computed(() => this.ngxSignalTranslate.translate('FullAccess')),
    settingsLock: computed(() => this.ngxSignalTranslate.translate('SettingsLock')),
    messageSettingsLock: computed(() => this.ngxSignalTranslate.translate('Message.SettingsLock')),
    messageStorageSettings: computed(() => this.ngxSignalTranslate.translate('Message.StorageSettings')),
    sensitiveDataStorage: computed(() => this.ngxSignalTranslate.translate('SensitiveDataStorage')),
    messageSensitiveDataStorage: computed(() => this.ngxSignalTranslate.translate('Message.SensitiveDataStorage')),
    localStorage: computed(() => this.ngxSignalTranslate.translate('LocalStorage')),
    sessionStorage: computed(() => this.ngxSignalTranslate.translate('SessionStorage')),
    clearLocalStorageAfterLogout: computed(() => this.ngxSignalTranslate.translate('ClearLocalStorageAfterLogout')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
  };
  protected readonly submitAction = signal<'save'>('save');
  protected readonly settingsModel = signal<SettingsModel>({
    sensitiveDataStorage: 'local',
    clearLocalStorageAfterLogout: false,
    appMode: 'basic',
    theme: 'system',
    settingsLock: false,
    animatedBackground: true,
    language: 'en',
  });
  protected readonly form = form(
    this.settingsModel,
    (settings) => {
      required(settings.sensitiveDataStorage);
      required(settings.appMode);
      required(settings.theme);
      required(settings.language);
    },
    {
      submission: {
        action: async () => this.onSave(),
      },
    }
  );
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
  protected readonly themeOptions = this.theme.themeOptions;
  protected readonly languageOptions = this.translate.languageOptions;

  public ngOnInit(): void {
    this.settingsModel.set({
      sensitiveDataStorage: this.mainState.state.sensitiveDataStorage(),
      appMode: this.mainState.state.appMode(),
      theme: this.themeState.state.theme(),
      settingsLock: this.mainState.state.settingsLock(),
      clearLocalStorageAfterLogout: this.mainState.state.clearLocalStorageAfterLogout(),
      animatedBackground: this.mainState.state.animatedBackground(),
      language: this.mainState.state.language(),
    });
  }

  private onSave(): void {
    this.settings.storeFormData(this.settingsModel());
  }
}
