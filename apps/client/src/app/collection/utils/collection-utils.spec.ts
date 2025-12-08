import { getCollectionItem } from './get-collection-item-util';

describe('collection utils', () => {
  it('builds a collection item from markdown content', () => {
    const markdownContent = [
      '### My Movie',
      '[poster|90](https://image.example/poster.jpg)',
      '**Genre**',
      'Action, Comedy',
      '**Actors**',
      'Actor One, Actor Two',
      '**Year**',
      '2021',
      '**Tags**',
      'tag-one tag-two',
      '[IMDb (tt1234567)](https://imdb.example/title/tt1234567) (**8.7** / 10)',
    ].join('\n');

    const item = getCollectionItem({ content: markdownContent, name: 'My Movie' });

    expect(item.rawContent).toBe(markdownContent);
    expect(item.image).toBe('https://image.example/poster.jpg');
    expect(item.title).toBe('My Movie');
    expect(item.genre).toEqual(['Action', 'Comedy']);
    expect(item.tags).toEqual(['tag-one', 'tag-two']);
    expect(item.IMDbId).toBe('tt1234567');
    expect(item.year).toBe(2021);
    expect(item.rate).toBe('8.7');
    expect(item.name).toBe('My Movie');
  });

  it('returns empty values when content and name are missing', () => {
    const item = getCollectionItem({});

    expect(item.rawContent).toBe('');
    expect(item.image).toBe('');
    expect(item.title).toBe('');
    expect(item.genre).toEqual([]);
    expect(item.tags).toEqual([]);
    expect(item.IMDbId).toBe('');
    expect(item.year).toBeNull();
    expect(item.rate).toBe('');
    expect(item.name).toBe('');
  });
});
