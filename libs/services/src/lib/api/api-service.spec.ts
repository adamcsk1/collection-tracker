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

  it('retrieves user tag configs', async () => {
    const promise = lastValueFrom(service.getUserTagConfigs());

    const tagConfigsRequest = httpMock.expectOne('https://api.test/tag/config');
    expect(tagConfigsRequest.request.method).toBe('GET');
    tagConfigsRequest.flush([
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

  it('updates user tag configs', async () => {
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
    const promise = lastValueFrom(service.updateUserTagConfigs(payload));

    const updateTagConfigsRequest = httpMock.expectOne('https://api.test/tag/change-config');
    expect(updateTagConfigsRequest.request.method).toBe('POST');
    expect(updateTagConfigsRequest.request.body).toEqual(payload);
    updateTagConfigsRequest.flush({});

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
      aiAvailable: true,
    });

    await expect(promise).resolves.toEqual({
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
      aiAvailable: true,
    });
  });

  it('posts a prompt to the AI query endpoint and returns matched IDs', async () => {
    const promise = lastValueFrom(service.getAiQueryData('sci-fi movies'));

    const aiRequest = httpMock.expectOne('https://api.test/proxy/ai/query');
    expect(aiRequest.request.method).toBe('POST');
    expect(aiRequest.request.body).toEqual({ prompt: 'sci-fi movies' });
    aiRequest.flush({ matchedIds: ['tt0133093', 'tt0372784'] });

    await expect(promise).resolves.toEqual({ matchedIds: ['tt0133093', 'tt0372784'] });
  });

  it('alerts and rethrows when AI query fails', async () => {
    const promise = lastValueFrom(service.getAiQueryData('sci-fi movies'));

    const aiRequest = httpMock.expectOne('https://api.test/proxy/ai/query');
    aiRequest.flush('bad', { status: 502, statusText: 'Bad Gateway' });

    await expect(promise).rejects.toMatchObject({ status: 502 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when retrieving user tag configs fails', async () => {
    const promise = lastValueFrom(service.getUserTagConfigs());

    const tagConfigsRequest = httpMock.expectOne('https://api.test/tag/config');
    tagConfigsRequest.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when updating user tag configs fails', async () => {
    const promise = lastValueFrom(
      service.updateUserTagConfigs([
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

    const updateTagConfigsRequest = httpMock.expectOne('https://api.test/tag/change-config');
    updateTagConfigsRequest.flush('bad', { status: 400, statusText: 'Bad Request' });

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

  it('refreshes images and returns summary', async () => {
    const promise = lastValueFrom(service.refreshImages());

    const refreshRequest = httpMock.expectOne('https://api.test/items/refresh-images');
    expect(refreshRequest.request.method).toBe('POST');
    refreshRequest.flush({ count: 5, checked: 5, fixed: 1, errors: 0 });

    await expect(promise).resolves.toEqual({ count: 5, checked: 5, fixed: 1, errors: 0 });
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
