import { PercentPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { mainStateToken } from '@client/main/main-store';
import { ImageRefreshService } from '@client/settings/image-refresh/image-refresh-service';
import { SettingsService } from '@client/settings/settings-service';
import { SettingsModel } from '@client/settings/settings.model';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { OMDbService } from '@services/omdb/omdb-service';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { themeStateToken } from '@services/theme/theme-store';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { of } from 'rxjs';
import { catchError, debounceTime, filter, map, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'ct-settings',
  imports: [Input, Select, ReactiveFormsModule, NgxSignalTranslatePipe, PercentPipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  providers: [OMDbService, ImageRefreshService],
})
export class Settings implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly api = inject(ApiService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly imageRefresh = inject(ImageRefreshService);
  protected readonly formGroup = new FormGroup<Form<SettingsModel>>({
    apiUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    storeCredentials: new FormControl(false, { nonNullable: true, validators: [Validators.required] }),
    omdbApiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    appMode: new FormControl('basic', { nonNullable: true, validators: [Validators.required] }),
    fetchBatchSize: new FormControl(10000, { nonNullable: true, validators: [Validators.required] }),
    theme: new FormControl('system', { nonNullable: true, validators: [Validators.required] }),
    settingsLock: new FormControl(false, { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly connected = signal<boolean | null>(false);
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
  protected readonly imageRefreshStatus = this.imageRefresh.state;

  public ngOnInit(): void {
    this.formGroup.valueChanges
      .pipe(
        tap(() => this.connected.set(null)),
        filter((values) => !!values.apiUrl),
        debounceTime(500),
        switchMap((values) => this.api.getHealth({ temporaryApiUrl: values.apiUrl, suppressErrors: true })),
        map(() => true),
        catchError(() => of(false))
      )
      .subscribe((status) => this.connected.set(status));

    this.formGroup.setValue({
      apiUrl: this.apiState.state.apiUrl(),
      storeCredentials: true, // !! TODO
      omdbApiKey: this.omdbState.state.apiKey(),
      appMode: this.mainState.state.appMode() || 'basic',
      fetchBatchSize: this.apiState.state.fetchBatchSize() || 10000,
      theme: this.themeState.state.theme(),
      settingsLock: this.mainState.state.settingsLock(),
    });
  }

  protected onSave(navigateBack = false): void {
    this.settings.storeFormData(this.formGroup.getRawValue(), navigateBack);
  }

  protected onReset(): void {
    this.formGroup.reset();
  }

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }
}
