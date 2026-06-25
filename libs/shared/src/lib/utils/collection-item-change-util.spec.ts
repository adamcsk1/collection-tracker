import { toCollectionItemChange } from './collection-item-change-util';

describe('toCollectionItemChange', () => {
  it('returns only fields accepted by item change requests', () => {
    expect(
      toCollectionItemChange({
        image: 'poster-url',
        title: 'Title',
        titleLower: 'title',
        genre: ['Drama'],
        IMDbId: 'tt123',
        tags: ['#owned'],
        year: '2020',
        rate: '9.0',
        rottenTomatoesRate: '96%',
        metacriticRate: '85/100',
        userRate: 8.7,
        hash: 'hash',
        actors: 'Actors',
        plot: 'Plot',
        listType: 'library',
        watchedAt: null,
      })
    ).toEqual({
      image: 'poster-url',
      title: 'Title',
      genre: ['Drama'],
      IMDbId: 'tt123',
      tags: ['#owned'],
      year: '2020',
      rate: '9.0',
      rottenTomatoesRate: '96%',
      metacriticRate: '85/100',
      userRate: 8.7,
      actors: 'Actors',
      plot: 'Plot',
    });
  });
});
