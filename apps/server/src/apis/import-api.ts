import { EXPORT_TYPE, EXPORT_VERSION } from '@shared/constants/export-import-const';
import { isExternalItemIdentitySourceName } from '@shared/constants/external-metadata-const';
import { MAX_SERIES_TRACKER_EPISODES, MAX_SERIES_TRACKER_SEASONS } from '@shared/constants/series-tracker-const';
import {
  CollectionItemChangeApiModel,
  TrackingSeasonMetadataModel,
  TrackingCompletedEpisodeModel,
  TagManagementApiModel,
  UserImportApiRequestModel,
  UserImportApiResponseModel,
  UserSettingsApiResponseModel,
} from '@shared/models/api-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import {
  CollectionListDisplayPreferencesModel,
  COLLECTION_LIST_DISPLAY_RATINGS,
} from '@shared/models/collection-list-display-preferences-model';
import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import {
  isCollectionFeaturePreferences,
  parseCollectionFeaturePreferences,
} from '@shared/utils/collection-feature-preferences-util';
import { createCollectionItemTagValidation } from '@shared/utils/collection-item-tag-validation-util';
import { isAllowedValue } from '@shared/utils/parse-allowed-value-util';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX } from '@shared/constants/api-const';
import { getDatabase } from '../core/database/database';
import {
  deleteCollectionItemsByUser,
  insertCollectionItem,
  syncTrackingCompletedTagByExternalId,
} from '../core/database/repositories/collection';
import {
  inferCanonicalItemId,
  normalizeExternalIdentities,
} from '../core/database/repositories/external-item-identity-repository';
import { replaceTrackingSeasonsByExternalId } from '../core/database/repositories/series-tracker-season-repository';
import { replaceCompletedEpisodesByExternalId } from '../core/database/repositories/series-completed-episodes-repository';
import { deleteTagManagement, upsertTagManagement } from '../core/database/repositories/tag-management-repository';
import { deleteUserSettings, upsertUserSettings } from '../core/database/repositories/user-repository';
import { jwtGuard } from '../core/jwt';
import { withErrorHandler } from '../core/utils/api-error-handler';
import { getItemHash, normalizeItem } from '../core/utils/collection-item-util';
import { parseListType } from '../core/utils/query-parse-util';
import { normalizeTrackingSeasons } from '../core/utils/series-tracker-seasons-api-util';
import { ImportedCollectionItemApiModel, ImportedUserRequestModel } from './import-api-model';

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
      case 'collectionFeaturePreferences':
        return isCollectionFeaturePreferences(setting);
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

const isImportedExternalIdentity = (value: unknown): value is ExternalItemIdentityModel => {
  if (!isPlainObject(value) || typeof value['id'] !== 'string') return false;
  return typeof value['source'] === 'string' && isExternalItemIdentitySourceName(value['source']);
};

const isImportedCanonicalItemId = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const canonicalItemId = value.trim();
  if (!canonicalItemId || canonicalItemId !== value) return false;
  const separatorIndex = canonicalItemId.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === canonicalItemId.length - 1) return false;
  const source = canonicalItemId.slice(0, separatorIndex);
  const id = canonicalItemId.slice(separatorIndex + 1);
  return isExternalItemIdentitySourceName(source) && id.trim().length > 0 && id === id.trim();
};

const isSeason = (value: unknown): value is TrackingSeasonMetadataModel => {
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

const isCompletedEpisode = (value: unknown): value is TrackingCompletedEpisodeModel => {
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

const isWatchedAt = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  const normalizedValue = value.trim();
  if (normalizedValue !== value) return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-](\d{2}):(\d{2}))?)?$/.exec(value);
  if (!match) return false;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    millisecondText,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText === undefined ? 0 : Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  const millisecond = millisecondText === undefined ? 0 : Number(millisecondText.padEnd(3, '0'));
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    millisecond >= 0 &&
    millisecond <= 999 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
};

const isOptionalNonNegativeInteger = (value: unknown): value is number | null | undefined => {
  if (value === undefined || value === null) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
};

const isOptionalPositiveInteger = (value: unknown): value is number | null | undefined => {
  if (value === undefined || value === null) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
};

const isCollectionItem = (value: unknown): value is ImportedCollectionItemApiModel => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value['image'] === 'string' &&
    typeof value['title'] === 'string' &&
    isStringArray(value['genre']) &&
    (typeof value['IMDbId'] === 'string' || value['IMDbId'] === undefined) &&
    typeof value['externalProvider'] === 'string' &&
    typeof value['externalItemId'] === 'string' &&
    (value['externalIds'] === undefined ||
      (Array.isArray(value['externalIds']) && value['externalIds'].every(isImportedExternalIdentity))) &&
    (value['canonicalItemId'] === undefined || isImportedCanonicalItemId(value['canonicalItemId'])) &&
    isStringArray(value['tags']) &&
    (typeof value['year'] === 'string' || value['year'] === null) &&
    typeof value['rate'] === 'string' &&
    typeof value['rottenTomatoesRate'] === 'string' &&
    typeof value['metacriticRate'] === 'string' &&
    (typeof value['userRate'] === 'number' || value['userRate'] === null) &&
    typeof value['actors'] === 'string' &&
    typeof value['plot'] === 'string' &&
    (value['contentType'] === 'movie' || value['contentType'] === 'series' || value['contentType'] === 'book') &&
    typeof value['favorite'] === 'boolean' &&
    typeof value['listType'] === 'string' &&
    parseListType(value['listType']) !== undefined &&
    value['watchedAt'] !== undefined &&
    isWatchedAt(value['watchedAt']) &&
    isOptionalNonNegativeInteger(value['progressCurrent']) &&
    isOptionalPositiveInteger(value['progressTotal'])
  );
};

const isUserImport = (value: unknown): value is ImportedUserRequestModel => {
  if (!isPlainObject(value)) return false;
  const importVersion = value['version'];
  if (value['type'] !== EXPORT_TYPE || importVersion !== EXPORT_VERSION) return false;
  if (!isUserSettings(value['userSettings'])) return false;
  if (!Array.isArray(value['collectionItems']) || !value['collectionItems'].every(isCollectionItem)) {
    return false;
  }
  if (!Array.isArray(value['tagManagement']) || !value['tagManagement'].every(isTagManagement)) return false;
  const trackingData = value['trackingData'];
  if (!isPlainObject(trackingData)) return false;

  const tagManagementTags = value['tagManagement'].map((config) => config.tag);
  if (new Set(tagManagementTags).size !== tagManagementTags.length) return false;

  return Object.values(trackingData).every(
    (entry) =>
      isPlainObject(entry) &&
      Array.isArray(entry['seasons']) &&
      entry['seasons'].every(isSeason) &&
      Array.isArray(entry['completedEpisodes']) &&
      entry['completedEpisodes'].every(isCompletedEpisode)
  );
};

const toCollectionItemChange = (item: ImportedCollectionItemApiModel): CollectionItemChangeApiModel => ({
  image: item.image,
  title: item.title,
  genre: item.genre,
  IMDbId: item.IMDbId,
  externalProvider: item.externalProvider,
  externalItemId: item.externalItemId,
  externalIds: item.externalIds,
  tags: item.tags,
  year: item.year,
  rate: item.rate,
  rottenTomatoesRate: item.rottenTomatoesRate,
  metacriticRate: item.metacriticRate,
  userRate: item.userRate,
  actors: item.actors,
  plot: item.plot,
  contentType: item.contentType,
  favorite: item.favorite,
});

const getTrackingDataKey = (externalProvider: string, externalItemId: string): string =>
  `${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}`;

const parseTrackingDataKey = (trackingDataKey: string): { externalProvider: string; externalItemId: string } | null => {
  const separatorIndex = trackingDataKey.indexOf('/');
  if (separatorIndex <= 0 || separatorIndex === trackingDataKey.length - 1) return null;
  try {
    return {
      externalProvider: decodeURIComponent(trackingDataKey.slice(0, separatorIndex)),
      externalItemId: decodeURIComponent(trackingDataKey.slice(separatorIndex + 1)),
    };
  } catch {
    return null;
  }
};

const normalizeCompletedEpisodes = (
  completedEpisodes: TrackingCompletedEpisodeModel[]
): TrackingCompletedEpisodeModel[] | null => {
  const seenEpisodes = new Set<string>();
  const normalizedEpisodes: TrackingCompletedEpisodeModel[] = [];

  for (const watchedEpisode of completedEpisodes) {
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

const completedEpisodesExistInSeasons = (
  completedEpisodes: TrackingCompletedEpisodeModel[],
  seasons: TrackingSeasonMetadataModel[]
): boolean => {
  const availableEpisodes = new Set<string>();
  for (const season of seasons) {
    for (let episode = 1; episode <= season.episodes; episode++) {
      availableEpisodes.add(`${season.season}-${episode}`);
    }
  }

  return completedEpisodes.every((episode) => availableEpisodes.has(`${episode.season}-${episode.episode}`));
};

const normalizeTrackingImportData = (
  importData: ImportedUserRequestModel,
  trackingDataKeys: Set<string>
): UserImportApiRequestModel['trackingData'] | null => {
  const normalizedTrackingData: UserImportApiRequestModel['trackingData'] = {};

  const sourceTrackingData = importData.trackingData ?? {};
  for (const [trackingDataKey, trackingData] of Object.entries(sourceTrackingData)) {
    if (!trackingDataKeys.has(trackingDataKey) || !parseTrackingDataKey(trackingDataKey)) return null;

    const seasons = normalizeTrackingSeasons({ seasons: trackingData.seasons });
    const completedEpisodes = normalizeCompletedEpisodes(trackingData.completedEpisodes);
    if (!seasons || !completedEpisodes || !completedEpisodesExistInSeasons(completedEpisodes, seasons)) return null;

    normalizedTrackingData[trackingDataKey] = { seasons, completedEpisodes };
  }

  return normalizedTrackingData;
};

export const register = (app: FastifyInstance): void => {
  app.post(
    `${API_PREFIX}/import`,
    { preHandler: jwtGuard },
    withErrorHandler((request, response) => {
      const body = request.body as unknown;
      if (!isUserImport(body)) return response.code(400).send();
      const importData = body;
      const normalizedFeaturePreferences = parseCollectionFeaturePreferences(
        importData.userSettings.collectionFeaturePreferences
      );
      const userSettings = normalizedFeaturePreferences
        ? {
            ...importData.userSettings,
            collectionFeaturePreferences: normalizedFeaturePreferences,
          }
        : importData.userSettings;

      const normalizedItems = importData.collectionItems.map((item) => {
        const normalizedItem = normalizeItem(toCollectionItemChange(item));
        const listType = parseListType(item.listType);
        return {
          item: normalizedItem,
          listType,
          watchedAt: item.watchedAt,
          canonicalItemId: item.canonicalItemId,
          progressCurrent: item.progressCurrent ?? null,
          progressTotal: item.progressTotal ?? null,
        };
      });
      if (
        normalizedItems.some(
          (entry) =>
            !entry.item ||
            !entry.listType ||
            createCollectionItemTagValidation({
              contentType: entry.item.contentType,
              favorite: entry.item.favorite,
              listType: entry.listType,
            })
        )
      )
        return response.code(400).send();

      const db = getDatabase();
      const usernameHash = request.usernameHash;
      const uniqueItems = new Set<string>();
      const uniqueCanonicalItems = new Set<string>();
      const uniqueExternalIdentities = new Set<string>();
      const trackingDataKeys = new Set<string>();
      for (const entry of normalizedItems) {
        const key = `${entry.item!.externalProvider}\u0000${entry.item!.externalItemId}\u0000${entry.listType}`;
        if (uniqueItems.has(key)) return response.code(400).send();
        uniqueItems.add(key);
        const identities = normalizeExternalIdentities(
          entry.item!.externalProvider,
          entry.item!.externalItemId,
          entry.item!.externalIds
        );
        if (identities.length === 0) return response.code(400).send();
        for (const identity of identities) {
          const identityKey = `${identity.source}\u0000${identity.id}\u0000${entry.listType}`;
          if (uniqueExternalIdentities.has(identityKey)) return response.code(400).send();
          uniqueExternalIdentities.add(identityKey);
        }
        const inferredCanonicalItemId = inferCanonicalItemId(identities);
        const allowedCanonicalItemIds = new Set([
          inferredCanonicalItemId,
          ...identities.map((identity) => `${identity.source}:${identity.id}`),
        ]);
        if (entry.canonicalItemId !== undefined && !allowedCanonicalItemIds.has(entry.canonicalItemId)) {
          return response.code(400).send();
        }
        const canonicalItemId = entry.canonicalItemId ?? inferredCanonicalItemId;
        entry.canonicalItemId = canonicalItemId;
        const canonicalKey = `${canonicalItemId}\u0000${entry.listType}`;
        if (uniqueCanonicalItems.has(canonicalKey)) return response.code(400).send();
        uniqueCanonicalItems.add(canonicalKey);
        if (entry.listType === 'tracking') {
          trackingDataKeys.add(getTrackingDataKey(entry.item!.externalProvider, entry.item!.externalItemId));
        }
      }
      const normalizedTrackingData = normalizeTrackingImportData(importData, trackingDataKeys);
      if (!normalizedTrackingData) return response.code(400).send();

      let importedTrackingSeasons = 0;
      let importedTrackingCompletedEpisodes = 0;

      db.transaction(() => {
        deleteUserSettings(db, usernameHash);
        deleteTagManagement(db, usernameHash);
        deleteCollectionItemsByUser(db, usernameHash);

        upsertUserSettings(db, usernameHash, userSettings);
        upsertTagManagement(db, usernameHash, importData.tagManagement);

        for (const entry of normalizedItems) {
          const item = entry.item!;
          insertCollectionItem(
            db,
            usernameHash,
            getItemHash(item),
            item,
            entry.listType,
            entry.watchedAt,
            entry.canonicalItemId,
            entry.progressCurrent,
            entry.progressTotal
          );
        }

        for (const [trackingDataKey, trackingData] of Object.entries(normalizedTrackingData)) {
          const externalIdentity = parseTrackingDataKey(trackingDataKey)!;
          const seasons = replaceTrackingSeasonsByExternalId(
            db,
            usernameHash,
            externalIdentity.externalProvider,
            externalIdentity.externalItemId,
            trackingData.seasons
          );
          const completedEpisodes = replaceCompletedEpisodesByExternalId(
            db,
            usernameHash,
            externalIdentity.externalProvider,
            externalIdentity.externalItemId,
            trackingData.completedEpisodes
          );
          importedTrackingSeasons += seasons.length;
          importedTrackingCompletedEpisodes += completedEpisodes.length;
        }

        for (const trackingDataKey of trackingDataKeys) {
          const externalIdentity = parseTrackingDataKey(trackingDataKey)!;
          syncTrackingCompletedTagByExternalId(
            db,
            usernameHash,
            externalIdentity.externalProvider,
            externalIdentity.externalItemId
          );
        }
      })();

      const result: UserImportApiResponseModel = {
        importedCollectionItems: body.collectionItems.length,
        importedTagManagement: importData.tagManagement.length,
        importedTrackingSeasons,
        importedTrackingCompletedEpisodes,
      };
      response.send(result);
    })
  );
};
