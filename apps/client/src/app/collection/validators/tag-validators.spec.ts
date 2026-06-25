import { filterDisplayTags, filterEditableTags } from './tag-validators';

const formerSystemTags = [
  '#completed',
  '#favorite',
  '#watch-later',
  '#wishlist',
  '#movie',
  '#series',
  '#unwatched',
  '#uncompleted',
];

describe('tag validators', () => {
  it('returns all editable and display tags', () => {
    expect(filterEditableTags(formerSystemTags)).toEqual(formerSystemTags);
    expect(filterDisplayTags(formerSystemTags)).toEqual(formerSystemTags);
  });
});
