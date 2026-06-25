import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '../alert-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { defaultIfEmpty, lastValueFrom } from 'rxjs';
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

    const logoutRequest = httpMock.expectOne('https://api.test/logout');
    expect(logoutRequest.request.method).toBe('DELETE');
    logoutRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('creates an item with provided data', async () => {
    const item = {
      image: '',
      title: 'note',
      genre: [],
      IMDbId: 'tt123',
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
    };
    const promise = lastValueFrom(service.create(item));

    const createRequest = httpMock.expectOne('https://api.test/create');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(item);
    createRequest.flush({ item });

    await expect(promise).resolves.toEqual({ item });
  });

  it('updates an item and returns new hash', async () => {
    const item = {
      image: '',
      title: 'updated',
      genre: [],
      IMDbId: 'tt123',
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
    };
    const promise = lastValueFrom(service.update('tt123', item, 'old-hash'));

    const updateRequest = httpMock.expectOne('https://api.test/change/tt123');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({ ...item, hash: 'old-hash' });
    updateRequest.flush({ item: { ...item, hash: 'new-hash' } });

    await expect(promise).resolves.toEqual({ item: { ...item, hash: 'new-hash' } });
  });

  it('alerts and rethrows when update fails', async () => {
    const item = {
      image: '',
      title: 'updated',
      genre: [],
      IMDbId: 'tt123',
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
    };
    const promise = lastValueFrom(service.update('tt123', item, 'old-hash').pipe(defaultIfEmpty(undefined)));

    const updateRequest = httpMock.expectOne('https://api.test/change/tt123');
    updateRequest.flush('failed', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('deletes an item with hash as query param', async () => {
    const promise = lastValueFrom(service.delete('tt123', 'abc123'));

    const deleteRequest = httpMock.expectOne('https://api.test/delete/tt123?hash=abc123');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('retrieves access tokens', async () => {
    const promise = lastValueFrom(service.getAccessTokens());

    const accessTokensRequest = httpMock.expectOne('https://api.test/user/access-tokens');
    expect(accessTokensRequest.request.method).toBe('GET');
    accessTokensRequest.flush([{ tokenHash: 'token' }]);

    await expect(promise).resolves.toEqual([{ tokenHash: 'token' }]);
  });

  it('deletes an access token by hash', async () => {
    const promise = lastValueFrom(service.deleteAccessToken('abc123'));

    const deleteAccessTokenRequest = httpMock.expectOne('https://api.test/user/access-token/abc123');
    expect(deleteAccessTokenRequest.request.method).toBe('DELETE');
    deleteAccessTokenRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('creates a new access token', async () => {
    const promise = lastValueFrom(service.createAccessToken());

    const createAccessTokenRequest = httpMock.expectOne('https://api.test/user/access-token');
    expect(createAccessTokenRequest.request.method).toBe('POST');
    createAccessTokenRequest.flush({ token: 'new-token' });

    await expect(promise).resolves.toEqual({ token: 'new-token' });
  });

  it('creates a new user token', async () => {
    const promise = lastValueFrom(service.createNewUserToken());

    const newUserTokenRequest = httpMock.expectOne('https://api.test/user/change-token');
    expect(newUserTokenRequest.request.method).toBe('PUT');
    newUserTokenRequest.flush({ token: 'user-token' });

    await expect(promise).resolves.toEqual({ token: 'user-token' });
  });

  it('deletes the current user', async () => {
    const promise = lastValueFrom(service.deleteUser());

    const deleteUserRequest = httpMock.expectOne('https://api.test/user');
    expect(deleteUserRequest.request.method).toBe('DELETE');
    deleteUserRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('deletes all movie tracker items', async () => {
    const promise = lastValueFrom(service.deleteAllMovieTrackerItems());

    const deleteRequest = httpMock.expectOne('https://api.test/movie-tracker');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ changedCount: 2 });

    await expect(promise).resolves.toEqual({ changedCount: 2 });
  });

  it('deletes all series tracker items', async () => {
    const promise = lastValueFrom(service.deleteAllSeriesTrackerItems());

    const deleteRequest = httpMock.expectOne('https://api.test/series-tracker');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ changedCount: 3 });

    await expect(promise).resolves.toEqual({ changedCount: 3 });
  });

  it('retrieves user tag management', async () => {
    const promise = lastValueFrom(service.getUserTagManagement());

    const tagManagementRequest = httpMock.expectOne('https://api.test/tag-management');
    expect(tagManagementRequest.request.method).toBe('GET');
    tagManagementRequest.flush([
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);

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

    const updateTagManagementRequest = httpMock.expectOne('https://api.test/tag-management');
    expect(updateTagManagementRequest.request.method).toBe('POST');
    expect(updateTagManagementRequest.request.body).toEqual(payload);
    updateTagManagementRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('retrieves user settings', async () => {
    const promise = lastValueFrom(service.getUserSettings());

    const userSettingsRequest = httpMock.expectOne('https://api.test/user/settings');
    expect(userSettingsRequest.request.method).toBe('GET');
    userSettingsRequest.flush({
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
    });

    await expect(promise).resolves.toEqual({
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
    });
  });

  it('retrieves AI availability', async () => {
    const promise = lastValueFrom(service.getAiAvailable());

    const aiAvailableRequest = httpMock.expectOne('https://api.test/proxy/ai/available');
    expect(aiAvailableRequest.request.method).toBe('GET');
    aiAvailableRequest.flush({ aiAvailable: true });

    await expect(promise).resolves.toEqual({ aiAvailable: true });
  });

  it('posts a prompt to the AI query endpoint and returns matched IDs', async () => {
    const promise = lastValueFrom(service.getAiQueryData('sci-fi movies'));

    const aiRequest = httpMock.expectOne('https://api.test/proxy/ai/query');
    expect(aiRequest.request.method).toBe('POST');
    expect(aiRequest.request.body).toEqual({ prompt: 'sci-fi movies' });
    aiRequest.flush({ matchedIds: ['tt0133093', 'tt0372784'] });

    await expect(promise).resolves.toEqual({ matchedIds: ['tt0133093', 'tt0372784'] });
  });

  it('retrieves user export data', async () => {
    const exportData = { userSettings: {}, collectionItems: [], tagManagement: [], seriesTrackerData: {} };
    const promise = lastValueFrom(service.getUserExport());

    const exportRequest = httpMock.expectOne('https://api.test/export');
    expect(exportRequest.request.method).toBe('GET');
    exportRequest.flush(exportData);

    await expect(promise).resolves.toEqual(exportData);
  });

  it('imports user export data', async () => {
    const importData = {
      type: 'collection-tracker-export',
      version: 1,
      userSettings: {},
      collectionItems: [],
      tagManagement: [],
      seriesTrackerData: {},
    };
    const importResult = {
      importedCollectionItems: 0,
      importedTagManagement: 0,
      importedSeriesTrackerSeasons: 0,
      importedSeriesTrackerWatchedEpisodes: 0,
    };
    const promise = lastValueFrom(service.importUserExport(importData));

    const importRequest = httpMock.expectOne('https://api.test/import');
    expect(importRequest.request.method).toBe('POST');
    expect(importRequest.request.body).toEqual(importData);
    importRequest.flush(importResult);

    await expect(promise).resolves.toEqual(importResult);
  });

  it('imports collection items from source text', async () => {
    const promise = lastValueFrom(service.importCollectionItems('tt0133093'));

    const importRequest = httpMock.expectOne('https://api.test/import/collection-items');
    expect(importRequest.request.method).toBe('POST');
    expect(importRequest.request.body).toEqual({ source: 'tt0133093' });
    importRequest.flush({ totalCount: 1, importedCount: 1, skippedCount: 0, errorCount: 0 });

    await expect(promise).resolves.toEqual({ totalCount: 1, importedCount: 1, skippedCount: 0, errorCount: 0 });
  });

  it('alerts and rethrows when AI query fails', async () => {
    const promise = lastValueFrom(service.getAiQueryData('sci-fi movies'));

    const aiRequest = httpMock.expectOne('https://api.test/proxy/ai/query');
    aiRequest.flush('bad', { status: 502, statusText: 'Bad Gateway' });

    await expect(promise).rejects.toMatchObject({ status: 502 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when retrieving user tag management fails', async () => {
    const promise = lastValueFrom(service.getUserTagManagement());

    const tagManagementRequest = httpMock.expectOne('https://api.test/tag-management');
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

    const updateTagManagementRequest = httpMock.expectOne('https://api.test/tag-management');
    updateTagManagementRequest.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when retrieving user settings fails', async () => {
    const promise = lastValueFrom(service.getUserSettings());

    const userSettingsRequest = httpMock.expectOne('https://api.test/user/settings');
    userSettingsRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when logout fails', async () => {
    const promise = lastValueFrom(service.logout());

    const logoutRequest = httpMock.expectOne('https://api.test/logout');
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
      tags: [],
      year: null,
      rate: '',
      rottenTomatoesRate: '',
      metacriticRate: '',
      userRate: null,
      actors: '',
      plot: '',
    };
    const promise = lastValueFrom(service.create(item));

    const createRequest = httpMock.expectOne('https://api.test/create');
    createRequest.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when deleteAccessToken fails', async () => {
    const promise = lastValueFrom(service.deleteAccessToken('hash'));

    const deleteAccessTokenRequest = httpMock.expectOne('https://api.test/user/access-token/hash');
    deleteAccessTokenRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when createAccessToken fails', async () => {
    const promise = lastValueFrom(service.createAccessToken());

    const createAccessTokenRequest = httpMock.expectOne('https://api.test/user/access-token');
    createAccessTokenRequest.flush('bad', { status: 502, statusText: 'Bad Gateway' });

    await expect(promise).rejects.toMatchObject({ status: 502 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when createNewUserToken fails', async () => {
    const promise = lastValueFrom(service.createNewUserToken());

    const newUserTokenRequest = httpMock.expectOne('https://api.test/user/change-token');
    newUserTokenRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when deleteUser fails', async () => {
    const promise = lastValueFrom(service.deleteUser());

    const deleteUserRequest = httpMock.expectOne('https://api.test/user');
    deleteUserRequest.flush('bad', { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when delete fails', async () => {
    const promise = lastValueFrom(service.delete('tt123', 'somehash'));

    const deleteRequest = httpMock.expectOne('https://api.test/delete/tt123?hash=somehash');
    deleteRequest.flush('bad', { status: 404, statusText: 'Not Found' });

    await expect(promise).rejects.toMatchObject({ status: 404 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('marks all movies as watched for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllMoviesAsWatched('owner-code'));

    const markAllRequest = httpMock.expectOne('https://api.test/items/mark-all-watched?ownerShareCode=owner-code');
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ changedCount: 2 });

    await expect(promise).resolves.toEqual({ changedCount: 2 });
  });

  it('marks all movies as unwatched for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllMoviesAsUnwatched('owner-code'));

    const markAllRequest = httpMock.expectOne('https://api.test/items/mark-all-unwatched?ownerShareCode=owner-code');
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ changedCount: 1 });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('marks all series as watched for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllSeriesAsWatched('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/items/mark-all-series-watched?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ trackedCount: 2, progressChangedCount: 3 });

    await expect(promise).resolves.toEqual({ trackedCount: 2, progressChangedCount: 3 });
  });

  it('marks all series as unwatched for the selected shared library', async () => {
    const promise = lastValueFrom(service.markAllSeriesAsUnwatched('owner-code'));

    const markAllRequest = httpMock.expectOne(
      'https://api.test/items/mark-all-series-unwatched?ownerShareCode=owner-code'
    );
    expect(markAllRequest.request.method).toBe('POST');
    markAllRequest.flush({ changedCount: 1 });

    await expect(promise).resolves.toEqual({ changedCount: 1 });
  });

  it('copies a shared library series to the series tracker', async () => {
    const promise = lastValueFrom(service.addSeriesTrackerItem('tt-series', undefined, 'owner-code'));

    const request = httpMock.expectOne('https://api.test/series-tracker/tt-series?ownerShareCode=owner-code');
    expect(request.request.method).toBe('POST');
    request.flush({ item: { IMDbId: 'tt-series', listType: 'series-tracker' } });

    await expect(promise).resolves.toEqual({ item: { IMDbId: 'tt-series', listType: 'series-tracker' } });
  });

  it('refreshes images and returns summary', async () => {
    const promise = lastValueFrom(service.refreshImages());

    const refreshRequest = httpMock.expectOne('https://api.test/items/refresh-images');
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ count: 5, checked: 5, fixed: 1, errors: 0 });

    await expect(promise).resolves.toEqual({ count: 5, checked: 5, fixed: 1, errors: 0 });
  });

  it('refreshes shared library images when owner share code is provided', async () => {
    const promise = lastValueFrom(service.refreshImages('owner-code'));

    const refreshRequest = httpMock.expectOne('https://api.test/items/refresh-images?ownerShareCode=owner-code');
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ count: 1, checked: 1, fixed: 1, errors: 0 });

    await expect(promise).resolves.toEqual({ count: 1, checked: 1, fixed: 1, errors: 0 });
  });

  it('refreshes external ratings and returns summary', async () => {
    const promise = lastValueFrom(service.refreshExternalRatings());

    const refreshRequest = httpMock.expectOne('https://api.test/items/refresh-external-ratings');
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ count: 5, checked: 5, fixed: 1, errors: 0 });

    await expect(promise).resolves.toEqual({ count: 5, checked: 5, fixed: 1, errors: 0 });
  });

  it('refreshes shared library external ratings when owner share code is provided', async () => {
    const promise = lastValueFrom(service.refreshExternalRatings('owner-code'));

    const refreshRequest = httpMock.expectOne(
      'https://api.test/items/refresh-external-ratings?ownerShareCode=owner-code'
    );
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ count: 1, checked: 1, fixed: 1, errors: 0 });

    await expect(promise).resolves.toEqual({ count: 1, checked: 1, fixed: 1, errors: 0 });
  });

  it('alerts and rethrows when refreshImages fails', async () => {
    const promise = lastValueFrom(service.refreshImages());

    const refreshRequest = httpMock.expectOne('https://api.test/items/refresh-images');
    refreshRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when getAccessTokens fails', async () => {
    const promise = lastValueFrom(service.getAccessTokens());

    const accessTokensRequest = httpMock.expectOne('https://api.test/user/access-tokens');
    accessTokensRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
