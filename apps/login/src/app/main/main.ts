import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { API_PREFIX } from '@shared/constants/api-const';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'lo-root',
  imports: [RouterOutlet, NgxSignalTranslatePipe],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {
  private readonly signalTranslateService = inject(NgxSignalTranslateService);
  private readonly webstorage = inject(WebstorageService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);

  constructor() {
    this.signalTranslateService.setLanguage('en');

    let apiUrl = this.webstorage.getItem(STORAGE_API_URL);

    if (!apiUrl) {
      apiUrl = `${window.location.origin}${API_PREFIX}`;
      this.webstorage.setItem(STORAGE_API_URL, apiUrl);
    }
    this.apiState.setState('apiUrl', apiUrl);

    this.api.validateAccessToken().subscribe(() => (window.location.href = '/client/'));
  }
}
