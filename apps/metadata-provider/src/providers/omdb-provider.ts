import { MAX_SERIES_EPISODES, MAX_SERIES_SEASONS } from '@shared/constants/tracking-const';
import { TrackingSeasonMetadataModel } from '@shared/models/api-model';
import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import { ExternalMetadataSeasonProvider } from '@node/models/external-metadata-runtime-model';
import { describeMetadataError } from '@node/utils/metadata-error-util';
import { debugLog, errorLog } from '../core/logger';
import { DEFAULT_OMDB_API_URL, OMDB_REQUEST_TIMEOUT_MS } from './omdb-const';
import {
  OMDbResponseItemModel,
  OMDbResponseModel,
  OmdbErrorResponse,
  OmdbSeasonResponse,
  OmdbSeriesInfoResponse,
} from './omdb-model';

const isOmdbErrorResponse = <T extends object>(response: T | OmdbErrorResponse): response is OmdbErrorResponse =>
  'error' in response;

export class OmdbExternalMetadataProvider implements ExternalMetadataSeasonProvider {
  public readonly name = 'omdb';
  public readonly supportsDirectImdbId = true;

  constructor(
    private readonly apiKey: string,
    private readonly apiUrl = DEFAULT_OMDB_API_URL
  ) {}

  public async search(searchText: string): Promise<ExternalMetadataSearchResponseModel> {
    const data = await this.fetchJson<OMDbResponseModel>({ s: searchText });
    if (isOmdbErrorResponse(data)) return { results: [] };
    const searchItems = Array.isArray(data.Search) ? data.Search : [];
    return { results: searchItems.map((item) => this.toExternalMetadataItem(item)).filter((item) => !!item) };
  }

  public async getItem(providerItemId: string): Promise<ExternalMetadataItemModel | null> {
    try {
      const data = await this.fetchJson<OMDbResponseItemModel>({ i: providerItemId });
      if (isOmdbErrorResponse(data)) return null;
      const item = this.toExternalMetadataItem(data);
      await debugLog(`${this.name} item fetch ${item ? 'succeeded' : 'returned no usable item'}`);
      return item;
    } catch (error: unknown) {
      const message = describeMetadataError(error);
      await debugLog(`${this.name} item fetch error: ${message}`);
      throw error;
    }
  }

  public async getItemByImdbId(imdbId: string): Promise<ExternalMetadataItemModel | null> {
    return this.getItem(imdbId);
  }

  public async getSeriesSeasons(providerItemId: string): Promise<TrackingSeasonMetadataModel[]> {
    try {
      const seriesInfo = await this.fetchJson<OmdbSeriesInfoResponse>({ i: providerItemId, type: 'series' });
      if (isOmdbErrorResponse(seriesInfo)) return [];
      const totalSeasons = this.parsePositiveInteger(seriesInfo?.totalSeasons);
      if (!totalSeasons) return [];

      const seasons: TrackingSeasonMetadataModel[] = [];
      for (let season = 1; season <= Math.min(totalSeasons, MAX_SERIES_SEASONS); season++) {
        try {
          const seasonInfo = await this.fetchJson<OmdbSeasonResponse>({ i: providerItemId, Season: `${season}` });
          if (isOmdbErrorResponse(seasonInfo)) continue;
          const seasonEpisodes = Array.isArray(seasonInfo?.Episodes) ? seasonInfo.Episodes : [];
          const episodes = seasonEpisodes.length;
          if (episodes >= 1) {
            const titles = seasonEpisodes
              .slice(0, MAX_SERIES_EPISODES)
              .map((episode) => (typeof episode.Title === 'string' ? episode.Title : ''));
            seasons.push({ season, episodes: Math.min(episodes, MAX_SERIES_EPISODES), titles });
          }
        } catch (error) {
          // External season data is best-effort; keep any other successful seasons.
          await errorLog(`omdb season fetch season=${season} error=${describeMetadataError(error)}`);
        }
      }

      return seasons;
    } catch (error) {
      await errorLog(`omdb series info fetch error=${describeMetadataError(error)}`);
      return [];
    }
  }

  private async fetchJson<T>(params: Record<string, string>): Promise<T | OmdbErrorResponse> {
    const url = new URL(this.apiUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
    url.searchParams.append('apikey', this.apiKey);

    const response = await fetch(url.href, { signal: AbortSignal.timeout(OMDB_REQUEST_TIMEOUT_MS) });
    if (response.ok === false) {
      throw new Error(`${this.name} responded with ${response.status}`);
    }
    const data = (await response.json()) as T & { Error?: string; Response?: string };
    if (data.Response === 'False') {
      const message = data.Error ?? `${this.name} returned an error`;
      if (params.s !== undefined && message === 'Too many results.') {
        await debugLog('omdb search returned too many results; refine the search text');
        return { error: message };
      }
      if (message.toLowerCase().includes('not found')) return { error: message };
      throw new Error(message);
    }
    return data;
  }

  private toExternalMetadataItem(item: OMDbResponseItemModel): ExternalMetadataItemModel | null {
    const contentType =
      typeof item.Type === 'string' ? item.Type.trim().toLowerCase() : item.Type === undefined ? 'movie' : '';
    if (contentType !== 'movie' && contentType !== 'series') return null;
    const providerItemId = this.getString(item.imdbID);
    if (!providerItemId) return null;

    return {
      provider: this.name,
      providerItemId,
      externalIds: [{ source: 'imdb', id: providerItemId.toLowerCase() }],
      title: this.getString(item.Title),
      year: this.getString(item.Year),
      contentType,
      poster: this.getPoster(item.Poster),
      plot: this.getString(item.Plot),
      actors: this.getString(item.Actors),
      genres: this.getString(item.Genre)
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean),
      ratings: this.getRatings(item),
    };
  }

  private getRatings(item: OMDbResponseItemModel): ExternalMetadataItemModel['ratings'] {
    const ratings = (Array.isArray(item.Ratings) ? item.Ratings : [])
      .map((rating) => ({ source: this.getString(rating.Source), value: this.getString(rating.Value).trim() }))
      .filter((rating) => rating.source && rating.value);
    const imdbRating = this.getString(item.imdbRating);
    if (imdbRating && imdbRating !== 'N/A' && !ratings.some((rating) => rating.source === 'Internet Movie Database')) {
      ratings.push({ source: 'Internet Movie Database', value: imdbRating });
    }
    return ratings;
  }

  private getPoster(value: unknown): string {
    const poster = this.getString(value).trim();
    return !poster || poster.toUpperCase() === 'N/A' ? '' : poster;
  }

  private getString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private parsePositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
  }
}
