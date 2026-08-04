import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import { WatchingSeasonMetadataModel } from '@shared/models/api-model';
import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import { debugLog } from '../../logger';
import { ExternalMetadataSeasonProvider } from '../external-metadata-provider';
import { DEFAULT_OMDB_API_URL } from './omdb-const';
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
      await debugLog(`[${providerItemId}] ${this.name} fetch ${item ? 'succeeded' : 'returned no usable item'}`);
      return item;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await debugLog(`[${providerItemId}] ${this.name} fetch error: ${message}`);
      throw error;
    }
  }

  public async getItemByImdbId(imdbId: string): Promise<ExternalMetadataItemModel | null> {
    return this.getItem(imdbId);
  }

  public async getSeriesSeasons(providerItemId: string): Promise<WatchingSeasonMetadataModel[]> {
    try {
      const seriesInfo = await this.fetchJson<OmdbSeriesInfoResponse>({ i: providerItemId, type: 'series' });
      if (isOmdbErrorResponse(seriesInfo)) return [];
      const totalSeasons = this.parsePositiveInteger(seriesInfo?.totalSeasons);
      if (!totalSeasons) return [];

      const seasons: WatchingSeasonMetadataModel[] = [];
      for (let season = 1; season <= Math.min(totalSeasons, MAX_SERIES_TRACKER_SEASONS); season++) {
        try {
          const seasonInfo = await this.fetchJson<OmdbSeasonResponse>({ i: providerItemId, Season: `${season}` });
          if (isOmdbErrorResponse(seasonInfo)) continue;
          const seasonEpisodes = Array.isArray(seasonInfo?.Episodes) ? seasonInfo.Episodes : [];
          const episodes = seasonEpisodes.length;
          if (episodes >= 1) {
            const titles = seasonEpisodes
              .slice(0, MAX_SERIES_TRACKER_EPISODES)
              .map((episode) => (typeof episode.Title === 'string' ? episode.Title : ''));
            seasons.push({ season, episodes: Math.min(episodes, MAX_SERIES_TRACKER_EPISODES), titles });
          }
        } catch {
          // External season data is best-effort; keep any other successful seasons.
        }
      }

      return seasons;
    } catch {
      return [];
    }
  }

  private async fetchJson<T>(params: Record<string, string>): Promise<T | OmdbErrorResponse> {
    const url = new URL(this.apiUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
    url.searchParams.append('apikey', this.apiKey);

    const response = await fetch(url.href);
    if (response.ok === false) {
      throw new Error(`${this.name} responded with ${response.status}`);
    }
    const data = (await response.json()) as T & { Error?: string; Response?: string };
    if (data.Response === 'False') {
      const message = data.Error ?? `${this.name} returned an error`;
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
      poster: this.getString(item.Poster),
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

  private getString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private parsePositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
  }
}
