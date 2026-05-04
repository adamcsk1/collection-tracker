import { parseGenreText, parseTagText } from './collection-item-text-util';

describe('parseGenreText', () => {
  it('splits comma-separated genre text and removes blank values', () => {
    expect(parseGenreText('Drama, Action, , Comedy')).toEqual(['Drama', 'Action', 'Comedy']);
  });
});

describe('parseTagText', () => {
  it('splits whitespace-separated tag text and removes blank values', () => {
    expect(parseTagText(' #owned  #watched\n#favorite ')).toEqual(['#owned', '#watched', '#favorite']);
  });
});
