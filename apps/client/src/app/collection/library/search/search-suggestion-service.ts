import { inject, Injectable } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { map, Observable } from 'rxjs';

const SEPARATOR = ' ### ';

@Injectable()
export class SearchSuggestionService {
  private readonly api = inject(ApiService);

  public getSuggestion(text: string, limit = 3): Observable<string[]> {
    return this.api
      .getItemSearchSuggestions(text, limit)
      .pipe(
        map((response) =>
          response.suggestions.map((suggestion) =>
            suggestion.kind === 'title' ? `${suggestion.label}${SEPARATOR}${suggestion.value}` : suggestion.value
          )
        )
      );
  }

  public formatSuggestionText(text: string): string {
    return text.split(SEPARATOR)[0];
  }

  public formatSuggestionValue(text: string): string {
    return text.includes(SEPARATOR) ? text.split(SEPARATOR)[1] : text;
  }
}
