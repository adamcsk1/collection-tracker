import { PercentPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { mainStateToken } from '@client/main/main-store';
import { ImageRefreshService } from '@client/settings/image-refresh/image-refresh-service';
import { SettingsModel } from '@client/settings/settings-model';
import { SettingsService } from '@client/settings/settings-service';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { OMDbService } from '@services/omdb/omdb-service';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { themeStateToken } from '@services/theme/theme-store';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-settings',
  imports: [Input, Select, ReactiveFormsModule, NgxSignalTranslatePipe, PercentPipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  providers: [OMDbService, ImageRefreshService],
})
export class Settings implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly imageRefresh = inject(ImageRefreshService);
  protected readonly formGroup = new FormGroup<Form<SettingsModel>>({
    sensitiveDataStorage: new FormControl('local', { nonNullable: true, validators: [Validators.required] }),
    omdbApiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    appMode: new FormControl('basic', { nonNullable: true, validators: [Validators.required] }),
    fetchBatchSize: new FormControl(10000, { nonNullable: true, validators: [Validators.required] }),
    theme: new FormControl('system', { nonNullable: true, validators: [Validators.required] }),
    settingsLock: new FormControl(false, { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
  protected readonly imageRefreshStatus = this.imageRefresh.state;

  public ngOnInit(): void {
    this.formGroup.setValue({
      sensitiveDataStorage: this.settings.sensitiveDataStorage,
      omdbApiKey: this.omdbState.state.apiKey(),
      appMode: this.mainState.state.appMode(),
      fetchBatchSize: this.apiState.state.fetchBatchSize(),
      theme: this.themeState.state.theme(),
      settingsLock: this.mainState.state.settingsLock(),
    });
  }

  protected onSave(navigateBack = false): void {
    this.settings.storeFormData(this.formGroup.getRawValue(), navigateBack);
  }

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }
}
