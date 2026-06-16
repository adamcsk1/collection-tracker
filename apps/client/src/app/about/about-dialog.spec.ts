import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it } from 'vitest';
import { AboutDialog } from './about-dialog';

describe('AboutDialog', () => {
  it('exposes the translated dialog title', () => {
    TestBed.configureTestingModule({
      imports: [AboutDialog],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    TestBed.overrideComponent(AboutDialog, { set: { template: '' } });

    const fixture: ComponentFixture<AboutDialog> = TestBed.createComponent(AboutDialog);

    expect(fixture.componentInstance['translations'].about()).toBe('About');
  });
});
