import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it } from 'vitest';
import { StatisticsDialog } from './statistics-dialog';

describe('StatisticsDialog', () => {
  it('exposes the translated statistics title', () => {
    TestBed.configureTestingModule({
      imports: [StatisticsDialog],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    TestBed.overrideComponent(StatisticsDialog, { set: { template: '' } });

    const fixture: ComponentFixture<StatisticsDialog> = TestBed.createComponent(StatisticsDialog);

    expect(fixture.componentInstance['translations'].statistics()).toBe('Statistics');
  });
});
