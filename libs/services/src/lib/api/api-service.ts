import { Injectable } from '@angular/core';
import {
  AccessTokensApiResponseModel,
  AiAvailableApiResponseModel,
  ChangeApiResponseModel,
  ChangeTokenApiResponseModel,
  CollectionItemApiModel,
  CollectionItemChangeApiModel,
  CollectionItemExistsApiResponseModel,
  CollectionItemFiltersApiModel,
  CollectionItemsImportApiResponseModel,
  CollectionListTypeModel,
  CollectionItemsApiResponseModel,
  CollectionItemSuggestionsApiResponseModel,
  CollectionMatchedItemsApiRequestModel,
  CollectionStatisticsApiResponseModel,
  CreateAccessTokenApiResponseModel,
  CreateApiResponseModel,
  GenreSuggestionsApiResponseModel,
  MarkAllSeriesWatchedApiResponseModel,
  MarkAllUnwatchedApiResponseModel,
  MarkAllWatchedApiResponseModel,
  WatchedApiResponseModel,
  RandomImagesApiResponseModel,
  RefreshExternalRatingsApiResponseModel,
  RefreshImagesApiResponseModel,
  RenameTagApiResponseModel,
  TrackingApiResponseModel,
  TrackingSeasonsApiRequestModel,
  TrackingSeasonsApiResponseModel,
  TrackingCompletedEpisodesApiRequestModel,
  TrackingCompletedEpisodesApiResponseModel,
  TagManagementApiRequestModel,
  TagManagementApiResponseModel,
  TagSuggestionsApiResponseModel,
  UserExportApiResponseModel,
  UserImportApiRequestModel,
  UserImportApiResponseModel,
  UserSettingsApiResponseModel,
  UserSharesApiResponseModel,
} from '@shared/models/api-model';
import { AiQueryRequestModel, AiQueryResponseModel } from '@shared/models/ai-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import {
  ExternalMetadataItemModel,
  ExternalMetadataProvidersResponseModel,
  ExternalMetadataSearchResponseModel,
} from '@shared/models/external-metadata-model';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api-service';

@Injectable({
  providedIn: 'root',
})
export class ApiService extends BaseApiService {
  private buildQuery(params: Record<string, string | number | boolean | string[] | undefined>): string {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      queryParams.set(key, Array.isArray(value) ? value.join(',') : `${value}`);
    }
    const query = queryParams.toString();
    return query ? `?${query}` : '';
  }

  public logout(): Observable<void> {
    return this.request('DELETE', '/logout');
  }

  public searchItems(
    filters: CollectionItemFiltersApiModel = {},
    offset = 0,
    limit = 50
  ): Observable<CollectionItemsApiResponseModel> {
    const query = this.buildQuery({ offset, limit, ...filters });
    return this.request('GET', `/items${query}`);
  }

  public getMatchedItems(request: CollectionMatchedItemsApiRequestModel): Observable<CollectionItemsApiResponseModel> {
    return this.request('POST', '/items/matched', request);
  }

  public getRandomItem(): Observable<CollectionItemApiModel> {
    return this.request('GET', '/items/random');
  }

  public getRandomImages(count = 10): Observable<RandomImagesApiResponseModel> {
    return this.request('GET', `/items/random-images${this.buildQuery({ count })}`);
  }

  public markAllMoviesAsWatched(ownerShareCode?: string): Observable<MarkAllWatchedApiResponseModel> {
    return this.request('POST', `/items/mark-all-watched${this.buildQuery({ ownerShareCode })}`);
  }

  public markAllMoviesAsUnwatched(ownerShareCode?: string): Observable<MarkAllUnwatchedApiResponseModel> {
    return this.request('POST', `/items/mark-all-unwatched${this.buildQuery({ ownerShareCode })}`);
  }

  public markAllSeriesAsWatched(ownerShareCode?: string): Observable<MarkAllSeriesWatchedApiResponseModel> {
    return this.request('POST', `/items/mark-all-series-watched${this.buildQuery({ ownerShareCode })}`);
  }

  public markAllSeriesAsUnwatched(ownerShareCode?: string): Observable<MarkAllUnwatchedApiResponseModel> {
    return this.request('POST', `/items/mark-all-series-unwatched${this.buildQuery({ ownerShareCode })}`);
  }

  public addWatchedItemByExternalId(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string,
    sourceListType?: CollectionListTypeModel
  ): Observable<WatchedApiResponseModel> {
    return this.request(
      'POST',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}${this.buildQuery({ ownerShareCode, sourceListType, markCompleted: true })}`,
      {}
    );
  }

  public addTrackingItemByExternalId(
    externalProvider: string,
    externalItemId: string,
    sourceListType?: CollectionListTypeModel,
    ownerShareCode?: string
  ): Observable<TrackingApiResponseModel> {
    return this.request(
      'POST',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}${this.buildQuery({ sourceListType, ownerShareCode })}`,
      {}
    );
  }

  public deleteWatchedItemByExternalId(externalProvider: string, externalItemId: string): Observable<void> {
    return this.request(
      'DELETE',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/completed`
    );
  }

  public deleteAllWatchedItems(): Observable<MarkAllUnwatchedApiResponseModel> {
    return this.request('DELETE', '/tracking/completed-movies');
  }

  public deleteAllTrackingItems(): Observable<MarkAllUnwatchedApiResponseModel> {
    return this.request('DELETE', '/tracking');
  }

  public deleteAllBooksItems(): Observable<MarkAllUnwatchedApiResponseModel> {
    return this.request('DELETE', '/books');
  }

  public refreshImages(ownerShareCode?: string): Observable<RefreshImagesApiResponseModel> {
    return this.request('POST', `/items/refresh-images${this.buildQuery({ ownerShareCode })}`);
  }

  public refreshExternalRatings(ownerShareCode?: string): Observable<RefreshExternalRatingsApiResponseModel> {
    return this.request('POST', `/items/refresh-external-ratings${this.buildQuery({ ownerShareCode })}`);
  }

  public getItemSearchSuggestions(
    query: string,
    limit = 10,
    listType?: CollectionListTypeModel
  ): Observable<CollectionItemSuggestionsApiResponseModel> {
    return this.request('GET', `/items/search-suggestions${this.buildQuery({ query, limit, listType })}`);
  }

  public getTagSuggestions(query: string, limit = 10): Observable<TagSuggestionsApiResponseModel> {
    return this.request('GET', `/tags/suggestions${this.buildQuery({ query, limit })}`);
  }

  public getGenreSuggestions(query: string, limit = 10): Observable<GenreSuggestionsApiResponseModel> {
    return this.request('GET', `/genres/suggestions${this.buildQuery({ query, limit })}`);
  }

  public collectionItemExists(
    externalIdentitySource: string,
    externalIdentityId: string,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel,
    externalIds?: ExternalItemIdentityModel[]
  ): Observable<CollectionItemExistsApiResponseModel> {
    const externalIdParams = externalIds?.length ? JSON.stringify(externalIds) : undefined;
    return this.request(
      'GET',
      `/items/exists${this.buildQuery({ externalIdentitySource, externalIdentityId, ownerShareCode, listType, externalIds: externalIdParams })}`
    );
  }

  public getStatistics(filters: CollectionItemFiltersApiModel = {}): Observable<CollectionStatisticsApiResponseModel> {
    return this.request('GET', `/statistics${this.buildQuery({ ...filters })}`);
  }

  public create(
    item: CollectionItemChangeApiModel,
    targetOwnerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<CreateApiResponseModel> {
    return this.request('POST', '/create', { ...item, targetOwnerShareCode, listType });
  }

  public updateByExternalId(
    externalProvider: string,
    externalItemId: string,
    item: CollectionItemChangeApiModel,
    hash: string,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<ChangeApiResponseModel> {
    return this.request(
      'PUT',
      `/items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/change${this.buildQuery({ ownerShareCode, listType })}`,
      { ...item, hash }
    );
  }

  public deleteByExternalId(
    externalProvider: string,
    externalItemId: string,
    hash: string,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<void> {
    return this.request(
      'DELETE',
      `/items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}${this.buildQuery({ hash, ownerShareCode, listType })}`
    );
  }

  public getAccessTokens(): Observable<AccessTokensApiResponseModel> {
    return this.request('GET', '/user/access-tokens');
  }

  public deleteAccessToken(tokenHash: string): Observable<void> {
    return this.request('DELETE', `/user/access-token/${tokenHash}`);
  }

  public createAccessToken(): Observable<CreateAccessTokenApiResponseModel> {
    return this.request('POST', '/user/access-token', {});
  }

  public createNewUserToken(): Observable<ChangeTokenApiResponseModel> {
    return this.request('PUT', '/user/change-token', {});
  }

  public deleteUser(): Observable<void> {
    return this.request('DELETE', '/user');
  }

  public getUserSettings(): Observable<UserSettingsApiResponseModel> {
    return this.request('GET', '/user/settings');
  }

  public getShares(): Observable<UserSharesApiResponseModel> {
    return this.request('GET', '/user/shares');
  }

  public saveShare(share: {
    sharedWithUserShareCode: string;
    canRead?: boolean;
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  }): Observable<void> {
    return this.request('POST', '/user/shares', share);
  }

  public deleteShare(sharedWithUserShareCode: string): Observable<void> {
    return this.request('DELETE', `/user/shares/${sharedWithUserShareCode}`);
  }

  public revokeIncomingShare(ownerUserShareCode: string): Observable<void> {
    return this.request('DELETE', `/user/shares/incoming/${ownerUserShareCode}`);
  }

  public getUserTagManagement(): Observable<TagManagementApiResponseModel> {
    return this.request('GET', '/tag-management');
  }

  public updateUserTagManagement(tagManagement: TagManagementApiRequestModel): Observable<void> {
    return this.request('POST', '/tag-management', tagManagement);
  }

  public renameTag(oldTag: string, newTag: string): Observable<RenameTagApiResponseModel> {
    return this.request('POST', '/tag-management/rename', { oldTag, newTag });
  }

  public getExternalMetadataItem(queryParams: {
    externalIdentitySource: string | null;
    externalIdentityId: string | null;
  }): Observable<ExternalMetadataItemModel> {
    return this.request(
      'GET',
      `/proxy/external-metadata/item?externalIdentitySource=${encodeURIComponent(queryParams.externalIdentitySource ?? '')}&externalIdentityId=${encodeURIComponent(queryParams.externalIdentityId ?? '')}`
    );
  }

  public getExternalMetadataProviders(): Observable<ExternalMetadataProvidersResponseModel> {
    return this.request('GET', '/proxy/external-metadata/providers');
  }

  public searchExternalMetadata(queryParams: {
    s: string | null;
    provider?: string | null;
  }): Observable<ExternalMetadataSearchResponseModel> {
    const providerQuery = queryParams.provider ? `&provider=${encodeURIComponent(queryParams.provider)}` : '';
    return this.request(
      'GET',
      `/proxy/external-metadata/search?s=${encodeURIComponent(queryParams.s ?? '')}${providerQuery}`
    );
  }

  public getTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'GET',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/seasons`
    );
  }

  public refreshTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'POST',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/seasons/refresh`,
      {}
    );
  }

  public updateTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string,
    request: TrackingSeasonsApiRequestModel
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'PUT',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/seasons`,
      request
    );
  }

  public deleteTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'DELETE',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/seasons`
    );
  }

  public getTrackingCompletedEpisodesByExternalId(
    externalProvider: string,
    externalItemId: string
  ): Observable<TrackingCompletedEpisodesApiResponseModel> {
    return this.request(
      'GET',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/completed-episodes`
    );
  }

  public updateTrackingCompletedEpisodesByExternalId(
    externalProvider: string,
    externalItemId: string,
    request: TrackingCompletedEpisodesApiRequestModel
  ): Observable<TrackingCompletedEpisodesApiResponseModel> {
    return this.request(
      'PUT',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/completed-episodes`,
      request
    );
  }

  public markAllTrackingCompletedByExternalId(
    externalProvider: string,
    externalItemId: string
  ): Observable<TrackingCompletedEpisodesApiResponseModel> {
    return this.request(
      'PUT',
      `/tracking/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/mark-all-completed`
    );
  }

  public getAiQueryData(prompt: string, listType: CollectionListTypeModel): Observable<AiQueryResponseModel> {
    const body: AiQueryRequestModel = { prompt, listType };
    return this.request('POST', '/proxy/ai/query', body);
  }

  public getAiAvailable(): Observable<AiAvailableApiResponseModel> {
    return this.request('GET', '/proxy/ai/available');
  }

  public getUserExport(): Observable<UserExportApiResponseModel> {
    return this.request('GET', '/export');
  }

  public importUserExport(importData: UserImportApiRequestModel): Observable<UserImportApiResponseModel> {
    return this.request('POST', '/import', importData);
  }

  public importCollectionItems(source: string): Observable<CollectionItemsImportApiResponseModel> {
    return this.request('POST', '/import/collection-items', { source });
  }
}
