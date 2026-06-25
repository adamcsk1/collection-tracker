import { EXPORT_TYPE, EXPORT_VERSION } from '@shared/constants/export-import-const';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import {
  CollectionItemChangeApiModel,
  CollectionItemApiModel,
  CollectionItemsImportApiRequestModel,
  CollectionItemsImportApiResponseModel,
  SeriesTrackerSeasonMetadataModel,
  SeriesTrackerWatchedEpisodeModel,
  TagManagementApiModel,
  UserImportApiRequestModel,
  UserImportApiResponseModel,
  UserSettingsApiResponseModel,
} from '@shared/models/api-model';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
} from '@shared/models/collection-list-display-preferences-model';
import { LANGUAGES } from '@shared/models/language-model';
import { OMDbResponseItemModel, OMDbResponseRatingModel } from '@shared/models/omdb-model';
import { THEMES } from '@shared/models/theme-model';
import { getIMDbIds } from '@shared/omdb/get-imdb-id-util';
import { isAllowedValue } from '@shared/utils/parse-allowed-value-util';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX } from '@shared/constants/api-const';
import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { getDatabase } from '../core/database/database';
import {
  collectionItemExistsByImdbId,
  deleteCollectionItemsByUser,
  insertCollectionItem,
} from '../core/database/repositories/collection';
import { replaceSeriesTrackerSeasons } from '../core/database/repositories/series-tracker-season-repository';
import { replaceWatchedEpisodes } from '../core/database/repositories/series-tracker-watched-episodes-repository';
import { deleteTagManagement, upsertTagManagement } from '../core/database/repositories/tag-management-repository';
import { deleteUserSettings, upsertUserSettings } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { fetchOMDbItem } from '../core/omdb/omdb-item';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';
import { parseListType } from '../core/utils/query-parse-util';
import { normalizeSeriesTrackerSeasons } from '../core/utils/series-tracker-seasons-api-util';

const MAX_COLLECTION_ITEM_IMPORT_SOURCE_LENGTH = 1_000_000;
const MAX_COLLECTION_ITEM_IMPORT_IMDB_IDS = 100;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isUserSettings = (value: unknown): value is UserSettingsApiResponseModel => {
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(([key, setting]) => {
    switch (key) {
      case 'theme':
        return typeof setting === 'string' && isAllowedValue(setting, THEMES);
      case 'animatedBackground':
        return typeof setting === 'boolean';
      case 'language':
        return typeof setting === 'string' && isAllowedValue(setting, LANGUAGES);
      case 'defaultLibraryOwnerShareCode':
        return setting === null || (typeof setting === 'string' && setting.trim().length > 0);
      case 'collectionListDisplayPreferences':
        return isCollectionListDisplayPreferences(setting);
      default:
        return false;
    }
  });
};

const isCollectionListDisplayPreferences = (value: unknown): value is CollectionListDisplayPreferencesModel => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['showYear'] === 'boolean' &&
    typeof value['showSharedIcon'] === 'boolean' &&
    typeof value['preferredRating'] === 'string' &&
    COLLECTION_LIST_DISPLAY_RATINGS.includes(
      value['preferredRating'] as CollectionListDisplayPreferencesModel['preferredRating']
    ) &&
    typeof value['imdbRatingFallback'] === 'boolean'
  );
};

const isTagManagement = (value: unknown): value is TagManagementApiModel => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['tag'] === 'string' &&
    (typeof value['color'] === 'string' || value['color'] === null) &&
    typeof value['useForImageBorder'] === 'boolean' &&
    typeof value['useForTextColor'] === 'boolean' &&
    typeof value['useForImageBadge'] === 'boolean' &&
    typeof value['weight'] === 'number' &&
    Number.isFinite(value['weight'])
  );
};

const isSeason = (value: unknown): value is SeriesTrackerSeasonMetadataModel => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['season'] === 'number' &&
    typeof value['episodes'] === 'number' &&
    Number.isInteger(value['season']) &&
    Number.isInteger(value['episodes']) &&
    value['season'] > 0 &&
    value['episodes'] > 0 &&
    (value['titles'] === undefined || isStringArray(value['titles']))
  );
};

const isWatchedEpisode = (value: unknown): value is SeriesTrackerWatchedEpisodeModel => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['season'] === 'number' &&
    typeof value['episode'] === 'number' &&
    Number.isInteger(value['season']) &&
    Number.isInteger(value['episode']) &&
    value['season'] > 0 &&
    value['episode'] > 0
  );
};

const isCollectionItem = (value: unknown): value is CollectionItemApiModel => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['image'] === 'string' &&
    typeof value['title'] === 'string' &&
    isStringArray(value['genre']) &&
    typeof value['IMDbId'] === 'string' &&
    isStringArray(value['tags']) &&
    (typeof value['year'] === 'string' || value['year'] === null) &&
    typeof value['rate'] === 'string' &&
    typeof value['rottenTomatoesRate'] === 'string' &&
    typeof value['metacriticRate'] === 'string' &&
    (typeof value['userRate'] === 'number' || value['userRate'] === null) &&
    typeof value['actors'] === 'string' &&
    typeof value['plot'] === 'string' &&
    typeof value['listType'] === 'string' &&
    parseListType(value['listType']) !== undefined
  );
};

const isUserImport = (value: unknown): value is UserImportApiRequestModel => {
  if (!isPlainObject(value)) return false;
  if (value['type'] !== EXPORT_TYPE || value['version'] !== EXPORT_VERSION) return false;
  if (!isUserSettings(value['userSettings'])) return false;
  if (!Array.isArray(value['collectionItems']) || !value['collectionItems'].every(isCollectionItem)) return false;
  if (!Array.isArray(value['tagManagement']) || !value['tagManagement'].every(isTagManagement)) return false;
  if (!isPlainObject(value['seriesTrackerData'])) return false;

  const tagManagementTags = value['tagManagement'].map((config) => config.tag);
  if (new Set(tagManagementTags).size !== tagManagementTags.length) return false;

  return Object.values(value['seriesTrackerData']).every(
    (entry) =>
      isPlainObject(entry) &&
      Array.isArray(entry['seasons']) &&
      entry['seasons'].every(isSeason) &&
      Array.isArray(entry['watchedEpisodes']) &&
      entry['watchedEpisodes'].every(isWatchedEpisode)
  );
};

const toCollectionItemChange = (item: CollectionItemApiModel): CollectionItemChangeApiModel => ({
  image: item.image,
  title: item.title,
  genre: item.genre,
  IMDbId: item.IMDbId,
  tags: item.tags,
  year: item.year,
  rate: item.rate,
  rottenTomatoesRate: item.rottenTomatoesRate,
  metacriticRate: item.metacriticRate,
  userRate: item.userRate,
  actors: item.actors,
  plot: item.plot,
});

const normalizeWatchedEpisodes = (
  watchedEpisodes: SeriesTrackerWatchedEpisodeModel[]
): SeriesTrackerWatchedEpisodeModel[] | null => {
  const seenEpisodes = new Set<string>();
  const normalizedEpisodes: SeriesTrackerWatchedEpisodeModel[] = [];

  for (const watchedEpisode of watchedEpisodes) {
    const season = Number(watchedEpisode.season);
    const episode = Number(watchedEpisode.episode);
    if (
      !Number.isInteger(season) ||
      season < 1 ||
      season > MAX_SERIES_TRACKER_SEASONS ||
      !Number.isInteger(episode) ||
      episode < 1 ||
      episode > MAX_SERIES_TRACKER_EPISODES
    ) {
      return null;
    }

    const key = `${season}-${episode}`;
    if (seenEpisodes.has(key)) return null;
    seenEpisodes.add(key);
    normalizedEpisodes.push({ season, episode });
  }

  return normalizedEpisodes.sort((firstEpisode, secondEpisode) => {
    if (firstEpisode.season !== secondEpisode.season) return firstEpisode.season - secondEpisode.season;
    return firstEpisode.episode - secondEpisode.episode;
  });
};

const watchedEpisodesExistInSeasons = (
  watchedEpisodes: SeriesTrackerWatchedEpisodeModel[],
  seasons: SeriesTrackerSeasonMetadataModel[]
): boolean => {
  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  return watchedEpisodes.every((episode) => availableEpisodes.has(`${episode.season}-${episode.episode}`));
};

const normalizeSeriesTrackerImportData = (
  importData: UserImportApiRequestModel,
  seriesTrackerImdbIds: Set<string>
): UserImportApiRequestModel['seriesTrackerData'] | null => {
  const normalizedSeriesTrackerData: UserImportApiRequestModel['seriesTrackerData'] = {};

  for (const [imdbId, seriesTrackerData] of Object.entries(importData.seriesTrackerData)) {
    if (!seriesTrackerImdbIds.has(imdbId)) return null;

    const seasons = normalizeSeriesTrackerSeasons({ seasons: seriesTrackerData.seasons });
    const watchedEpisodes = normalizeWatchedEpisodes(seriesTrackerData.watchedEpisodes);
    if (!seasons || !watchedEpisodes || !watchedEpisodesExistInSeasons(watchedEpisodes, seasons)) return null;

    normalizedSeriesTrackerData[imdbId] = { seasons, watchedEpisodes };
  }

  return normalizedSeriesTrackerData;
};

const parseYear = (year: string): string | null => {
  const normalizedYear = year
    .trim()
    .replace('–', '-')
    .replace(/^(\d{4})\.0$/, '$1');
  return normalizedYear && normalizedYear !== 'N/A' ? normalizedYear : null;
};

const getRating = (ratings: OMDbResponseRatingModel[] | undefined, source: string): string => {
  if (!Array.isArray(ratings)) return '';
  const rating = ratings.find(
    (candidate) => isPlainObject(candidate) && candidate['Source'] === source && typeof candidate['Value'] === 'string'
  );
  return rating?.Value.trim() ?? '';
};

const toCollectionItemFromOMDb = (omdbItem: OMDbResponseItemModel): CollectionItemChangeApiModel | null => {
  if (!isPlainObject(omdbItem)) return null;

  const type = typeof omdbItem.Type === 'string' ? omdbItem.Type.trim().toLowerCase() : '';
  const typeTag = type === 'movie' ? MOVIE_TAG : type === 'series' ? SERIES_TAG : null;
  if (!typeTag || typeof omdbItem.imdbID !== 'string') return null;

  return {
    image: typeof omdbItem.Poster === 'string' ? omdbItem.Poster : '',
    title: typeof omdbItem.Title === 'string' ? omdbItem.Title : '',
    genre: `${typeof omdbItem.Genre === 'string' ? omdbItem.Genre : ''}`
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean),
    IMDbId: omdbItem.imdbID.toLowerCase(),
    tags: [typeTag],
    year: parseYear(typeof omdbItem.Year === 'string' ? omdbItem.Year : ''),
    rate: typeof omdbItem.imdbRating === 'string' ? omdbItem.imdbRating : '',
    rottenTomatoesRate: getRating(omdbItem.Ratings, 'Rotten Tomatoes'),
    metacriticRate: getRating(omdbItem.Ratings, 'Metacritic'),
    userRate: null,
    actors: typeof omdbItem.Actors === 'string' ? omdbItem.Actors : '',
    plot: typeof omdbItem.Plot === 'string' ? omdbItem.Plot : '',
  };
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/import`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const body = request.body as unknown;
      if (!isUserImport(body)) return response.code(400).send();

      const normalizedItems = body.collectionItems.map((item) => {
        const normalizedItem = normalizeItem(toCollectionItemChange(item));
        const listType = parseListType(item.listType);
        return { item: normalizedItem, listType };
      });
      if (normalizedItems.some((entry) => !entry.item || !entry.listType)) return response.code(400).send();

      const uniqueItems = new Set<string>();
      const seriesTrackerImdbIds = new Set<string>();
      for (const entry of normalizedItems) {
        const key = `${entry.item!.IMDbId}\u0000${entry.listType}`;
        if (uniqueItems.has(key)) return response.code(400).send();
        uniqueItems.add(key);
        if (entry.listType === 'series-tracker') seriesTrackerImdbIds.add(entry.item!.IMDbId);
      }
      const normalizedSeriesTrackerData = normalizeSeriesTrackerImportData(body, seriesTrackerImdbIds);
      if (!normalizedSeriesTrackerData) return response.code(400).send();

      const db = getDatabase();
      const usernameHash = request.usernameHash;
      let importedSeriesTrackerSeasons = 0;
      let importedSeriesTrackerWatchedEpisodes = 0;

      db.transaction(() => {
        deleteUserSettings(db, usernameHash);
        deleteTagManagement(db, usernameHash);
        deleteCollectionItemsByUser(db, usernameHash);

        upsertUserSettings(db, usernameHash, body.userSettings);
        upsertTagManagement(db, usernameHash, body.tagManagement);

        for (const entry of normalizedItems) {
          const item = entry.item!;
          insertCollectionItem(db, usernameHash, getItemHash(item), item, entry.listType);
        }

        for (const [imdbId, seriesTrackerData] of Object.entries(normalizedSeriesTrackerData)) {
          const seasons = replaceSeriesTrackerSeasons(db, usernameHash, imdbId, seriesTrackerData.seasons);
          const watchedEpisodes = replaceWatchedEpisodes(db, usernameHash, imdbId, seriesTrackerData.watchedEpisodes);
          importedSeriesTrackerSeasons += seasons.length;
          importedSeriesTrackerWatchedEpisodes += watchedEpisodes.length;
        }
      })();

      const result: UserImportApiResponseModel = {
        importedCollectionItems: body.collectionItems.length,
        importedTagManagement: body.tagManagement.length,
        importedSeriesTrackerSeasons,
        importedSeriesTrackerWatchedEpisodes,
      };
      response.send(result);
    })
  );

  app.post(
    `${API_PREFIX}/import/collection-items`,
    { preHandler: jwtGuard },
    withErrorHandler(async (request, response) => {
      const body = request.body as Partial<CollectionItemsImportApiRequestModel>;
      if (typeof body?.source !== 'string' || body.source.length > MAX_COLLECTION_ITEM_IMPORT_SOURCE_LENGTH) {
        return response.code(400).send();
      }

      const imdbIds = getIMDbIds(body.source);
      if (imdbIds.length > MAX_COLLECTION_ITEM_IMPORT_IMDB_IDS) return response.code(400).send();
      const db = getDatabase();
      const usernameHash = request.usernameHash;
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const imdbId of imdbIds) {
        if (collectionItemExistsByImdbId(db, usernameHash, imdbId)) {
          skippedCount++;
          continue;
        }

        const omdbItem = await fetchOMDbItem(imdbId, process.env.OMDB_API_KEY ?? '');
        if (omdbItem?.imdbID?.toLowerCase() !== imdbId) {
          errorCount++;
          continue;
        }
        const item = omdbItem
          ? normalizeItem(toCollectionItemFromOMDb(omdbItem) as CollectionItemChangeApiModel)
          : null;
        if (!item) {
          errorCount++;
          continue;
        }

        if (collectionItemExistsByImdbId(db, usernameHash, item.IMDbId)) {
          skippedCount++;
          continue;
        }

        insertCollectionItem(db, usernameHash, getItemHash(item), item, 'library');
        importedCount++;
      }

      const result: CollectionItemsImportApiResponseModel = {
        totalCount: imdbIds.length,
        importedCount,
        skippedCount,
        errorCount,
      };
      response.send(result);
    })
  );
};
