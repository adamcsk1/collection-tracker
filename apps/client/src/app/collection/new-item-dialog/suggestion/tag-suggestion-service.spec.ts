import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagSuggestionService } from './tag-suggestion-service';

describe('TagSuggestionService', () => {
  let service: TagSuggestionService;
  let api: { getTagSuggestions: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { getTagSuggestions: vi.fn(() => of({ tags: ['#scifi', '#space', '#scary'] })) };

    TestBed.configureTestingModule({
      providers: [TagSuggestionService, { provide: ApiService, useValue: api }],
    });

    service = TestBed.inject(TagSuggestionService);
  });

  it('requests server tag suggestions and replaces the last token', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion('find #sc'));

    expect(api.getTagSuggestions).toHaveBeenCalledWith('#sc', 3);
    expect(suggestions).toEqual(['find #scifi', 'find #space', 'find #scary']);
  });

  it('filters out already-entered tags', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion('#space #s'));

    expect(suggestions).not.toContain('#space #space');
  });

  it('returns empty list when no tags are provided', async () => {
    const suggestions = await firstValueFrom(service.getSuggestion(''));

    expect(suggestions).toEqual([]);
  });

  it('formats suggestion by taking the last token', () => {
    expect(service.formatSuggestionText('alpha beta gamma')).toBe('gamma');
  });
});
