import { TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it, vi } from 'vitest';
import { StatisticsBars } from './statistics-bars';

describe('StatisticsBars', () => {
  const create = () => {
    TestBed.configureTestingModule({
      imports: [StatisticsBars],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } }],
    });
    const fixture = TestBed.createComponent(StatisticsBars);
    fixture.componentRef.setInput('title', 'Months');
    fixture.componentRef.setInput(
      'entries',
      Array.from({ length: 12 }, (_, index) => ({ label: `Month ${index + 1}`, value: `${index + 1}`, count: index }))
    );
    return fixture;
  };
  it('renders accessible counts, limits long lists and expands them on demand', async () => {
    const fixture = create();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll('li')).toHaveLength(10);
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.querySelector('li')?.textContent).toContain('Month 1');
    (host.querySelector('[data-test-id="statistics-bars-expand"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(host.querySelectorAll('li')).toHaveLength(12);
  });
  it('supports all twelve months, zero counts and keyboard-native selection buttons', async () => {
    const fixture = create();
    fixture.componentRef.setInput('interactive', true);
    fixture.componentRef.setInput('limit', 12);
    fixture.componentRef.setInput('selected', '2');
    const selected = vi.fn();
    fixture.componentInstance.selection.subscribe(selected);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll('li')).toHaveLength(12);
    const button = host.querySelector('[data-test-id="statistics-bar-2"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(selected).toHaveBeenCalledWith('2');
    expect(host.innerHTML).not.toContain('NaN');
  });
});
