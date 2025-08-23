import { PercentPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { mainStateToken } from '@client/main/main-store';
import { ImageRefreshService } from '@client/settings/image-refresh/image-refresh-service';
import { SettingsAccessTokenItem } from '@client/settings/settings-access-token-item/settings-access-token-item';
import { SettingsModel } from '@client/settings/settings-model';
import { SettingsService } from '@client/settings/settings-service';
import { SettingsTokenDialog } from '@client/settings/settings-token-dialog/settings-token-dialog';
import { Details } from '@components/details/details';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { toastStateToken } from '@components/toast/toast-store';
import { AlertService } from '@services/alert-service';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { PortalService } from '@services/portal-service';
import { themeStateToken } from '@services/theme/theme-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { AccessTokensApiResponseModel } from '@shared/models/api-model';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { delay, filter, mergeMap, tap } from 'rxjs';

@Component({
  selector: 'ct-settings',
  imports: [Input, Select, ReactiveFormsModule, NgxSignalTranslatePipe, PercentPipe, SettingsAccessTokenItem, Details],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  providers: [OMDbService, ImageRefreshService],
  host: {
    class: 'page',
  },
})
export class Settings implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly settings = inject(SettingsService);
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly omdbState = inject(omdbStateToken);
  private readonly themeState = inject(themeStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly imageRefresh = inject(ImageRefreshService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly portal = inject(PortalService);
  private readonly toastState = inject(toastStateToken);
  private readonly api = inject(ApiService);
  protected readonly formGroup = new FormGroup<Form<SettingsModel>>({
    sensitiveDataStorage: new FormControl('local', { nonNullable: true, validators: [Validators.required] }),
    clearLocalStorageAfterLogout: new FormControl('false', { nonNullable: true, validators: [Validators.required] }),
    omdbApiKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    appMode: new FormControl('basic', { nonNullable: true, validators: [Validators.required] }),
    fetchBatchSize: new FormControl(10000, { nonNullable: true, validators: [Validators.required] }),
    theme: new FormControl('system', { nonNullable: true, validators: [Validators.required] }),
    settingsLock: new FormControl(false, { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
  protected readonly imageRefreshStatus = this.imageRefresh.state;
  protected readonly accessTokens = signal<AccessTokensApiResponseModel>([]);

  public ngOnInit(): void {
    this.formGroup.setValue({
      sensitiveDataStorage: this.mainState.state.sensitiveDataStorage(),
      omdbApiKey: this.omdbState.state.apiKey(),
      appMode: this.mainState.state.appMode(),
      fetchBatchSize: this.apiState.state.fetchBatchSize(),
      theme: this.themeState.state.theme(),
      settingsLock: this.mainState.state.settingsLock(),
      clearLocalStorageAfterLogout: this.mainState.state.clearLocalStorageAfterLogout() ? 'true' : 'false',
    });

    this.loadAccessTokens();
  }

  protected onSave(navigateBack = false): void {
    this.settings.storeFormData(this.formGroup.getRawValue(), navigateBack);
  }

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }

  protected onRevokeAccessToken(tokenHash: string): void {
    this.api
      .deleteAccessToken(tokenHash)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AccessTokenRevoked'));
        this.loadAccessTokens();
      });
  }

  protected onCreateAccessToken(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.CreateNewAccessToken'))
      .pipe(
        filter((confirm) => confirm === true),
        mergeMap(() => this.api.createAccessToken()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.AccessTokenCreated'));
        this.portal.open(SettingsTokenDialog, {
          title: this.ngxSignalTranslate.translate('Title.NewAccessToken'),
          message: this.ngxSignalTranslate.translate('Message.AccessTokenCreated'),
          token: response.accessToken,
        });
        this.loadAccessTokens();
      });
  }

  protected onCreateNewUserToken(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.CreateNewUserToken'))
      .pipe(
        filter((confirm) => confirm === true),
        mergeMap(() => this.api.createNewUserToken()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.NewUserTokenCreated'));
        this.portal.open(SettingsTokenDialog, {
          title: this.ngxSignalTranslate.translate('Title.NewUserToken'),
          message: this.ngxSignalTranslate.translate('Message.NewUserTokenCreated'),
          token: response.newToken,
        });
        this.loadAccessTokens();
      });
  }

  protected onDeleteUser(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.DeleteUser'))
      .pipe(
        filter((confirm) => confirm === true),
        mergeMap(() => this.api.deleteUser()),
        tap(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.UserDeleted'));
          this.webstorage.clear();
        }),
        delay(2000),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => (window.location.href = '/login/'));
  }

  private loadAccessTokens(): void {
    this.api
      .getAccessTokens()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.accessTokens.set(response));
  }
}
