import { TrackingSeasonMetadataModel } from '@shared/models/api-model';

export const getOpenSeasons = (seasons: TrackingSeasonMetadataModel[], completedSet: Set<string>): Set<number> => {
  if (seasons.length === 0) {
    return new Set<number>();
  }

  const sortedSeasons = [...seasons].sort((firstSeason, secondSeason) => firstSeason.season - secondSeason.season);
  const inProgress = new Set<number>();
  const fullyCompleted = new Set<number>();
  for (const season of sortedSeasons) {
    let completedCount = 0;
    for (let episode = 1; episode <= season.episodes; episode++) {
      if (completedSet.has(`${season.season}-${episode}`)) {
        completedCount++;
      }
    }
    if (completedCount > 0 && completedCount < season.episodes) {
      inProgress.add(season.season);
    } else if (completedCount === season.episodes) {
      fullyCompleted.add(season.season);
    }
  }

  if (inProgress.size > 0) {
    return inProgress;
  }

  if (fullyCompleted.size === seasons.length) {
    return new Set<number>();
  }

  if (fullyCompleted.size === 0) {
    return new Set([sortedSeasons[0].season]);
  }

  const firstIncompleteSeason = sortedSeasons.find((season) => !fullyCompleted.has(season.season));
  if (firstIncompleteSeason) {
    return new Set([firstIncompleteSeason.season]);
  }

  return new Set<number>();
};
