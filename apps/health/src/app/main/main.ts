import { DatePipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { LinkButton } from '@components/link-button/link-button';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { HealthApiResponseModel } from '@shared/models/api-model';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'he-root',
  imports: [UpperCasePipe, DatePipe, LinkButton],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly api = inject(PublicApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly webstorage = inject(WebstorageService);

  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    subTitle: computed(() => this.ngxSignalTranslate.translate('SubTitle')),
    navigateToLogin: computed(() => this.ngxSignalTranslate.translate('NavigateToLogin')),
    loading: computed(() => this.ngxSignalTranslate.translate('Loading')),
    memory: computed(() => this.ngxSignalTranslate.translate('Memory')),
    cpu: computed(() => this.ngxSignalTranslate.translate('Cpu')),
    disk: computed(() => this.ngxSignalTranslate.translate('Disk')),
    loadAverage: computed(() => this.ngxSignalTranslate.translate('LoadAverage')),
    load1min: computed(() => this.ngxSignalTranslate.translate('Load.1min')),
    load5min: computed(() => this.ngxSignalTranslate.translate('Load.5min')),
    load15min: computed(() => this.ngxSignalTranslate.translate('Load.15min')),
    frontend: computed(() => this.ngxSignalTranslate.translate('Frontend')),
    ai: computed(() => this.ngxSignalTranslate.translate('Ai')),
  };
  protected readonly health = signal<HealthApiResponseModel | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadedAt = signal<Date | null>(null);
  protected readonly basePath = getBasePath();

  constructor() {
    this.ngxSignalTranslate.setLanguage('en');

    let apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    if (!apiUrl) apiUrl = `${window.location.origin}${getApiPrefix()}`;

    this.apiState.setState('apiUrl', apiUrl);
  }

  public ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (data) => {
        this.health.set(data);
        this.loadedAt.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected barLevel(percent: number): 'ok' | 'warn' | 'error' {
    if (percent > 95) return 'error';
    if (percent > 80) return 'warn';
    return 'ok';
  }
}
