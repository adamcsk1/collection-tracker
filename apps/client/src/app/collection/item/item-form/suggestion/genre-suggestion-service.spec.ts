import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenreSuggestionService } from './genre-suggestion-service';

describe('GenreSuggestionService', () => {
  let service: GenreSuggestionService;
  let api: { getGenreSuggestions: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { getGenreSuggestions: vi.fn(() => of({ genres: ['Action', 'Adventure', 'Animation'] })) };

    TestBed.configureTestingModule({
      providers: [GenreSuggestionService, { provide: ApiService, useValue: api }],
    });

    service = TestBed.inject(GenreSuggestionService);
  });

  it('requests server genre suggestions and replaces the last token', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion('Drama, Act'));

    expect(api.getGenreSuggestions).toHaveBeenCalledWith('Act', 3);
    expect(suggestions).toEqual(['Drama, Action', 'Drama, Adventure', 'Drama, Animation']);
  });

  it('filters out already-entered genres', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion('Action, Adv'));

    expect(suggestions).toEqual(['Action, Adventure', 'Action, Animation']);
    expect(suggestions).not.toContain('Action, Action');
  });

  it('calls API with empty string when input is empty', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion(''));

    expect(api.getGenreSuggestions).toHaveBeenCalledWith('', 3);
    expect(suggestions).toEqual(['Action', 'Adventure', 'Animation']);
  });

  it('respects the limit parameter', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion('Sci-Fi', 1));

    expect(api.getGenreSuggestions).toHaveBeenCalledWith('Sci-Fi', 1);
    expect(suggestions).toHaveLength(1);
  });

  it('formats suggestion text by taking the last token', () => {
    expect(service.formatSuggestionText('Drama, Comedy, Act')).toBe('Act');
    expect(service.formatSuggestionText('Drama')).toBe('Drama');
    expect(service.formatSuggestionText('')).toBe('');
  });

  it('handles trailing comma and whitespace', async () => {
    await firstValueFrom(service.getSuggestion('Drama, '));

    expect(api.getGenreSuggestions).toHaveBeenCalledWith('', 3);
  });
});
