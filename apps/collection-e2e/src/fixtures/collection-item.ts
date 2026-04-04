export type ItemType = 'movie' | 'series';

export interface CollectionItemFixture {
  name: string;
  content: string;
  hash: string;
}

export const buildCollectionItemContent = (title: string, type: ItemType = 'movie'): string => {
  const imdbId = 'tt1234567';
  const encodedTitle = encodeURIComponent(title);
  return `### ${title}
[IMDb (${imdbId})](https://www.imdb.com/title/${imdbId}/) (**8.5** / 10)
A great ${type} for e2e testing.
![poster|90](https://placehold.co/90x133)

**Year**
2020
**Director**
Test Director
**Genre**
Action, Adventure
**Actors**
Actor One, Actor Two
**Trailer**
[YouTube](https://www.youtube.com/results?search_query=${encodedTitle})
**Web**
[DuckDuckGo](https://duckduckgo.com/?q=${encodedTitle})
**Tags**
#${type}
`;
};

export const buildCollectionItem = (title: string, type: ItemType = 'movie'): CollectionItemFixture => ({
  name: `${title.toLowerCase().replace(/\s+/g, '-')}.md`,
  content: buildCollectionItemContent(title, type),
  hash: `hash-${Math.random().toString(36).slice(2)}`,
});

export const buildCollectionItems = (titles: string[], type: ItemType = 'movie'): CollectionItemFixture[] =>
  titles.map((title) => buildCollectionItem(title, type));
