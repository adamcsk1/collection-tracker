import { MD_TEMPLATE } from '../../constants/parser-const';
import { generateMdContent } from './generate-md-content-util';
import { describe, expect, it } from 'vitest';

describe('generateMdContent', () => {
  it('builds markdown content with substituted fields and encoded queries', () => {
    const content = generateMdContent(MD_TEMPLATE, {
      Title: 'Test Title',
      imdbID: 'tt999',
      imdbRating: '8.1',
      Plot: 'Plot here',
      Poster: 'poster-url',
      Year: '2023',
      Director: 'A Director',
      Genre: 'Drama',
      Actors: 'An Actor',
      Type: 'movie',
      Tags: '#tag',
    });

    expect(content).toContain('### Test Title');
    expect(content).toContain('[IMDb (tt999)](https://www.imdb.com/title/tt999/) (**8.1** / 10)');
    expect(content).toContain('Plot here');
    expect(content).toContain('![poster|90](poster-url)');
    expect(content).toContain(encodeURIComponent('Test Title 2023 trailer'));
    expect(content).toContain(encodeURIComponent('Test Title 2023'));
    expect(content).toContain('#movie #tag');
  });
});
