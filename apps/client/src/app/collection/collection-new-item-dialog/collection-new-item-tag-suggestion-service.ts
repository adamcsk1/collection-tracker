import { inject, Injectable } from '@angular/core';
import { mainCollectionStateToken } from '@client/main/main-collection-store';

@Injectable()
export class CollectionNewItemTagSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);

  public getSuggestion(text: string): Array<string> {
    const tags = text.split(' ').map((tag) => tag.trim());
    if (!tags.length) return [];

    const typeTag = tags.at(-1) || '';

    const tagsWithDuplicates = this.appCollectionState.state
      .collection()
      .map((item) =>
        item.tags.filter((tag) => !['#movie', '#series'].includes(tag) && tag.includes(typeTag) && !tags.includes(tag))
      )
      .flat()
      .sort();

    const uniqueTags = new Set(tagsWithDuplicates);

    return Array.from(uniqueTags)
      .slice(0, 3)
      .map((tag) => {
        tags[tags.length - 1] = tag;
        return tags.join(' ');
      });
  }

  public formatSuggestionText(text: string): string {
    return text.split(' ').at(-1) || '';
  }
}
