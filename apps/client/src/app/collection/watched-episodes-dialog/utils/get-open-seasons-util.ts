import { SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';

export const getOpenSeasons = (seasons: SeriesTrackerSeasonMetadataModel[], watchedSet: Set<string>): Set<number> => {
  if (seasons.length === 0) {
    return new Set<number>();
  }

  const sortedSeasons = [...seasons].sort((firstSeason, secondSeason) => firstSeason.season - secondSeason.season);
  const inProgress = new Set<number>();
  const fullyWatched = new Set<number>();
  for (const season of sortedSeasons) {
    let watchedCount = 0;
    for (let episode = 1; episode <= season.episodes; episode++) {
      if (watchedSet.has(`${season.season}-${episode}`)) {
        watchedCount++;
      }
    }
    if (watchedCount > 0 && watchedCount < season.episodes) {
      inProgress.add(season.season);
    } else if (watchedCount === season.episodes) {
      fullyWatched.add(season.season);
    }
  }

  if (inProgress.size > 0) {
    return inProgress;
  }

  if (fullyWatched.size === seasons.length) {
    return new Set<number>();
  }

  if (fullyWatched.size === 0) {
    return new Set([sortedSeasons[0].season]);
  }

  const firstIncompleteSeason = sortedSeasons.find((season) => !fullyWatched.has(season.season));
  if (firstIncompleteSeason) {
    return new Set([firstIncompleteSeason.season]);
  }

  return new Set<number>();
};
