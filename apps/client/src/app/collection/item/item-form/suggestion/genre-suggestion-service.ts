import { inject, Injectable } from '@angular/core';
import { AutocompleteServiceInterface } from '@components/autocomplete/autocomplete-model';
import { ApiService } from '@services/api/api-service';
import { map, Observable, of } from 'rxjs';

@Injectable()
export class GenreSuggestionService implements AutocompleteServiceInterface {
  private readonly api = inject(ApiService);

  public getSuggestion(text: string, limit = 3): Observable<string[]> {
    const genres = text.split(',').map((genre) => genre.trim());
    if (!genres.length) return of([]);

    const lastGenre = genres.at(-1) || '';
    return this.api
      .getGenreSuggestions(lastGenre, limit + genres.length)
      .pipe(map((response) => this.formatResult(response.genres, genres, limit)));
  }

  public formatSuggestionText(text: string): string {
    return text.split(',').at(-1)?.trim() || '';
  }

  private formatResult(matchedItems: string[], genres: string[], limit: number): string[] {
    return matchedItems
      .filter((genre) => !genres.includes(genre))
      .slice(0, limit)
      .map((genre) => {
        genres[genres.length - 1] = genre;
        return genres.join(', ');
      });
  }
}
