import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { mainStateToken } from '@client/main/main-store';
import { AccessTokens } from '@client/settings/access-tokens/access-tokens';
import { AccountActions } from '@client/settings/account-actions/account-actions';
import { ImageRefreshService } from '@client/settings/image-refresh/image-refresh-service';
import { SettingsModel } from '@client/settings/settings-model';
import { SettingsService } from '@client/settings/settings-service';
import { Details } from '@components/details/details';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { OMDbService } from '@services/omdb/omdb-service';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-settings',
  imports: [Input, Select, ReactiveFormsModule, NgxSignalTranslatePipe, Details, AccountActions, AccessTokens],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  providers: [OMDbService, ImageRefreshService],
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly imageRefresh = inject(ImageRefreshService);
  private readonly translate = inject(TranslateService);
  private readonly theme = inject(ThemeService);
  protected readonly formGroup = new FormGroup<Form<SettingsModel>>({
    sensitiveDataStorage: new FormControl('local', { nonNullable: true, validators: [Validators.required] }),
    clearLocalStorageAfterLogout: new FormControl('false', { nonNullable: true, validators: [Validators.required] }),
    omdbApiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    appMode: new FormControl('basic', { nonNullable: true, validators: [Validators.required] }),
    fetchBatchSize: new FormControl(10000, { nonNullable: true, validators: [Validators.required] }),
    theme: new FormControl('system', { nonNullable: true, validators: [Validators.required] }),
    settingsLock: new FormControl('false', { nonNullable: true, validators: [Validators.required] }),
    animatedBackground: new FormControl('true', { nonNullable: true, validators: [Validators.required] }),
    language: new FormControl('en', { nonNullable: true, validators: [Validators.required] }),
    searchMode: new FormControl('standard', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
  protected readonly themeOptions = this.theme.themeOptions;
  protected readonly languageOptions = this.translate.languageOptions;

  public ngOnInit(): void {
    this.formGroup.setValue({
      sensitiveDataStorage: this.mainState.state.sensitiveDataStorage(),
      omdbApiKey: this.omdbState.state.apiKey(),
      appMode: this.mainState.state.appMode(),
      fetchBatchSize: this.apiState.state.fetchBatchSize(),
      theme: this.themeState.state.theme(),
      settingsLock: this.mainState.state.settingsLock() ? 'true' : 'false',
      clearLocalStorageAfterLogout: this.mainState.state.clearLocalStorageAfterLogout() ? 'true' : 'false',
      animatedBackground: this.mainState.state.animatedBackground() ? 'true' : 'false',
      language: this.mainState.state.language(),
      searchMode: this.mainState.state.searchMode(),
    });
  }

  protected onSave(navigateBack = false): void {
    this.settings.storeFormData(this.formGroup.getRawValue(), navigateBack);
  }

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }
}
