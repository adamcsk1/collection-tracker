import { describe, expect, it } from 'vitest';
import { getOpenSeasons } from './get-open-seasons-util';

function buildCompletedSet(completedEpisodes: { season: number; episode: number }[]): Set<string> {
  const set = new Set<string>();
  for (const episode of completedEpisodes) {
    set.add(`${episode.season}-${episode.episode}`);
  }
  return set;
}

describe('getOpenSeasons', () => {
  it('opens season 1 by default when nothing is completed', () => {
    const seasons = [
      { season: 1, episodes: 3, titles: [] as string[] },
      { season: 2, episodes: 3, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([1]));
  });

  it('opens only in-progress seasons when any season is partially completed', () => {
    const seasons = [
      { season: 1, episodes: 3, titles: [] as string[] },
      { season: 2, episodes: 3, titles: [] as string[] },
      { season: 3, episodes: 3, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
      { season: 2, episode: 1 },
    ]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([2]));
  });

  it('opens next season after fully completed season when no season is in progress', () => {
    const seasons = [
      { season: 1, episodes: 2, titles: [] as string[] },
      { season: 2, episodes: 2, titles: [] as string[] },
      { season: 3, episodes: 2, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([2]));
  });

  it('keeps all seasons closed when every season is fully completed', () => {
    const seasons = [
      { season: 1, episodes: 2, titles: [] as string[] },
      { season: 2, episodes: 2, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 2, episode: 1 },
      { season: 2, episode: 2 },
    ]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set());
  });

  it('opens multiple seasons when more than one is in progress', () => {
    const seasons = [
      { season: 1, episodes: 3, titles: [] as string[] },
      { season: 2, episodes: 3, titles: [] as string[] },
      { season: 3, episodes: 3, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([
      { season: 1, episode: 1 },
      { season: 2, episode: 1 },
    ]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([1, 2]));
  });

  it('returns empty set when seasons array is empty', () => {
    expect(getOpenSeasons([], new Set())).toEqual(new Set());
  });

  it('opens the first actual season when nothing is completed and seasons do not start at 1', () => {
    const seasons = [
      { season: 2, episodes: 3, titles: [] as string[] },
      { season: 3, episodes: 3, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([2]));
  });

  it('opens the next existing season after fully completed when seasons are non-contiguous', () => {
    const seasons = [
      { season: 1, episodes: 2, titles: [] as string[] },
      { season: 3, episodes: 2, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([3]));
  });

  it('opens the earliest incomplete season when later seasons are fully completed', () => {
    const seasons = [
      { season: 1, episodes: 2, titles: [] as string[] },
      { season: 2, episodes: 2, titles: [] as string[] },
      { season: 3, episodes: 2, titles: [] as string[] },
    ];
    const completedSet = buildCompletedSet([
      { season: 2, episode: 1 },
      { season: 2, episode: 2 },
    ]);

    expect(getOpenSeasons(seasons, completedSet)).toEqual(new Set([1]));
  });
});
