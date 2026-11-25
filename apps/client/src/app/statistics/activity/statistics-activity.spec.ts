import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import type { CollectionItemFiltersApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { statisticsStateToken, initialStatisticsState } from '../statistics-store';
import { StatisticsItems } from '../items/statistics-items';
import { StatisticsActivity } from './statistics-activity';

@Component({ selector: 'ct-statistics-items', template: '' })
class ItemsStub {
  public readonly filters = input<CollectionItemFiltersApiModel>();
  public readonly title = input('');
  public readonly changed = output<void>();
}
const response = {
  year: 2026,
  planned: 2,
  completed: 1,
  inProgress: 1,
  months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: index === 1 ? 1 : 0 })),
};
describe('StatisticsActivity', () => {
  const create = (getCollectionActivity = vi.fn(() => of(response))) => {
    TestBed.configureTestingModule({
      imports: [StatisticsActivity],
      providers: [
        provideStore({ ...initialStatisticsState, year: 2026 }, statisticsStateToken),
        { provide: ApiService, useValue: { getCollectionActivity } },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(StatisticsActivity, {
      remove: { imports: [StatisticsItems] },
      add: { imports: [ItemsStub] },
    });
    return TestBed.createComponent(StatisticsActivity);
  };
  it('loads the selected year, drills into months and clears month for plans', async () => {
    const api = vi.fn(() => of(response));
    const fixture = create(api);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).classList.contains('statistics-section')).toBe(true);
    expect(api).toHaveBeenCalledWith(2026, undefined);
    fixture.componentInstance['selectMonth']('2');
    expect(fixture.componentInstance['filters']()).toMatchObject({
      activityYear: 2026,
      activityStatus: 'completed',
      activityMonth: 2,
    });
    fixture.componentInstance['select']('planned');
    expect(fixture.componentInstance['filters']().activityMonth).toBeUndefined();
    fixture.componentInstance['setYear']('2025');
    await fixture.whenStable();
    expect(api).toHaveBeenLastCalledWith(2025, undefined);
    fixture.componentInstance['setYear']('2025.5');
    expect(TestBed.inject(statisticsStateToken).state.year()).toBe(2025);
  });
  it.each(['', '2025.5', '999', '10000'])(
    'restores the selected year after native input %s loses focus',
    async (value) => {
      const api = vi.fn(() => of(response));
      const fixture = create(api);
      await fixture.whenStable();
      const yearInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        '[data-test-id="statistics-year"] input'
      )!;
      yearInput.value = value;
      yearInput.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(TestBed.inject(statisticsStateToken).state.year()).toBe(2026);
      expect(yearInput.value).toBe(value);
      yearInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await fixture.whenStable();
      expect(yearInput.value).toBe('2026');
      expect(api).toHaveBeenCalledTimes(1);
    }
  );
  it('keeps a valid native year input after focusout and loads that year', async () => {
    const api = vi.fn(() => of(response));
    const fixture = create(api);
    await fixture.whenStable();
    const yearInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-test-id="statistics-year"] input'
    )!;
    yearInput.value = '2025';
    yearInput.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(TestBed.inject(statisticsStateToken).state.year()).toBe(2025);
    expect(api).toHaveBeenLastCalledWith(2025, undefined);
    yearInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(yearInput.value).toBe('2025');
    expect(api).toHaveBeenCalledTimes(2);
  });
  it('restores an empty input before clicking This year when already selected', async () => {
    const api = vi.fn(() => of(response));
    const fixture = create(api);
    TestBed.inject(statisticsStateToken).setState('year', fixture.componentInstance['currentYear']);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const yearInput = element.querySelector<HTMLInputElement>('[data-test-id="statistics-year"] input')!;
    yearInput.value = '';
    yearInput.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(yearInput.value).toBe('');
    yearInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    element.querySelector<HTMLButtonElement>('[data-test-id="statistics-this-year"]')!.click();
    await fixture.whenStable();
    expect(yearInput.value).toBe(`${fixture.componentInstance['currentYear']}`);
    expect(TestBed.inject(statisticsStateToken).state.year()).toBe(fixture.componentInstance['currentYear']);
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('cancels stale requests when changing year or media type', async () => {
    const first = new Subject<typeof response>();
    const second = new Subject<typeof response>();
    const api = vi.fn().mockReturnValueOnce(first).mockReturnValue(second);
    const fixture = create(api);
    await fixture.whenStable();
    TestBed.inject(statisticsStateToken).setState('selectedScope', 'book');
    await fixture.whenStable();
    first.next(response);
    expect(fixture.componentInstance['store'].state.status()).toBe('pending');
    second.next({ ...response, planned: 3 });
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.data()?.planned).toBe(3);
    expect(api).toHaveBeenLastCalledWith(2026, 'book');
  });
  it('keeps errors distinct from empty results and retries', async () => {
    const api = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of(response));
    const fixture = create(api);
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.status()).toBe('error');
    fixture.componentInstance['refresh']();
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.status()).toBe('finished');
  });
});
