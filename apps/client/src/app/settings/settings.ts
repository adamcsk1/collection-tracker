import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { mainStateToken } from '@client/main/main-store';
import { AccessTokens } from '@client/settings/access-tokens/access-tokens';
import { AccountActions } from '@client/settings/account-actions/account-actions';
import { ChangeWatchedStatusService } from '@client/settings/change-watched-status/change-watched-status-service';
import { ImageRefreshService } from '@client/settings/image-refresh/image-refresh-service';
import { SettingsModel } from '@client/settings/settings-model';
import { SettingsService } from '@client/settings/settings-service';
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
    fetchBatchSize: 10000,
    theme: 'system',
    settingsLock: false,
    animatedBackground: true,
    language: 'en',
    searchMode: 'standard',
  });
  protected readonly form = form(
    this.settingsModel,
    (settings) => {
      required(settings.sensitiveDataStorage);
      required(settings.appMode);
      required(settings.fetchBatchSize);
      required(settings.theme);
      required(settings.language);
      required(settings.searchMode);
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
      fetchBatchSize: this.apiState.state.fetchBatchSize(),
      theme: this.themeState.state.theme(),
      settingsLock: this.mainState.state.settingsLock(),
      clearLocalStorageAfterLogout: this.mainState.state.clearLocalStorageAfterLogout(),
      animatedBackground: this.mainState.state.animatedBackground(),
      language: this.mainState.state.language(),
      searchMode: this.mainState.state.searchMode(),
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
