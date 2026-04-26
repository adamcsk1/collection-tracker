import { getParserRegexp, setParserRegexp } from '../parser-util';
import { PARSER_REGEXPS } from '../../constants/parser-const';
import { beforeAll, describe, expect, it } from 'vitest';
import { getImage } from './get-image-util';

const markdownContent = [
  '### My Movie',
  '[poster|90](https://image.example/poster.jpg)',
  '**Genre**',
  'Action, Comedy',
  '**Actors**',
  'Actor One, Actor Two',
].join('\n');

describe('getImage', () => {
  beforeAll(() => {
    setParserRegexp('image', getParserRegexp('image') ?? PARSER_REGEXPS.image);
  });

  it('extracts the poster url when present', () => {
    expect(getImage(markdownContent)).toBe('https://image.example/poster.jpg');
  });

  it('returns an empty string when the poster block is missing', () => {
    expect(getImage('no poster here')).toBe('');
  });
});
