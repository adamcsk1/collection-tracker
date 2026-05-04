import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { mainStateToken } from '../main/main-store';
import { AccessTokens } from './access-tokens/access-tokens';
import { AccountActions } from './account-actions/account-actions';
import { ChangeWatchedStatusService } from './change-watched-status/change-watched-status-service';
import { ImageRefreshService } from './image-refresh/image-refresh-service';
import { SettingsModel } from './settings-model';
import { SettingsService } from './settings-service';
import { Checkbox } from '@components/checkbox/checkbox';
import { Details } from '@components/details/details';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { OMDbService } from '@services/omdb/omdb-service';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-settings',
  imports: [Select, FormField, FormRoot, NgxSignalTranslatePipe, Details, AccountActions, AccessTokens, Checkbox],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  providers: [OMDbService, ImageRefreshService, ChangeWatchedStatusService],
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  protected readonly submitAction = signal<'save' | 'save-and-back'>('save');
  private readonly settings = inject(SettingsService);
  private readonly mainState = inject(mainStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly imageRefresh = inject(ImageRefreshService);
  private readonly changeWatchedStatus = inject(ChangeWatchedStatusService);
  private readonly translate = inject(TranslateService);
  private readonly theme = inject(ThemeService);
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
        action: async () => this.onSave(this.submitAction() === 'save-and-back'),
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

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }

  private onSave(navigateBack = false): void {
    this.settings.storeFormData(this.settingsModel(), navigateBack);
  }

  protected onMarkAllAsWatched(): void {
    this.changeWatchedStatus.markAllAsWatched();
  }

  protected onMarkAllAsUnwatched(): void {
    this.changeWatchedStatus.markAllAsUnwatched();
  }
}
