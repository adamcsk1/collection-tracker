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
  CollectionItemShareApiModel,
  CollectionItemShareSelectionApiModel,
  CollectionItemsImportApiResponseModel,
  CollectionListTypeModel,
  CollectionItemsPageModel,
  CollectionItemSuggestionsApiResponseModel,
  CollectionMatchedItemsApiRequestModel,
  CollectionStatisticsApiResponseModel,
  CreateAccessTokenApiResponseModel,
  CreateApiResponseModel,
  GenreSuggestionsApiResponseModel,
  MarkAllSeriesCompletedApiResponseModel,
  MarkAllUncompletedApiResponseModel,
  MarkAllCompletedApiResponseModel,
  CompletedApiResponseModel,
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
  UserShareGrantApiModel,
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
    return this.request('DELETE', '/auth/session');
  }

  public searchItems(
    filters: CollectionItemFiltersApiModel = {},
    cursor: string | null = null,
    limit = 50
  ): Observable<CollectionItemsPageModel> {
    const query = this.buildQuery({ cursor: cursor ?? undefined, limit, ...filters });
    return this.paginatedRequest('GET', `/collection-items${query}`);
  }

  public getMatchedItems(request: CollectionMatchedItemsApiRequestModel): Observable<CollectionItemsPageModel> {
    return this.paginatedRequest('POST', '/collection-items/matches', request, { suppressErrorAlert: true });
  }

  public getRandomItem(): Observable<CollectionItemApiModel> {
    return this.request('GET', '/collection-items/random');
  }

  public getRandomImages(count = 10): Observable<RandomImagesApiResponseModel> {
    return this.request('GET', `/collection-items/random-images${this.buildQuery({ count })}`);
  }

  public markAllMoviesAsCompleted(ownerShareCode?: string): Observable<MarkAllCompletedApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/mark-movies-completed${this.buildQuery({ ownerShareCode })}`
    );
  }

  public markAllMoviesAsUncompleted(ownerShareCode?: string): Observable<MarkAllUncompletedApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/mark-movies-uncompleted${this.buildQuery({ ownerShareCode })}`
    );
  }

  public markAllSeriesAsCompleted(ownerShareCode?: string): Observable<MarkAllSeriesCompletedApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/mark-series-completed${this.buildQuery({ ownerShareCode })}`
    );
  }

  public markAllSeriesAsUncompleted(ownerShareCode?: string): Observable<MarkAllUncompletedApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/mark-series-uncompleted${this.buildQuery({ ownerShareCode })}`
    );
  }

  public markAllBooksAsCompleted(ownerShareCode?: string): Observable<MarkAllCompletedApiResponseModel> {
    return this.request('POST', `/collection-items/actions/mark-books-completed${this.buildQuery({ ownerShareCode })}`);
  }

  public markAllBooksAsUncompleted(ownerShareCode?: string): Observable<MarkAllUncompletedApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/mark-books-uncompleted${this.buildQuery({ ownerShareCode })}`
    );
  }

  public addCompletedItemByExternalId(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string,
    sourceListType?: CollectionListTypeModel
  ): Observable<CompletedApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking${this.buildQuery({ ownerShareCode, sourceListType, markCompleted: true })}`,
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
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking${this.buildQuery({ sourceListType, ownerShareCode })}`,
      {}
    );
  }

  public deleteCompletedItemByExternalId(externalProvider: string, externalItemId: string): Observable<void> {
    return this.request(
      'DELETE',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/completed`
    );
  }

  public deleteAllCompletedMovies(): Observable<MarkAllUncompletedApiResponseModel> {
    return this.request('DELETE', '/collection-items/tracking/completed-movies');
  }

  public deleteAllTrackingItems(): Observable<MarkAllUncompletedApiResponseModel> {
    return this.request('DELETE', '/collection-items/tracking');
  }

  public deleteAllBooksItems(): Observable<MarkAllUncompletedApiResponseModel> {
    return this.request('DELETE', '/collection-items/books');
  }

  public refreshImages(ownerShareCode?: string): Observable<RefreshImagesApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/refresh-images${this.buildQuery({ ownerShareCode })}`,
      undefined,
      {
        suppressErrorAlert: true,
      }
    );
  }

  public refreshExternalRatings(ownerShareCode?: string): Observable<RefreshExternalRatingsApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/actions/refresh-external-ratings${this.buildQuery({ ownerShareCode })}`
    );
  }

  public getItemSearchSuggestions(
    query: string,
    limit = 10,
    listType?: CollectionListTypeModel
  ): Observable<CollectionItemSuggestionsApiResponseModel> {
    return this.request('GET', `/collection-items/suggestions${this.buildQuery({ query, limit, listType })}`);
  }

  public getTagSuggestions(query: string, limit = 10): Observable<TagSuggestionsApiResponseModel> {
    return this.request('GET', `/collection-items/tag-suggestions${this.buildQuery({ query, limit })}`);
  }

  public getGenreSuggestions(query: string, limit = 10): Observable<GenreSuggestionsApiResponseModel> {
    return this.request('GET', `/collection-items/genre-suggestions${this.buildQuery({ query, limit })}`);
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
      `/collection-items/exists${this.buildQuery({ externalIdentitySource, externalIdentityId, ownerShareCode, listType, externalIds: externalIdParams })}`
    );
  }

  public getStatistics(
    filters: Pick<CollectionItemFiltersApiModel, 'type'> = {}
  ): Observable<CollectionStatisticsApiResponseModel> {
    return this.request('GET', `/collection-items/statistics${this.buildQuery({ ...filters })}`);
  }

  public create(
    item: CollectionItemChangeApiModel,
    targetOwnerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<CreateApiResponseModel> {
    return this.request('POST', '/collection-items', { ...item, targetOwnerShareCode, listType });
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
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}${this.buildQuery({ ownerShareCode, listType })}`,
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
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}${this.buildQuery({ hash, ownerShareCode, listType })}`
    );
  }

  public getCollectionItemShares(
    externalProvider: string,
    externalItemId: string,
    listType: CollectionListTypeModel
  ): Observable<CollectionItemShareApiModel[]> {
    return this.request(
      'GET',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/shares${this.buildQuery({ listType })}`
    );
  }

  public saveCollectionItemShares(
    externalProvider: string,
    externalItemId: string,
    listType: CollectionListTypeModel,
    selections: CollectionItemShareSelectionApiModel[]
  ): Observable<void> {
    return this.request(
      'PUT',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/shares${this.buildQuery({ listType })}`,
      { selections }
    );
  }

  public getAccessTokens(): Observable<AccessTokensApiResponseModel> {
    return this.request('GET', '/users/me/access-tokens');
  }

  public deleteAccessToken(tokenHash: string): Observable<void> {
    return this.request('DELETE', `/users/me/access-tokens/${tokenHash}`);
  }

  public createAccessToken(): Observable<CreateAccessTokenApiResponseModel> {
    return this.request('POST', '/users/me/access-tokens', {});
  }

  public createNewUserToken(): Observable<ChangeTokenApiResponseModel> {
    return this.request('PUT', '/users/me/token', {});
  }

  public deleteUser(): Observable<void> {
    return this.request('DELETE', '/users/me');
  }

  public getUserSettings(): Observable<UserSettingsApiResponseModel> {
    return this.request('GET', '/users/me/settings');
  }

  public getShares(): Observable<UserSharesApiResponseModel> {
    return this.request('GET', '/users/me/shares');
  }

  public saveShare(share: { sharedWithUserShareCode: string; grants: UserShareGrantApiModel[] }): Observable<void> {
    return this.request('POST', '/users/me/shares', share);
  }

  public deleteShare(sharedWithUserShareCode: string): Observable<void> {
    return this.request('DELETE', `/users/me/shares/${sharedWithUserShareCode}`);
  }

  public revokeIncomingShare(ownerUserShareCode: string): Observable<void> {
    return this.request('DELETE', `/users/me/shares/incoming/${ownerUserShareCode}`);
  }

  public getUserTagManagement(): Observable<TagManagementApiResponseModel> {
    return this.request('GET', '/users/me/tags');
  }

  public updateUserTagManagement(
    tagManagement: TagManagementApiRequestModel
  ): Observable<TagManagementApiResponseModel> {
    return this.request('POST', '/users/me/tags', tagManagement);
  }

  public renameTag(oldTag: string, newTag: string): Observable<RenameTagApiResponseModel> {
    return this.request('POST', '/users/me/tags/rename', { oldTag, newTag });
  }

  public getExternalMetadataItem(queryParams: {
    externalIdentitySource: string | null;
    externalIdentityId: string | null;
  }): Observable<ExternalMetadataItemModel> {
    return this.request(
      'GET',
      `/external-metadata/items?externalIdentitySource=${encodeURIComponent(queryParams.externalIdentitySource ?? '')}&externalIdentityId=${encodeURIComponent(queryParams.externalIdentityId ?? '')}`
    );
  }

  public getExternalMetadataProviders(): Observable<ExternalMetadataProvidersResponseModel> {
    return this.request('GET', '/external-metadata/providers');
  }

  public searchExternalMetadata(queryParams: {
    s: string | null;
    provider?: string | null;
  }): Observable<ExternalMetadataSearchResponseModel> {
    const providerQuery = queryParams.provider ? `&provider=${encodeURIComponent(queryParams.provider)}` : '';
    return this.request(
      'GET',
      `/external-metadata/search?s=${encodeURIComponent(queryParams.s ?? '')}${providerQuery}`
    );
  }

  public getTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'GET',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/seasons${this.buildQuery({ ownerShareCode })}`
    );
  }

  public refreshTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'POST',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/seasons/refresh${this.buildQuery({ ownerShareCode })}`,
      {}
    );
  }

  public updateTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string,
    request: TrackingSeasonsApiRequestModel,
    ownerShareCode?: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'PUT',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/seasons${this.buildQuery({ ownerShareCode })}`,
      request
    );
  }

  public deleteTrackingSeasonsByExternalId(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string
  ): Observable<TrackingSeasonsApiResponseModel> {
    return this.request(
      'DELETE',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/seasons${this.buildQuery({ ownerShareCode })}`
    );
  }

  public getTrackingCompletedEpisodesByExternalId(
    externalProvider: string,
    externalItemId: string,
    ownerShareCode?: string
  ): Observable<TrackingCompletedEpisodesApiResponseModel> {
    return this.request(
      'GET',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/completed-episodes${this.buildQuery({ ownerShareCode })}`
    );
  }

  public updateTrackingCompletedEpisodesByExternalId(
    externalProvider: string,
    externalItemId: string,
    request: TrackingCompletedEpisodesApiRequestModel,
    ownerShareCode?: string
  ): Observable<TrackingCompletedEpisodesApiResponseModel> {
    return this.request(
      'PUT',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/completed-episodes${this.buildQuery({ ownerShareCode })}`,
      request
    );
  }

  public markAllTrackingCompletedByExternalId(
    externalProvider: string,
    externalItemId: string
  ): Observable<TrackingCompletedEpisodesApiResponseModel> {
    return this.request(
      'PUT',
      `/collection-items/${encodeURIComponent(externalProvider)}/${encodeURIComponent(externalItemId)}/tracking/actions/mark-completed`
    );
  }

  public getAiQueryData(prompt: string, listType: CollectionListTypeModel): Observable<AiQueryResponseModel> {
    const body: AiQueryRequestModel = { prompt, listType };
    return this.request('POST', '/ai/matches', body, { suppressErrorAlert: true });
  }

  public getAiAvailable(): Observable<AiAvailableApiResponseModel> {
    return this.request('GET', '/ai/availability');
  }

  public getUserExport(): Observable<UserExportApiResponseModel> {
    return this.request('GET', '/users/me/export');
  }

  public importUserExport(importData: UserImportApiRequestModel): Observable<UserImportApiResponseModel> {
    return this.request('POST', '/users/me/imports', importData);
  }

  public importCollectionItems(source: string): Observable<CollectionItemsImportApiResponseModel> {
    return this.request('POST', '/collection-items/imports', { source });
  }
}
