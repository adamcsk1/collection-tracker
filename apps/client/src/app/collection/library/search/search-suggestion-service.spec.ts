import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchSuggestionService, searchSuggestionListTypeToken } from './search-suggestion-service';

describe('SearchSuggestionService', () => {
  let service: SearchSuggestionService;
  let api: { getItemSearchSuggestions: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getItemSearchSuggestions: vi.fn(() =>
        of({
          suggestions: [
            { label: 'Gravity', value: 'tt1234567', kind: 'title' },
            { label: '#space', value: '#space', kind: 'tag' },
          ],
        })
      ),
    };

    TestBed.configureTestingModule({
      providers: [SearchSuggestionService, { provide: ApiService, useValue: api }],
    });

    service = TestBed.inject(SearchSuggestionService);
  });

  it('returns server suggestions with formatted title values', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion('gra'));

    expect(api.getItemSearchSuggestions).toHaveBeenCalledWith('gra', 3, 'library');
    expect(service.formatSuggestionText(suggestions[0])).toBe('Gravity');
    expect(service.formatSuggestionValue(suggestions[0])).toBe('tt1234567');
    expect(suggestions[1]).toBe('#space');
  });

  it('requests suggestions for the configured list type', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SearchSuggestionService,
        { provide: ApiService, useValue: api },
        { provide: searchSuggestionListTypeToken, useValue: 'watchlist' },
      ],
    });
    service = TestBed.inject(SearchSuggestionService);

    await firstValueFrom(service.getSuggestion('mat'));

    expect(api.getItemSearchSuggestions).toHaveBeenCalledWith('mat', 3, 'watchlist');
  });

  it('keeps raw suggestion values when no separator is present', () => {
    expect(service.formatSuggestionText('#space')).toBe('#space');
    expect(service.formatSuggestionValue('#space')).toBe('#space');
  });
});
