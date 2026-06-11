import { describe, expect, it } from 'vitest';
import { formatSeriesTrackerEpisode, isSeriesTrackerCompleted } from './series-tracker-progress-util';

describe('series tracker progress util', () => {
  it('formats a watched episode', () => {
    expect(formatSeriesTrackerEpisode({ season: 1, episode: 2 })).toBe('S01E02');
  });

  it('returns null when no watched episode exists', () => {
    expect(formatSeriesTrackerEpisode(null)).toBeNull();
  });

  it('detects completed series tracker progress', () => {
    expect(
      isSeriesTrackerCompleted(
        'series-tracker',
        [
          { season: 1, episodes: 2 },
          { season: 2, episodes: 1 },
        ],
        [
          { season: 1, episode: 1 },
          { season: 1, episode: 2 },
          { season: 2, episode: 1 },
        ]
      )
    ).toBe(true);
  });

  it('does not complete when the item is not a series tracker item', () => {
    expect(isSeriesTrackerCompleted('library', [{ season: 1, episodes: 1 }], [{ season: 1, episode: 1 }])).toBe(false);
  });

  it('does not complete when metadata is missing', () => {
    expect(isSeriesTrackerCompleted('series-tracker', [], [{ season: 1, episode: 1 }])).toBe(false);
  });

  it('does not complete when only some episodes are watched', () => {
    expect(isSeriesTrackerCompleted('series-tracker', [{ season: 1, episodes: 2 }], [{ season: 1, episode: 1 }])).toBe(
      false
    );
  });
});
