import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataResults } from './metadata-results';
import { MetadataResultOptionModel } from './metadata-results-model';

describe('MetadataResults', () => {
  let fixture: ComponentFixture<MetadataResults>;
  const options: MetadataResultOptionModel[] = [
    { text: 'The Matrix', value: 'omdb/tt123', contentType: 'movie', year: '1999' },
    { text: 'Duplicate', value: 'omdb/tt456', disabled: true, hint: 'Already selected in this batch' },
  ];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MetadataResults],
      providers: [provideStore(initialApiState, apiStateToken)],
    });
    fixture = TestBed.createComponent(MetadataResults);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('label', 'Selected content');
    fixture.componentRef.setInput('testIdPrefix', 'result');
    await fixture.whenStable();
  });

  it('renders existing poster cards without auto-selecting and emits an explicit choice', async () => {
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    const element: HTMLElement = fixture.nativeElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>('[data-test-id="result-option"]');
    expect(element.querySelectorAll('ct-list-item-card')).toHaveLength(2);
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(selected).not.toHaveBeenCalled();
    buttons[0]!.click();
    expect(selected).toHaveBeenCalledWith(options[0]);
    fixture.componentRef.setInput('selectedValue', 'omdb/tt123');
    await fixture.whenStable();
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0]!.classList.contains('selected')).toBe(true);
    expect(buttons[1]!.disabled).toBe(true);
    expect(buttons[1]!.textContent).toContain('Already selected in this batch');
    buttons[1]!.click();
    fixture.componentInstance['onSelect'](options[1]!);
    expect(selected).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(buttons[0]!.disabled).toBe(true);
    fixture.componentInstance['onSelect'](options[0]!);
    expect(selected).toHaveBeenCalledOnce();
  });

  it('preserves metadata formatting and proxy images, including missing and direct-identity results', () => {
    const component = fixture.componentInstance;
    TestBed.inject(apiStateToken).setState('apiUrl', '/api/v1');
    expect(component['imageUrl']({ text: 'No image', value: 'none' })).toBe('');
    expect(component['imageUrl']({ ...options[0]!, poster: 'https://images.example/poster.jpg' })).toBe(
      '/api/v1/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.jpg&variant=card'
    );
    expect(component['meta'](options[0]!)).toBe('(movie) 1999');
    expect(component['meta']({ text: 'Movie', value: 'movie', contentType: 'movie' })).toBe('(movie)');
    expect(component['meta']({ text: 'Year', value: 'year', year: '2026' })).toBe('2026');
    expect(
      component['meta']({ text: 'Album', value: 'album', contentType: 'album', year: '1973', actors: 'Pink Floyd' })
    ).toBe('(album) 1973 · Pink Floyd');
    expect(component['meta']({ text: 'IMDb id: tt123', value: 'omdb/tt123' })).toBeNull();
  });

  it('renders the required indicator only for the normal Add selector', async () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.content-selector-label [aria-hidden="true"]')).toBeNull();
    fixture.componentRef.setInput('mandatory', true);
    await fixture.whenStable();
    expect(element.querySelector('.content-selector-label [aria-hidden="true"]')?.textContent).toBe('*');
  });
});
