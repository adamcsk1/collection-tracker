import { TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateService } from './translate-service';

describe('TranslateService', () => {
  let service: TranslateService;
  let translateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    translateSpy = vi.fn((value: string) => `t:${value}`);

    TestBed.configureTestingModule({
      providers: [TranslateService, { provide: NgxSignalTranslateService, useValue: { translate: translateSpy } }],
    });

    service = TestBed.inject(TranslateService);
  });

  it('returns translated language options', () => {
    expect(service.languageOptions()).toEqual([{ text: 't:English', value: 'en' }]);
    expect(translateSpy).toHaveBeenCalledWith('English');
  });
});
