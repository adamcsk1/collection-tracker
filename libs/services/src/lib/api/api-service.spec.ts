import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CollectionItemShareSelectionApiModel } from '@shared/models/api-model';
import { AlertService } from '../alert-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { lastValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './api-service';
import { ApiState, apiStateToken, initialApiState } from './api-store';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialApiState, apiStateToken),
        { provide: AlertService, useValue: { show: alertSpy } },
      ],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
    apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', 'https://api.test');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends logout request', async () => {
    const promise = lastValueFrom(service.logout());

    const logoutRequest = httpMock.expectOne('https://api.test/auth/session');
    expect(logoutRequest.request.method).toBe('DELETE');
    logoutRequest.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('maps paginated collection wire responses and sends cursor query parameters', async () => {
    const promise = lastValueFrom(service.searchItems({ listType: 'library' }, 'next/cursor', 25));

    const request = httpMock.expectOne(
      'https://api.test/collection-items?cursor=next%2Fcursor&limit=25&listType=library'
    );
    const page = { limit: 25, hasMore: true, nextCursor: 'following' };
    request.flush({ data: [{ title: 'Item' }], page });

    await expect(promise).resolves.toEqual({ items: [{ title: 'Item' }], page });
  });

  it('uses collection search defaults and omits absent filters', async () => {
    const promise = lastValueFrom(service.searchItems());

    const request = httpMock.expectOne('https://api.test/collection-items?limit=50');
    request.flush({ data: [], page: { limit: 50, hasMore: false, nextCursor: null } });

    await expect(promise).resolves.toEqual({
      items: [],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
  });

  it.each([
    [null, 'Http failure response for https://api.test/collection-items?limit=50: 500 Server Error'],
    ['bad', 'Http failure response for https://api.test/collection-items?limit=50: 500 Server Error'],
    [
      { title: 'Server Error' },
      'Http failure response for https://api.test/collection-items?limit=50: 500 Server Error',
    ],
    [{ detail: 'Collection unavailable' }, 'Collection unavailable'],
  ])('alerts and rethrows paginated request errors for payload %j', async (errorPayload, expectedAlert) => {
    const promise = lastValueFrom(service.searchItems());

    const request = httpMock.expectOne('https://api.test/collection-items?limit=50');
    request.flush(errorPayload, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledWith(expectedAlert);
  });

  it.each([
    [{}, 'https://api.test/collection-items/statistics'],
    [{ type: 'movie' as const }, 'https://api.test/collection-items/statistics?type=movie'],
  ])('loads scoped statistics with filters %o', async (filters, expectedUrl) => {
    const statistics = {
      scope: 'all' as const,
      summary: { total: 0, movies: 0, series: 0, books: 0, favorites: 0 },
      charts: {
        tagCounts: [],
        genreCounts: [],
        releaseYearCounts: [],
        userRatingCounts: [],
        mediaTypeCounts: [],
        statusCounts: [],
      },
    };
    const promise = lastValueFrom(service.getStatistics(filters));

    const request = httpMock.expectOne(expectedUrl);
    expect(request.request.method).toBe('GET');
    request.flush({ data: statistics });

    await expect(promise).resolves.toEqual(statistics);
  });

  it('maps paginated matched-item wire responses', async () => {
    const body = { identities: [{ source: 'imdb' as const, id: 'tt001' }], cursor: 'next', limit: 1 };
    const promise = lastValueFrom(service.getMatchedItems(body));

    const request = httpMock.expectOne('https://api.test/collection-items/matches');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    const page = { limit: 1, hasMore: false, nextCursor: null };
    request.flush({ data: [{ title: 'Matched' }], page });

    await expect(promise).resolves.toEqual({ items: [{ title: 'Matched' }], page });
  });

  it('creates an item with provided data', async () => {
    const item = {
      image: '',
      title: 'note',
      genre: [],
      IMDbId: 'tt123',
      externalProvider: 'omdb' as const,
      externalItemId: 'tt123',
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
      contentType: 'movie' as const,
      favorite: false,
    };
    const promise = lastValueFrom(service.create(item));

    const createRequest = httpMock.expectOne('https://api.test/collection-items');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(item);
    createRequest.flush({ data: { item } });

    await expect(promise).resolves.toEqual({ item });
  });

  it('checks collection item existence by external identity', async () => {
    const externalIds = [{ source: 'omdb' as const, id: 'item,with,comma' }];
    const promise = lastValueFrom(
      service.collectionItemExists('provider/id', 'item/id', 'share/code', 'up-next', externalIds)
    );

    const existsRequest = httpMock.expectOne(
      `https://api.test/collection-items/exists?externalIdentitySource=provider%2Fid&externalIdentityId=item%2Fid&ownerShareCode=share%2Fcode&listType=up-next&externalIds=${encodeURIComponent(JSON.stringify(externalIds))}`
    );
    expect(existsRequest.request.method).toBe('GET');
    existsRequest.flush({ data: { exists: true } });

    await expect(promise).resolves.toEqual({ exists: true });
  });

  it('omits empty optional item existence parameters', async () => {
    const promise = lastValueFrom(service.collectionItemExists('omdb', 'tt1', undefined, undefined, []));

    const existsRequest = httpMock.expectOne(
      'https://api.test/collection-items/exists?externalIdentitySource=omdb&externalIdentityId=tt1'
    );
    existsRequest.flush({ data: { exists: false } });

    await expect(promise).resolves.toEqual({ exists: false });
  });

  it('updates an item by external identity', async () => {
    const item = {
      image: '',
      title: 'updated',
      genre: [],
      IMDbId: undefined,
      externalProvider: 'omdb' as const,
      externalItemId: 'item/id',
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
      contentType: 'movie' as const,
      favorite: false,
    };
    const promise = lastValueFrom(
      service.updateByExternalId('provider/id', 'item/id', item, 'old-hash', 'share/code', 'up-next')
    );

    const updateRequest = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid?ownerShareCode=share%2Fcode&listType=up-next'
    );
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({ ...item, hash: 'old-hash' });
    updateRequest.flush({ data: { item: { ...item, hash: 'new-hash' } } });

    await expect(promise).resolves.toEqual({ item: { ...item, hash: 'new-hash' } });
  });

  it('deletes an item by external identity', async () => {
    const promise = lastValueFrom(
      service.deleteByExternalId('provider/id', 'item/id', 'abc123', 'share/code', 'up-next')
    );

    const deleteRequest = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid?hash=abc123&ownerShareCode=share%2Fcode&listType=up-next'
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('retrieves collection item shares by external identity', async () => {
    const promise = lastValueFrom(service.getCollectionItemShares('provider/id', 'item/id', 'up-next'));

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/shares?listType=up-next'
    );
    expect(request.request.method).toBe('GET');
    const shares = [
      {
        sharedWithUserShareCode: 'share-code',
        sharedWithUsername: 'viewer',
        readMode: 'selected',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ];
    request.flush({ data: shares });

    await expect(promise).resolves.toEqual(shares);
  });

  it('saves collection item shares by external identity', async () => {
    const selections: CollectionItemShareSelectionApiModel[] = [
      {
        sharedWithUserShareCode: 'share-code',
        permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
      },
    ];
    const promise = lastValueFrom(service.saveCollectionItemShares('provider/id', 'item/id', 'up-next', selections));

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/shares?listType=up-next'
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ selections });
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('retrieves access tokens', async () => {
    const promise = lastValueFrom(service.getAccessTokens());

    const accessTokensRequest = httpMock.expectOne('https://api.test/users/me/access-tokens');
    expect(accessTokensRequest.request.method).toBe('GET');
    accessTokensRequest.flush({ data: [{ tokenHash: 'token' }] });

    await expect(promise).resolves.toEqual([{ tokenHash: 'token' }]);
  });

  it('deletes an access token by hash', async () => {
    const promise = lastValueFrom(service.deleteAccessToken('abc123'));

    const deleteAccessTokenRequest = httpMock.expectOne('https://api.test/users/me/access-tokens/abc123');
    expect(deleteAccessTokenRequest.request.method).toBe('DELETE');
    deleteAccessTokenRequest.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('creates a new access token', async () => {
    const promise = lastValueFrom(service.createAccessToken());

    const createAccessTokenRequest = httpMock.expectOne('https://api.test/users/me/access-tokens');
    expect(createAccessTokenRequest.request.method).toBe('POST');
    createAccessTokenRequest.flush({ data: { token: 'new-token' } });

    await expect(promise).resolves.toEqual({ token: 'new-token' });
  });

  it('creates a new user token', async () => {
    const promise = lastValueFrom(service.createNewUserToken());

    const newUserTokenRequest = httpMock.expectOne('https://api.test/users/me/token');
    expect(newUserTokenRequest.request.method).toBe('PUT');
    newUserTokenRequest.flush({ data: { token: 'user-token' } });

    await expect(promise).resolves.toEqual({ token: 'user-token' });
  });

  it('deletes the current user', async () => {
    const promise = lastValueFrom(service.deleteUser());

    const deleteUserRequest = httpMock.expectOne('https://api.test/users/me');
    expect(deleteUserRequest.request.method).toBe('DELETE');
    deleteUserRequest.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('deletes all movie tracker items', async () => {
    const promise = lastValueFrom(service.deleteAllCompletedMovies());

    const deleteRequest = httpMock.expectOne('https://api.test/collection-items/tracking/completed-movies');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ data: { changedCount: 2 } });

    await expect(promise).resolves.toEqual({ changedCount: 2 });
  });

  it('deletes all series tracker items', async () => {
    const promise = lastValueFrom(service.deleteAllTrackingItems());

    const deleteRequest = httpMock.expectOne('https://api.test/collection-items/tracking');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ data: { changedCount: 3 } });

    await expect(promise).resolves.toEqual({ changedCount: 3 });
  });

  it('deletes all book tracker items', async () => {
    const promise = lastValueFrom(service.deleteAllBooksItems());

    const deleteRequest = httpMock.expectOne('https://api.test/collection-items/books');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ data: { changedCount: 4 } });

    await expect(promise).resolves.toEqual({ changedCount: 4 });
  });

  it('copies a movie to the movie tracker by external identity', async () => {
    const promise = lastValueFrom(
      service.addCompletedItemByExternalId('provider/id', 'item/id', 'share/code', 'up-next')
    );

    const addRequest = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking?ownerShareCode=share%2Fcode&sourceListType=up-next&markCompleted=true'
    );
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({});
    addRequest.flush({ data: { changedCount: 1 } });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('deletes a movie tracker item by external identity', async () => {
    const promise = lastValueFrom(service.deleteCompletedItemByExternalId('provider/id', 'item/id'));

    const deleteRequest = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/completed'
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('copies a series to the series tracker by external identity', async () => {
    const promise = lastValueFrom(
      service.addTrackingItemByExternalId('provider/id', 'item/id', 'up-next', 'share/code')
    );

    const addRequest = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking?sourceListType=up-next&ownerShareCode=share%2Fcode'
    );
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({});
    addRequest.flush({ data: { changedCount: 1 } });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('retrieves user tag management', async () => {
    const promise = lastValueFrom(service.getUserTagManagement());

    const tagManagementRequest = httpMock.expectOne('https://api.test/users/me/tags');
    expect(tagManagementRequest.request.method).toBe('GET');
    tagManagementRequest.flush({
      data: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
    });

    await expect(promise).resolves.toEqual([
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
  });

  it('updates user tag management', async () => {
    const payload = [
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ];
    const promise = lastValueFrom(service.updateUserTagManagement(payload));

    const updateTagManagementRequest = httpMock.expectOne('https://api.test/users/me/tags');
    expect(updateTagManagementRequest.request.method).toBe('POST');
    expect(updateTagManagementRequest.request.body).toEqual(payload);
    updateTagManagementRequest.flush({ data: payload });

    await expect(promise).resolves.toEqual(payload);
  });

  it('renames a tag', async () => {
    const promise = lastValueFrom(service.renameTag('#old', '#new'));

    const renameTagRequest = httpMock.expectOne('https://api.test/users/me/tags/rename');
    expect(renameTagRequest.request.method).toBe('POST');
    expect(renameTagRequest.request.body).toEqual({ oldTag: '#old', newTag: '#new' });
    renameTagRequest.flush({ data: { renamedItemCount: 1, tagManagement: [] } });

    await expect(promise).resolves.toEqual({ renamedItemCount: 1, tagManagement: [] });
  });

  it('encodes external metadata item IDs in query params', async () => {
    const promise = lastValueFrom(
      service.getExternalMetadataItem({
        externalIdentitySource: 'omdb&extra=true',
        externalIdentityId: 'tt0133093&extra=true',
      })
    );

    const itemRequest = httpMock.expectOne(
      'https://api.test/external-metadata/items?externalIdentitySource=omdb%26extra%3Dtrue&externalIdentityId=tt0133093%26extra%3Dtrue'
    );
    expect(itemRequest.request.method).toBe('GET');
    itemRequest.flush({ data: { provider: 'omdb', providerItemId: 'tt0133093', title: 'The Matrix' } });

    await expect(promise).resolves.toEqual({ provider: 'omdb', providerItemId: 'tt0133093', title: 'The Matrix' });
  });

  it('encodes IMDb external identity item IDs in query params', async () => {
    const promise = lastValueFrom(
      service.getExternalMetadataItem({ externalIdentitySource: 'imdb', externalIdentityId: 'tt0133093&extra=true' })
    );

    const itemRequest = httpMock.expectOne(
      'https://api.test/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093%26extra%3Dtrue'
    );
    expect(itemRequest.request.method).toBe('GET');
    itemRequest.flush({ data: { provider: 'omdb', providerItemId: 'tt0133093', title: 'The Matrix' } });

    await expect(promise).resolves.toEqual({ provider: 'omdb', providerItemId: 'tt0133093', title: 'The Matrix' });
  });

  it('encodes external metadata search text in query params', async () => {
    const promise = lastValueFrom(service.searchExternalMetadata({ s: 'Matrix & Dune?' }));

    const searchRequest = httpMock.expectOne('https://api.test/external-metadata/search?s=Matrix%20%26%20Dune%3F');
    expect(searchRequest.request.method).toBe('GET');
    searchRequest.flush({ data: { results: [] } });

    await expect(promise).resolves.toEqual({ results: [] });
  });

  it('handles absent external metadata query values and includes provider', async () => {
    const itemPromise = lastValueFrom(
      service.getExternalMetadataItem({ externalIdentitySource: null, externalIdentityId: null })
    );
    const itemRequest = httpMock.expectOne(
      'https://api.test/external-metadata/items?externalIdentitySource=&externalIdentityId='
    );
    itemRequest.flush({ data: { provider: 'omdb', providerItemId: 'tt1', title: 'Item' } });
    await itemPromise;

    const searchPromise = lastValueFrom(service.searchExternalMetadata({ s: null, provider: 'openlibrary' }));
    const searchRequest = httpMock.expectOne('https://api.test/external-metadata/search?s=&provider=openlibrary');
    searchRequest.flush({ data: { results: [] } });

    await expect(searchPromise).resolves.toEqual({ results: [] });
  });

  it('uses default limits for random images and suggestions', async () => {
    const randomImagesPromise = lastValueFrom(service.getRandomImages());
    const randomImagesRequest = httpMock.expectOne('https://api.test/collection-items/random-images?count=10');
    randomImagesRequest.flush({ data: { images: [] } });
    await randomImagesPromise;

    const itemSuggestionsPromise = lastValueFrom(service.getItemSearchSuggestions('matrix'));
    const itemSuggestionsRequest = httpMock.expectOne(
      'https://api.test/collection-items/suggestions?query=matrix&limit=10'
    );
    itemSuggestionsRequest.flush({ data: { suggestions: [] } });
    await itemSuggestionsPromise;

    const tagSuggestionsPromise = lastValueFrom(service.getTagSuggestions('tag'));
    const tagSuggestionsRequest = httpMock.expectOne(
      'https://api.test/collection-items/tag-suggestions?query=tag&limit=10'
    );
    tagSuggestionsRequest.flush({ data: { suggestions: [] } });
    await tagSuggestionsPromise;

    const genreSuggestionsPromise = lastValueFrom(service.getGenreSuggestions('genre'));
    const genreSuggestionsRequest = httpMock.expectOne(
      'https://api.test/collection-items/genre-suggestions?query=genre&limit=10'
    );
    genreSuggestionsRequest.flush({ data: { suggestions: [] } });

    await expect(genreSuggestionsPromise).resolves.toEqual({ suggestions: [] });
  });

  it('retrieves configured external metadata providers', async () => {
    const promise = lastValueFrom(service.getExternalMetadataProviders());

    const providersRequest = httpMock.expectOne('https://api.test/external-metadata/providers');
    expect(providersRequest.request.method).toBe('GET');
    providersRequest.flush({
      data: { providers: [{ name: 'omdb', supportsSeasonMetadata: true, supportsDirectImdbId: true }] },
    });

    await expect(promise).resolves.toEqual({
      providers: [{ name: 'omdb', supportsSeasonMetadata: true, supportsDirectImdbId: true }],
    });
  });

  it('retrieves user settings', async () => {
    const promise = lastValueFrom(service.getUserSettings());

    const userSettingsRequest = httpMock.expectOne('https://api.test/users/me/settings');
    expect(userSettingsRequest.request.method).toBe('GET');
    userSettingsRequest.flush({
      data: {
        theme: 'dark',
        animatedBackground: false,
        language: 'en',
      },
    });

    await expect(promise).resolves.toEqual({
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
    });
  });

  it('retrieves AI availability', async () => {
    const promise = lastValueFrom(service.getAiAvailable());

    const aiAvailableRequest = httpMock.expectOne('https://api.test/ai/availability');
    expect(aiAvailableRequest.request.method).toBe('GET');
    aiAvailableRequest.flush({ data: { aiAvailable: true } });

    await expect(promise).resolves.toEqual({ aiAvailable: true });
  });

  it('posts a prompt to the AI query endpoint and returns matched IDs', async () => {
    const promise = lastValueFrom(service.getAiQueryData('sci-fi movies', 'library'));

    const aiRequest = httpMock.expectOne('https://api.test/ai/matches');
    expect(aiRequest.request.method).toBe('POST');
    expect(aiRequest.request.body).toEqual({ prompt: 'sci-fi movies', listType: 'library' });
    aiRequest.flush({ data: { matchedIds: ['tt0133093', 'tt0372784'] } });

    await expect(promise).resolves.toEqual({ matchedIds: ['tt0133093', 'tt0372784'] });
  });

  it('retrieves user export data', async () => {
    const exportData = {
      type: 'collection-tracker-export',
      version: 10,
      userSettings: {},
      collectionItems: [],
      tagManagement: [],
      trackingData: {},
    };
    const promise = lastValueFrom(service.getUserExport());

    const exportRequest = httpMock.expectOne('https://api.test/users/me/export');
    expect(exportRequest.request.method).toBe('GET');
    exportRequest.flush({ data: exportData });

    await expect(promise).resolves.toEqual(exportData);
  });

  it('imports user export data', async () => {
    const importData = {
      type: 'collection-tracker-export',
      version: 10,
      userSettings: {},
      collectionItems: [],
      tagManagement: [],
      trackingData: {},
    };
    const importResult = {
      importedCollectionItems: 0,
      importedTagManagement: 0,
      importedTrackingSeasons: 0,
      importedTrackingCompletedEpisodes: 0,
    };
    const promise = lastValueFrom(service.importUserExport(importData));

    const importRequest = httpMock.expectOne('https://api.test/users/me/imports');
    expect(importRequest.request.method).toBe('POST');
    expect(importRequest.request.body).toEqual(importData);
    importRequest.flush({ data: importResult });

    await expect(promise).resolves.toEqual(importResult);
  });

  it('imports collection items from source text', async () => {
    const promise = lastValueFrom(service.importCollectionItems('tt0133093'));

    const importRequest = httpMock.expectOne('https://api.test/collection-items/imports');
    expect(importRequest.request.method).toBe('POST');
    expect(importRequest.request.body).toEqual({ source: 'tt0133093' });
    importRequest.flush({ data: { totalCount: 1, importedCount: 1, skippedCount: 0, errorCount: 0 } });

    await expect(promise).resolves.toEqual({ totalCount: 1, importedCount: 1, skippedCount: 0, errorCount: 0 });
  });

  it('alerts with RFC 9457 detail and rethrows when AI query fails', async () => {
    const problem = {
      type: 'https://collectiontracker.app/problems/ai-unavailable',
      title: 'Bad Gateway',
      status: 502,
      detail: 'AI service is unavailable',
    };
    const promise = lastValueFrom(service.getAiQueryData('sci-fi movies', 'up-next'));

    const aiRequest = httpMock.expectOne('https://api.test/ai/matches');
    expect(aiRequest.request.body).toEqual({ prompt: 'sci-fi movies', listType: 'up-next' });
    aiRequest.flush(problem, { status: 502, statusText: 'Bad Gateway' });

    await expect(promise).rejects.toMatchObject({ status: 502, error: problem });
    expect(alertSpy).toHaveBeenCalledOnce();
    expect(alertSpy).toHaveBeenCalledWith(problem.detail);
  });

  it('alerts and rethrows when retrieving user tag management fails', async () => {
    const promise = lastValueFrom(service.getUserTagManagement());

    const tagManagementRequest = httpMock.expectOne('https://api.test/users/me/tags');
    tagManagementRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when updating user tag management fails', async () => {
    const promise = lastValueFrom(
      service.updateUserTagManagement([
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ])
    );

    const updateTagManagementRequest = httpMock.expectOne('https://api.test/users/me/tags');
    updateTagManagementRequest.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when retrieving user settings fails', async () => {
    const promise = lastValueFrom(service.getUserSettings());

    const userSettingsRequest = httpMock.expectOne('https://api.test/users/me/settings');
    userSettingsRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when logout fails', async () => {
    const promise = lastValueFrom(service.logout());

    const logoutRequest = httpMock.expectOne('https://api.test/auth/session');
    logoutRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when create fails', async () => {
    const item = {
      image: '',
      title: 'note',
      genre: [],
      IMDbId: 'tt123',
      externalProvider: 'omdb' as const,
      externalItemId: 'tt123',
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
      contentType: 'movie' as const,
      favorite: false,
    };
    const promise = lastValueFrom(service.create(item));

    const createRequest = httpMock.expectOne('https://api.test/collection-items');
    createRequest.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when deleteAccessToken fails', async () => {
    const promise = lastValueFrom(service.deleteAccessToken('hash'));

    const deleteAccessTokenRequest = httpMock.expectOne('https://api.test/users/me/access-tokens/hash');
    deleteAccessTokenRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when createAccessToken fails', async () => {
    const promise = lastValueFrom(service.createAccessToken());

    const createAccessTokenRequest = httpMock.expectOne('https://api.test/users/me/access-tokens');
    createAccessTokenRequest.flush('bad', { status: 502, statusText: 'Bad Gateway' });

    await expect(promise).rejects.toMatchObject({ status: 502 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when createNewUserToken fails', async () => {
    const promise = lastValueFrom(service.createNewUserToken());

    const newUserTokenRequest = httpMock.expectOne('https://api.test/users/me/token');
    newUserTokenRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when deleteUser fails', async () => {
    const promise = lastValueFrom(service.deleteUser());

    const deleteUserRequest = httpMock.expectOne('https://api.test/users/me');
    deleteUserRequest.flush('bad', { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('marks all movies as completed for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllMoviesAsCompleted('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/mark-movies-completed?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 2 } });

    await expect(promise).resolves.toEqual({ changedCount: 2 });
  });

  it('marks all movies as uncompleted for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllMoviesAsUncompleted('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/mark-movies-uncompleted?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 1 } });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('marks all series as completed for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllSeriesAsCompleted('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/mark-series-completed?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { trackedCount: 2, progressChangedCount: 3 } });

    await expect(promise).resolves.toEqual({ trackedCount: 2, progressChangedCount: 3 });
  });

  it('marks all series as uncompleted for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllSeriesAsUncompleted('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/mark-series-uncompleted?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 1 } });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('marks all books as completed for the authenticated user', async () => {
    const promise = lastValueFrom(service.markAllBooksAsCompleted());

    const markAllRequest = httpMock.expectOne('https://api.test/collection-items/actions/mark-books-completed');
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 2 } });

    await expect(promise).resolves.toEqual({ changedCount: 2 });
  });

  it('marks all books as uncompleted for the authenticated user', async () => {
    const promise = lastValueFrom(service.markAllBooksAsUncompleted());

    const markAllRequest = httpMock.expectOne('https://api.test/collection-items/actions/mark-books-uncompleted');
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 1 } });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('marks all books as completed for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllBooksAsCompleted('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/mark-books-completed?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 2 } });

    await expect(promise).resolves.toEqual({ changedCount: 2 });
  });

  it('marks all books as uncompleted for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllBooksAsUncompleted('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/mark-books-uncompleted?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ data: { changedCount: 1 } });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('retrieves shared owner series tracker seasons by external identity', async () => {
    const promise = lastValueFrom(service.getTrackingSeasonsByExternalId('provider/id', 'item/id', 'owner/code'));

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/seasons?ownerShareCode=owner%2Fcode'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { seasons: [] } });

    await expect(promise).resolves.toEqual({ seasons: [] });
  });

  it('refreshes shared owner series tracker seasons by external identity', async () => {
    const promise = lastValueFrom(service.refreshTrackingSeasonsByExternalId('provider/id', 'item/id', 'owner/code'));

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/seasons/refresh?ownerShareCode=owner%2Fcode'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ data: { seasons: [] } });

    await expect(promise).resolves.toEqual({ seasons: [] });
  });

  it('updates shared owner series tracker seasons by external identity', async () => {
    const payload = { seasons: [{ season: 1, episodes: 2 }] };
    const promise = lastValueFrom(
      service.updateTrackingSeasonsByExternalId('provider/id', 'item/id', payload, 'owner/code')
    );

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/seasons?ownerShareCode=owner%2Fcode'
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: payload });

    await expect(promise).resolves.toEqual(payload);
  });

  it('deletes shared owner series tracker seasons by external identity', async () => {
    const promise = lastValueFrom(service.deleteTrackingSeasonsByExternalId('provider/id', 'item/id', 'owner/code'));

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/seasons?ownerShareCode=owner%2Fcode'
    );
    expect(request.request.method).toBe('DELETE');
    request.flush({ data: { seasons: [] } });

    await expect(promise).resolves.toEqual({ seasons: [] });
  });

  it('retrieves shared owner completed episodes by external identity', async () => {
    const promise = lastValueFrom(
      service.getTrackingCompletedEpisodesByExternalId('provider/id', 'item/id', 'owner/code')
    );

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/completed-episodes?ownerShareCode=owner%2Fcode'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { completedEpisodes: [] } });

    await expect(promise).resolves.toEqual({ completedEpisodes: [] });
  });

  it('updates shared owner completed episodes by external identity', async () => {
    const payload = { completedEpisodes: [{ season: 1, episode: 2 }] };
    const promise = lastValueFrom(
      service.updateTrackingCompletedEpisodesByExternalId('provider/id', 'item/id', payload, 'owner/code')
    );

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/completed-episodes?ownerShareCode=owner%2Fcode'
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: payload });

    await expect(promise).resolves.toEqual(payload);
  });

  it('marks all series tracker episodes completed by external identity', async () => {
    const promise = lastValueFrom(service.markAllTrackingCompletedByExternalId('provider/id', 'item/id'));

    const request = httpMock.expectOne(
      'https://api.test/collection-items/provider%2Fid/item%2Fid/tracking/actions/mark-completed'
    );
    expect(request.request.method).toBe('PUT');
    request.flush({ data: { completedEpisodes: [] } });

    await expect(promise).resolves.toEqual({ completedEpisodes: [] });
  });

  it('refreshes images and returns summary', async () => {
    const promise = lastValueFrom(service.refreshImages());

    const refreshRequest = httpMock.expectOne('https://api.test/collection-items/actions/refresh-images');
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ data: { count: 5, checked: 5, fixed: 1, errors: 0 } });

    await expect(promise).resolves.toEqual({ count: 5, checked: 5, fixed: 1, errors: 0 });
  });

  it('refreshes shared library images when owner share code is provided', async () => {
    const promise = lastValueFrom(service.refreshImages('owner-code'));

    const refreshRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/refresh-images?ownerShareCode=owner-code'
    );
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ data: { count: 1, checked: 1, fixed: 1, errors: 0 } });

    await expect(promise).resolves.toEqual({ count: 1, checked: 1, fixed: 1, errors: 0 });
  });

  it('refreshes external ratings and returns summary', async () => {
    const promise = lastValueFrom(service.refreshExternalRatings());

    const refreshRequest = httpMock.expectOne('https://api.test/collection-items/actions/refresh-external-ratings');
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ data: { count: 5, checked: 5, fixed: 1, errors: 0 } });

    await expect(promise).resolves.toEqual({ count: 5, checked: 5, fixed: 1, errors: 0 });
  });

  it('refreshes shared library external ratings when owner share code is provided', async () => {
    const promise = lastValueFrom(service.refreshExternalRatings('owner-code'));

    const refreshRequest = httpMock.expectOne(
      'https://api.test/collection-items/actions/refresh-external-ratings?ownerShareCode=owner-code'
    );
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ data: { count: 1, checked: 1, fixed: 1, errors: 0 } });

    await expect(promise).resolves.toEqual({ count: 1, checked: 1, fixed: 1, errors: 0 });
  });

  it('alerts and rethrows when refreshImages fails', async () => {
    const promise = lastValueFrom(service.refreshImages());

    const refreshRequest = httpMock.expectOne('https://api.test/collection-items/actions/refresh-images');
    refreshRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when getAccessTokens fails', async () => {
    const promise = lastValueFrom(service.getAccessTokens());

    const accessTokensRequest = httpMock.expectOne('https://api.test/users/me/access-tokens');
    accessTokensRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
