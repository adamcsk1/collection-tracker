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
        year: 2020,
        rate: '9.0',
        userRate: 8.7,
        hash: 'hash',
        actors: 'Actors',
        plot: 'Plot',
      })
    ).toEqual({
      image: 'poster-url',
      title: 'Title',
      genre: ['Drama'],
      IMDbId: 'tt123',
      tags: ['#owned'],
      year: 2020,
      rate: '9.0',
      userRate: 8.7,
      actors: 'Actors',
      plot: 'Plot',
    });
  });
});
