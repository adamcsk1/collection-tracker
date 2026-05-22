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
  CollectionListTypeModel,
  CollectionItemsApiResponseModel,
  CollectionItemSuggestionsApiResponseModel,
  CollectionMatchedItemsApiRequestModel,
  CollectionStatisticsApiResponseModel,
  CreateAccessTokenApiResponseModel,
  CreateApiResponseModel,
  GenreSuggestionsApiResponseModel,
  MarkAllUnwatchedApiResponseModel,
  MarkAllWatchedApiResponseModel,
  RandomImagesApiResponseModel,
  RefreshImagesApiResponseModel,
  SeriesTrackerSeasonsApiRequestModel,
  SeriesTrackerSeasonsApiResponseModel,
  TagConfigsApiRequestModel,
  TagConfigsApiResponseModel,
  TagSuggestionsApiResponseModel,
  UserSettingsApiResponseModel,
  UserSharesApiResponseModel,
} from '@shared/models/api-model';
import { AiQueryRequestModel, AiQueryResponseModel } from '@shared/models/ai-model';
import { OMDbResponseItemModel, OMDbResponseModel } from '@shared/models/omdb-model';
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

  public markAllAsWatched(): Observable<MarkAllWatchedApiResponseModel> {
    return this.request('POST', '/items/mark-all-watched');
  }

  public markAllAsUnwatched(): Observable<MarkAllUnwatchedApiResponseModel> {
    return this.request('POST', '/items/mark-all-unwatched');
  }

  public refreshImages(): Observable<RefreshImagesApiResponseModel> {
    return this.request('POST', '/items/refresh-images');
  }

  public getItemSearchSuggestions(query: string, limit = 10): Observable<CollectionItemSuggestionsApiResponseModel> {
    return this.request('GET', `/items/search-suggestions${this.buildQuery({ query, limit })}`);
  }

  public getTagSuggestions(query: string, limit = 10): Observable<TagSuggestionsApiResponseModel> {
    return this.request('GET', `/tags/suggestions${this.buildQuery({ query, limit })}`);
  }

  public getGenreSuggestions(query: string, limit = 10): Observable<GenreSuggestionsApiResponseModel> {
    return this.request('GET', `/genres/suggestions${this.buildQuery({ query, limit })}`);
  }

  public collectionItemExists(
    imdbId: string,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<CollectionItemExistsApiResponseModel> {
    return this.request('GET', `/items/exists${this.buildQuery({ imdbId, ownerShareCode, listType })}`);
  }

  public getStatistics(filters: CollectionItemFiltersApiModel = {}): Observable<CollectionStatisticsApiResponseModel> {
    return this.request('GET', `/statistics${this.buildQuery({ ...filters })}`);
  }

  public create(
    item: CollectionItemChangeApiModel,
    targetOwnerShareCode?: string,
    listType?: CollectionListTypeModel,
    fetchSeriesMetadata?: boolean
  ): Observable<CreateApiResponseModel> {
    return this.request('POST', '/create', { ...item, targetOwnerShareCode, listType, fetchSeriesMetadata });
  }

  public update(
    imdbId: string,
    item: CollectionItemChangeApiModel,
    hash: string,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<ChangeApiResponseModel> {
    return this.request('PUT', `/change/${imdbId}${this.buildQuery({ ownerShareCode, listType })}`, { ...item, hash });
  }

  public delete(
    imdbId: string,
    hash: string,
    ownerShareCode?: string,
    listType?: CollectionListTypeModel
  ): Observable<void> {
    return this.request('DELETE', `/delete/${imdbId}${this.buildQuery({ hash, ownerShareCode, listType })}`);
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

  public getUserTagConfigs(): Observable<TagConfigsApiResponseModel> {
    return this.request('GET', '/tag/config');
  }

  public updateUserTagConfigs(tagConfigs: TagConfigsApiRequestModel): Observable<void> {
    return this.request('POST', '/tag/change-config', tagConfigs);
  }

  public getOMDbData(queryParams: { i: string | null }): Observable<OMDbResponseItemModel> {
    return this.request('GET', `/proxy/omdb/item?i=${queryParams.i}`);
  }

  public getOMDbSearchData(queryParams: { s: string | null }): Observable<OMDbResponseModel> {
    return this.request('GET', `/proxy/omdb/search?s=${queryParams.s}`);
  }

  public getSeriesTrackerSeasons(imdbId: string): Observable<SeriesTrackerSeasonsApiResponseModel> {
    return this.request('GET', `/series-tracker/${imdbId}/seasons`);
  }

  public refreshSeriesTrackerSeasons(imdbId: string): Observable<SeriesTrackerSeasonsApiResponseModel> {
    return this.request('POST', `/series-tracker/${imdbId}/seasons/refresh`, {});
  }

  public updateSeriesTrackerSeasons(
    imdbId: string,
    request: SeriesTrackerSeasonsApiRequestModel
  ): Observable<SeriesTrackerSeasonsApiResponseModel> {
    return this.request('PUT', `/series-tracker/${imdbId}/seasons`, request);
  }

  public deleteSeriesTrackerSeasons(imdbId: string): Observable<SeriesTrackerSeasonsApiResponseModel> {
    return this.request('DELETE', `/series-tracker/${imdbId}/seasons`);
  }

  public getAiQueryData(prompt: string): Observable<AiQueryResponseModel> {
    const body: AiQueryRequestModel = { prompt };
    return this.request('POST', '/proxy/ai/query', { prompt: body.prompt });
  }

  public getAiAvailable(): Observable<AiAvailableApiResponseModel> {
    return this.request('GET', '/proxy/ai/available');
  }
}
