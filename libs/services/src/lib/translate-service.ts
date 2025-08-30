import { computed, inject, Injectable } from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable({
  providedIn: 'root',
})
export class TranslateService {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly languageOptions = computed(() => [
    { text: this.ngxSignalTranslate.translate('English'), value: 'en' },
  ]);
}
