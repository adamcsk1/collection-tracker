import { inject, Injectable } from '@angular/core';
import { AutocompleteServiceInterface } from '@components/autocomplete/autocomplete-model';
import { ApiService } from '@services/api/api-service';
import { map, Observable, of } from 'rxjs';

@Injectable()
export class TagSuggestionService implements AutocompleteServiceInterface {
  private readonly api = inject(ApiService);

  public getSuggestion(text: string, limit = 3): Observable<string[]> {
    const tags = text.split(' ').map((tag) => tag.trim());
    if (!tags.length) return of([]);

    const lastTag = tags.at(-1) || '';
    if (!lastTag) return of([]);
    return this.api
      .getTagSuggestions(lastTag, limit)
      .pipe(map((response) => this.formatResult(response.tags, tags, limit)));
  }

  public formatSuggestionText(text: string): string {
    return text.split(' ').at(-1) || '';
  }

  private formatResult(matchedItems: string[], tags: string[], limit: number): string[] {
    return matchedItems
      .filter((tag) => !tags.includes(tag))
      .slice(0, limit)
      .map((tag) => {
        tags[tags.length - 1] = tag;
        return tags.join(' ');
      });
  }
}
