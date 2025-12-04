import { TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { TranslateService } from './translate-service';

describe('TranslateService', () => {
  let service: TranslateService;
  let translateSpy: jest.Mock;

  beforeEach(() => {
    translateSpy = jest.fn((value: string) => `t:${value}`);

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
