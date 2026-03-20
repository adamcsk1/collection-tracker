import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '@services/alert-service';
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

  it('requests health against a temporary URL while suppressing errors', async () => {
    const promise = lastValueFrom(
      service.getHealth({ temporaryApiUrl: 'https://temp.api', suppressErrors: true }).pipe(defaultIfEmpty(undefined))
    );

    const healthRequest = httpMock.expectOne('https://temp.api/health');
    healthRequest.flush('offline', { status: 500, statusText: 'Server Error' });

    await expect(promise).resolves.toBeUndefined();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('alerts and rethrows when health check fails without suppression', async () => {
    const promise = lastValueFrom(service.getHealth({}));

    const healthRequest = httpMock.expectOne('https://api.test/health');
    healthRequest.flush('down', { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toContain('Service Unavailable');
  });

  it('posts signIn request with credentials', async () => {
    const promise = lastValueFrom(service.signIn('neo', 'matrix'));

    const signInRequest = httpMock.expectOne('https://api.test/sign-in');
    expect(signInRequest.request.method).toBe('POST');
    expect(signInRequest.request.body).toEqual({ username: 'neo', token: 'matrix' });
    signInRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('sends logout request', async () => {
    const promise = lastValueFrom(service.logout());

    const logoutRequest = httpMock.expectOne('https://api.test/logout');
    expect(logoutRequest.request.method).toBe('DELETE');
    logoutRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('validates access token', async () => {
    const promise = lastValueFrom(service.validateAccessToken());

    const validateRequest = httpMock.expectOne('https://api.test/user/access-token/validate');
    expect(validateRequest.request.method).toBe('GET');
    validateRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('creates an item with provided content', async () => {
    const promise = lastValueFrom(service.create('note text', 'note.md'));

    const createRequest = httpMock.expectOne('https://api.test/create');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({ content: 'note text', name: 'note.md' });
    createRequest.flush({ name: 'note.md' });

    await expect(promise).resolves.toEqual({ name: 'note.md' });
  });

  it('updates an item and alerts on error', async () => {
    const promise = lastValueFrom(service.update('item', 'updated').pipe(defaultIfEmpty(undefined)));

    const updateRequest = httpMock.expectOne('https://api.test/modify/item');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({ content: 'updated' });
    updateRequest.flush('failed', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('paginates getAll results and updates network status', () => {
    apiState.setState('fetchBatchSize', 2);

    const pages: { name: string; content: string }[][] = [];
    service.getAll().subscribe((items) => pages.push(items));

    expect(apiState.state.loadNetworkStatus()).toBe('pending');

    const page1Request = httpMock.expectOne('https://api.test/get-all?offset=0&limit=2');
    page1Request.flush([
      { name: 'a', content: '1' },
      { name: 'b', content: '2' },
    ]);

    const page2Request = httpMock.expectOne('https://api.test/get-all?offset=2&limit=2');
    page2Request.flush([{ name: 'c', content: '3' }]);

    const page3Request = httpMock.expectOne('https://api.test/get-all?offset=4&limit=2');
    page3Request.flush([]);

    expect(pages).toEqual([
      [
        { name: 'a', content: '1' },
        { name: 'b', content: '2' },
      ],
      [{ name: 'c', content: '3' }],
    ]);
    expect(apiState.state.loadNetworkStatus()).toBe('finished');
  });

  it('sets loadNetworkStatus to error when getAll fails', () => {
    apiState.setState('fetchBatchSize', 1);

    service.getAll().subscribe({
      error: () => {},
    });

    const failingRequest = httpMock.expectOne('https://api.test/get-all?offset=0&limit=1');
    failingRequest.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(apiState.state.loadNetworkStatus()).toBe('error');
  });

  it('sets loadNetworkStatus to error when a subsequent page fails', () => {
    apiState.setState('fetchBatchSize', 1);

    service.getAll().subscribe({
      next: () => {},
      error: () => {},
    });

    const firstPageRequest = httpMock.expectOne('https://api.test/get-all?offset=0&limit=1');
    firstPageRequest.flush([{ name: 'a', content: '1' }]);

    const secondPageRequest = httpMock.expectOne('https://api.test/get-all?offset=1&limit=1');
    secondPageRequest.flush('fail', { status: 500, statusText: 'Server Error' });

    expect(apiState.state.loadNetworkStatus()).toBe('error');
  });

  it('uses default fetchBatchSize and finishes when first page is empty', () => {
    apiState.setState('fetchBatchSize', null as number);

    const pages: { name: string; content: string }[][] = [];
    service.getAll().subscribe((items) => pages.push(items));

    const initialRequest = httpMock.expectOne('https://api.test/get-all?offset=0&limit=100');
    initialRequest.flush([]);

    expect(pages).toEqual([]);
    expect(apiState.state.loadNetworkStatus()).toBe('finished');
  });

  it('deletes an item', async () => {
    const promise = lastValueFrom(service.delete('item-1'));

    const deleteRequest = httpMock.expectOne('https://api.test/delete/item-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('retrieves access tokens', async () => {
    const promise = lastValueFrom(service.getAccessTokens());

    const accessTokensRequest = httpMock.expectOne('https://api.test/user/access-tokens');
    expect(accessTokensRequest.request.method).toBe('GET');
    accessTokensRequest.flush([{ name: 'token' }]);

    await expect(promise).resolves.toEqual([{ name: 'token' }]);
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
      fetchBatchSize: 50,
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
      claudeAiAvailable: true,
    });

    await expect(promise).resolves.toEqual({
      fetchBatchSize: 50,
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
      claudeAiAvailable: true,
    });
  });

  it('updates user settings', async () => {
    const payload = {
      fetchBatchSize: 50,
      theme: 'dark' as const,
      animatedBackground: false,
      language: 'en' as const,
    };
    const promise = lastValueFrom(service.updateUserSettings(payload));

    const updateUserSettingsRequest = httpMock.expectOne('https://api.test/user/settings');
    expect(updateUserSettingsRequest.request.method).toBe('POST');
    expect(updateUserSettingsRequest.request.body).toEqual(payload);
    updateUserSettingsRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('posts a prompt to the Claude query endpoint and returns matched IDs', async () => {
    const promise = lastValueFrom(service.getClaudeQueryData('sci-fi movies'));

    const claudeRequest = httpMock.expectOne('https://api.test/proxy/claude/query');
    expect(claudeRequest.request.method).toBe('POST');
    expect(claudeRequest.request.body).toEqual({ prompt: 'sci-fi movies' });
    claudeRequest.flush({ matchedIds: ['tt0133093', 'tt0372784'] });

    await expect(promise).resolves.toEqual({ matchedIds: ['tt0133093', 'tt0372784'] });
  });

  it('alerts and rethrows when Claude query fails', async () => {
    const promise = lastValueFrom(service.getClaudeQueryData('sci-fi movies'));

    const claudeRequest = httpMock.expectOne('https://api.test/proxy/claude/query');
    claudeRequest.flush('bad', { status: 502, statusText: 'Bad Gateway' });

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

  it('alerts and rethrows when updating user settings fails', async () => {
    const promise = lastValueFrom(
      service.updateUserSettings({
        fetchBatchSize: 50,
        theme: 'dark',
        animatedBackground: false,
        language: 'en',
      })
    );

    const updateUserSettingsRequest = httpMock.expectOne('https://api.test/user/settings');
    updateUserSettingsRequest.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when signUp fails', async () => {
    const promise = lastValueFrom(service.signUp('neo'));

    const signUpRequest = httpMock.expectOne('https://api.test/sign-up');
    signUpRequest.flush('invalid', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('alerts and rethrows when signIn fails', async () => {
    const promise = lastValueFrom(service.signIn('neo', 'invalid'));

    const signInRequest = httpMock.expectOne('https://api.test/sign-in');
    signInRequest.flush('bad', { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ status: 401 });
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
    const promise = lastValueFrom(service.create('note', 'note.md'));

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
    const promise = lastValueFrom(service.delete('missing'));

    const deleteRequest = httpMock.expectOne('https://api.test/delete/missing');
    deleteRequest.flush('bad', { status: 404, statusText: 'Not Found' });

    await expect(promise).rejects.toMatchObject({ status: 404 });
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
