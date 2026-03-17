import { inject, Injectable } from '@angular/core';
import { searchCollection } from '@client/collection/utils/search-collection-util';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { affordableFuzzySearch, hasFuzzyMatch } from '@shared/utils/fuzzy-search-util';

@Injectable()
export class TagSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);

  public getSuggestion(text: string, limit = 3): string[] {
    const tags = text.split(' ').map((tag) => tag.trim());
    if (!tags.length) return [];

    const lastTag = tags.at(-1) || '';
    const matches = affordableFuzzySearch(lastTag)
      ? (tag: string) => hasFuzzyMatch(lastTag, tag, 1)
      : (tag: string) => tag.startsWith(lastTag);

    return this.search(tags, limit, matches);
  }

  public formatSuggestionText(text: string): string {
    return text.split(' ').at(-1) || '';
  }

  private search(tags: string[], limit: number, matches: (tag: string) => boolean): string[] {
    return this.formatResult(
      searchCollection(this.appCollectionState.state.collection(), limit, (item, results) => {
        const match = item.tags.find(
          (tag) => ![MOVIE_TAG, SERIES_TAG].includes(tag) && !tags.includes(tag) && matches(tag)
        );
        if (match) results.add(match);
      }),
      tags,
      limit
    );
  }

  private formatResult(matchedItems: Set<string>, tags: string[], limit: number): string[] {
    return Array.from(matchedItems)
      .slice(0, limit)
      .map((tag) => {
        tags[tags.length - 1] = tag;
        return tags.join(' ');
      });
  }
}
