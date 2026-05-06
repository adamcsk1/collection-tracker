import { DatePipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { LinkButton } from '@components/link-button/link-button';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { API_PREFIX } from '@shared/constants/api-const';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { HealthApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'he-root',
  imports: [UpperCasePipe, DatePipe, NgxSignalTranslatePipe, LinkButton],
  templateUrl: './main.html',
  styleUrl: './main.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Main implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly webstorage = inject(WebstorageService);
  private readonly translate = inject(NgxSignalTranslateService);

  protected readonly health = signal<HealthApiResponseModel | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadedAt = signal<Date | null>(null);

  constructor() {
    this.translate.setLanguage('en');

    let apiUrl = this.webstorage.getItem(STORAGE_API_URL);
    if (!apiUrl) apiUrl = `${window.location.origin}${API_PREFIX}`;

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
