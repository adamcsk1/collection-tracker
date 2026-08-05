import { describe, expect, it } from 'vitest';
import { formatTrackingEpisode, isTrackingCompleted } from './tracking-progress-util';

describe('series tracker progress util', () => {
  it('formats a watched episode', () => {
    expect(formatTrackingEpisode({ season: 1, episode: 2 })).toBe('S01E02');
  });

  it('returns null when no watched episode exists', () => {
    expect(formatTrackingEpisode(null)).toBeNull();
  });

  it('detects completed series tracker progress', () => {
    expect(
      isTrackingCompleted(
        'tracking',
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
    expect(isTrackingCompleted('library', [{ season: 1, episodes: 1 }], [{ season: 1, episode: 1 }])).toBe(false);
  });

  it('does not complete when metadata is missing', () => {
    expect(isTrackingCompleted('tracking', [], [{ season: 1, episode: 1 }])).toBe(false);
  });

  it('does not complete when only some episodes are watched', () => {
    expect(isTrackingCompleted('tracking', [{ season: 1, episodes: 2 }], [{ season: 1, episode: 1 }])).toBe(false);
  });
});
