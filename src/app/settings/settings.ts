import { PercentPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { appStateToken } from '@appStore';
import { Input } from '@lib/components/input/input';
import { Select } from '@lib/components/select/select';
import { Form } from '@lib/models/form-model';
import { MemosService } from '@lib/services/memos/memos-service';
import { memosStateToken } from '@lib/services/memos/memos-store';
import { OMDbService } from '@lib/services/omdb/omdb-service';
import { omdbStateToken } from '@lib/services/omdb/omdb-store';
import { themeStateToken } from '@lib/services/theme/theme-store';
import { ImageRefreshService } from '@settings/image-refresh/image-refresh-service';
import { SettingsService } from '@settings/settings-service';
import { SettingsModel } from '@settings/settings.model';
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
  private readonly memos = inject(MemosService);
  private readonly appState = inject(appStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly memosState = inject(memosStateToken);
  private readonly imageRefresh = inject(ImageRefreshService);
  private readonly _connected = signal<boolean | null>(false);
  protected readonly formGroup = new FormGroup<Form<SettingsModel>>({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apiUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    storeCredentials: new FormControl(false, { nonNullable: true, validators: [Validators.required] }),
    omdbApiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    appMode: new FormControl('basic', { nonNullable: true, validators: [Validators.required] }),
    fetchBatchSize: new FormControl(10000, { nonNullable: true, validators: [Validators.required] }),
    theme: new FormControl('system', { nonNullable: true, validators: [Validators.required] }),
    settingsLock: new FormControl(false, { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly connected = this._connected.asReadonly();
  protected readonly memosLoadNetworkStatus = this.memosState.state.loadNetworkStatus;
  protected readonly settingLockEnabled = this.appState.state.settingsLock;
  protected readonly imageRefreshStatus = this.imageRefresh.state;

  public ngOnInit(): void {
    this.formGroup.valueChanges
      .pipe(
        tap(() => this._connected.set(null)),
        filter((values) => !!values.token && !!values.apiUrl),
        debounceTime(500),
        switchMap((values) =>
          this.memos.getProfile({ temporaryApiUrl: values.apiUrl, temporaryToken: values.token, suppressErrors: true })
        ),
        map(() => true),
        catchError(() => of(false))
      )
      .subscribe((status) => this._connected.set(status));

    this.formGroup.setValue({
      token: this.memosState.state.token(),
      apiUrl: this.memosState.state.apiUrl(),
      storeCredentials: !!this.memosState.state.token(),
      omdbApiKey: this.omdbState.state.apiKey(),
      appMode: this.appState.state.appMode() || 'basic',
      fetchBatchSize: this.memosState.state.fetchBatchSize() || 10000,
      theme: this.themeState.state.theme(),
      settingsLock: this.appState.state.settingsLock(),
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
