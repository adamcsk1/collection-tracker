import { SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import { OMDB_API } from '../constants/omdb-const';

interface OmdbSeriesInfoResponse {
  totalSeasons?: string;
  Response?: string;
}

interface OmdbSeasonResponse {
  Episodes?: unknown[];
  Response?: string;
}

const parsePositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

const fetchOmdbJson = async <T>(params: Record<string, string>): Promise<T | null> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;

  const url = new URL(OMDB_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  url.searchParams.append('apikey', apiKey);

  try {
    const result = await fetch(url.href);
    if (!result.ok) return null;
    return (await result.json()) as T;
  } catch {
    return null;
  }
};

export const fetchSeriesSeasonMetadata = async (imdbId: string): Promise<SeriesTrackerSeasonMetadataModel[]> => {
  const seriesInfo = await fetchOmdbJson<OmdbSeriesInfoResponse>({ i: imdbId, type: 'series' });
  const totalSeasons = parsePositiveInteger(seriesInfo?.totalSeasons);
  if (!totalSeasons) return [];

  const seasons: SeriesTrackerSeasonMetadataModel[] = [];
  for (let season = 1; season <= Math.min(totalSeasons, MAX_SERIES_TRACKER_SEASONS); season++) {
    try {
      const seasonInfo = await fetchOmdbJson<OmdbSeasonResponse>({ i: imdbId, Season: `${season}` });
      const episodes = Array.isArray(seasonInfo?.Episodes) ? seasonInfo.Episodes.length : 0;
      if (episodes >= 1) seasons.push({ season, episodes: Math.min(episodes, MAX_SERIES_TRACKER_EPISODES) });
    } catch {
      // OMDb season data is best-effort; keep any other successful seasons.
    }
  }

  return seasons;
};
