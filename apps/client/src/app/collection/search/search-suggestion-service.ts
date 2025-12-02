import { inject, Injectable } from '@angular/core';
import { mainCollectionStateToken } from '@client/main/main-collection-store';

@Injectable()
export class SearchSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);

  public getSuggestion(text: string): Array<string> {
    const lowerCasedText = text.toLowerCase();

    if (lowerCasedText.startsWith('#')) {
      const tagsWithDuplicates = this.appCollectionState.state
        .collection()
        .map((item) => item.tags.filter((tag) => tag.toLowerCase().startsWith(lowerCasedText)))
        .flat()
        .sort();

      const uniqueTags = new Set(tagsWithDuplicates);
      return Array.from(uniqueTags).slice(0, 3);
    } else {
      const genresWithDuplicates = this.appCollectionState.state
        .collection()
        .map((item) => item.genre.filter((genre) => genre.toLowerCase().startsWith(lowerCasedText)))
        .flat();

      const uniqueGenres = new Set(genresWithDuplicates);

      if (uniqueGenres.size > 0) return Array.from(uniqueGenres).slice(0, 3);

      const matchedRawContents = this.appCollectionState.state
        .collection()
        .filter((item) => item.rawContent.toLowerCase().includes(lowerCasedText))
        .sort()
        .slice(0, 3);

      return matchedRawContents.map((item) => item.title);
    }
  }
}
