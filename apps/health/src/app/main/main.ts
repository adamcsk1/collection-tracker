import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { LinkButton } from '@components/link-button/link-button';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { HealthApiResponseModel, HealthDiagnosticsApiResponseModel } from '@shared/models/api-model';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-root',
  imports: [DatePipe, LinkButton],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly api = inject(SharedApiService);
  private readonly publicApi = inject(PublicApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly webstorage = inject(WebstorageService);

  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    subTitle: computed(() => this.ngxSignalTranslate.translate('SubTitle')),
    navigateToLogin: computed(() => this.ngxSignalTranslate.translate('NavigateToLogin')),
    loading: computed(() => this.ngxSignalTranslate.translate('Loading')),
    loadedAt: computed(() => this.ngxSignalTranslate.translate('LoadedAt')),
    memory: computed(() => this.ngxSignalTranslate.translate('Memory')),
    cpu: computed(() => this.ngxSignalTranslate.translate('Cpu')),
    disk: computed(() => this.ngxSignalTranslate.translate('Disk')),
    loadAverage: computed(() => this.ngxSignalTranslate.translate('LoadAverage')),
    load1min: computed(() => this.ngxSignalTranslate.translate('Load.1min')),
    load5min: computed(() => this.ngxSignalTranslate.translate('Load.5min')),
    load15min: computed(() => this.ngxSignalTranslate.translate('Load.15min')),
    frontend: computed(() => this.ngxSignalTranslate.translate('Frontend')),
    ai: computed(() => this.ngxSignalTranslate.translate('Ai')),
    diagnosticsError: computed(() => this.ngxSignalTranslate.translate('Message.HealthDiagnosticsError')),
    diagnosticsUnauthorized: computed(() => this.ngxSignalTranslate.translate('Message.HealthDiagnosticsUnauthorized')),
    retry: computed(() => this.ngxSignalTranslate.translate('Retry')),
    severity: computed(() => this.ngxSignalTranslate.translate('Severity')),
    statusDown: computed(() => this.ngxSignalTranslate.translate('Status.Down')),
    statusError: computed(() => this.ngxSignalTranslate.translate('Status.Error')),
    statusOk: computed(() => this.ngxSignalTranslate.translate('Status.Ok')),
    statusUp: computed(() => this.ngxSignalTranslate.translate('Status.Up')),
    statusWarn: computed(() => this.ngxSignalTranslate.translate('Status.Warn')),
  };
  protected readonly diagnostics = signal<HealthDiagnosticsApiResponseModel | null>(null);
  protected readonly publicStatus = signal<HealthApiResponseModel['status'] | null>(null);
  protected readonly status = computed(() => this.diagnostics()?.status ?? this.publicStatus());
  protected readonly loading = signal(true);
  protected readonly loadError = signal<'unauthorized' | 'error' | null>(null);
  protected readonly loadedAt = signal<Date | null>(null);
  protected readonly basePath = getBasePath();

  constructor() {
    this.ngxSignalTranslate.setLanguage('en');

    let apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    if (!apiUrl) apiUrl = `${window.location.origin}${getApiPrefix()}`;

    this.apiState.setState('apiUrl', apiUrl);
  }

  public ngOnInit(): void {
    this.loadDiagnostics();
  }

  protected loadDiagnostics(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.diagnostics.set(null);
    this.publicStatus.set(null);
    this.api.getHealthDiagnostics().subscribe({
      next: (data) => {
        this.diagnostics.set(data);
        this.loadedAt.set(new Date());
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.loadError.set('unauthorized');
          this.loadPublicStatus();
          return;
        }

        this.loadError.set('error');
        this.loading.set(false);
      },
    });
  }

  protected barLevel(percent: number): 'ok' | 'warn' | 'error' {
    if (percent > 95) return 'error';
    if (percent > 80) return 'warn';
    return 'ok';
  }

  protected statusLabel(status: 'ok' | 'warn' | 'error' | 'up' | 'down'): string {
    switch (status) {
      case 'ok':
        return this.translations.statusOk();
      case 'warn':
        return this.translations.statusWarn();
      case 'error':
        return this.translations.statusError();
      case 'up':
        return this.translations.statusUp();
      case 'down':
        return this.translations.statusDown();
    }
  }

  private loadPublicStatus(): void {
    this.publicApi.getHealth({ suppressErrorAlert: true }).subscribe({
      next: (data) => {
        this.publicStatus.set(data.status);
        this.loadedAt.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
