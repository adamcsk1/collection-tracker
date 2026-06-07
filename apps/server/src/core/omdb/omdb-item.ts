import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import { OMDB_API } from '../constants/omdb-const';
import { debugLog } from '../logger';

export const fetchOMDbItem = async (imdbId: string, apiKey: string): Promise<OMDbResponseItemModel | null> => {
  const url = new URL(OMDB_API);
  url.searchParams.append('i', imdbId);
  url.searchParams.append('apikey', apiKey);

  try {
    const response = await fetch(url.href);
    if (!response.ok) {
      await debugLog(`[${imdbId}] OMDb fetch failed with status ${response.status}`);
      return null;
    }
    const data = (await response.json()) as OMDbResponseItemModel;
    await debugLog(`[${imdbId}] OMDb fetch succeeded`);
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await debugLog(`[${imdbId}] OMDb fetch error: ${message}`);
    return null;
  }
};
