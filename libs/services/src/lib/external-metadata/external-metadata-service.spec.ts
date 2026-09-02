import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from '../alert-service';
import { apiStateToken, initialApiState, type ApiState } from '../api/api-store';
import { ExternalMetadataService } from './external-metadata-service';

const API_URL = 'https://api.test/api/v1';
const matrixReference = 'omdb/tt0133093';
const directMatrixReference = 'imdb/tt0133093';
const duneReference = 'omdb/tt1160419';
const missingReference = 'omdb/tt0000000';

describe('ExternalMetadataService', () => {
  let service: ExternalMetadataService;
  let httpMock: HttpTestingController;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ExternalMetadataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialApiState, apiStateToken),
        { provide: AlertService, useValue: { show: alertSpy } },
      ],
    });

    service = TestBed.inject(ExternalMetadataService);
    httpMock = TestBed.inject(HttpTestingController);
    apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', API_URL);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches metadata for an IMDb id in the search text', () => {
    service.getMatchedContents('see tt0133093 now');

    const detailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093`
    );
    detailRequest.flush({
      data: {
        provider: 'omdb',
        providerItemId: 'tt0133093',
        externalIds: [{ source: 'imdb', id: 'tt0133093' }],
        title: 'The Matrix',
        year: '1999',
        contentType: 'movie',
        poster: 'matrix.jpg',
        plot: 'Plot text',
        actors: 'Keanu Reeves',
        genres: ['Sci-Fi'],
        ratings: [{ source: 'Internet Movie Database', value: '8.7' }],
      } satisfies ExternalMetadataItemModel,
    });

    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: 'matrix.jpg',
        text: 'The Matrix',
        value: directMatrixReference,
        year: '1999',
        actors: 'Keanu Reeves',
      },
    ]);
    expect(service.getProviderReference(directMatrixReference)).toEqual({
      identitySource: 'imdb',
      identityId: 'tt0133093',
      externalIds: [{ source: 'imdb', id: 'tt0133093' }],
    });
    expect(service.completedSearchText()).toBe('see tt0133093 now');
    expect(service.searchPending()).toBe(false);
  });

  it('cancels pending requests and clears results for empty search text', () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);

    service.getMatchedContents('   ');

    expect(searchRequest.cancelled).toBe(true);
    expect(service.matchedContent()).toEqual([]);
    expect(service.getProviderReference(matrixReference)).toBeNull();
    expect(service.searchPending()).toBe(false);
  });

  it('cancels pending requests when the service is destroyed', () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);

    TestBed.resetTestingModule();

    expect(searchRequest.cancelled).toBe(true);
    expect(service.searchPending()).toBe(false);
  });

  it('extracts an IMDb id from a URL when searching with the omdb provider', () => {
    service.getMatchedContents('https://www.imdb.com/title/tt0116213', 'omdb');

    const detailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0116213`
    );
    detailRequest.flush({
      data: {
        provider: 'omdb',
        providerItemId: 'tt0116213',
        title: 'The Truth About Cats & Dogs',
        year: '1996',
        contentType: 'movie',
        poster: '',
        plot: '',
        actors: '',
        genres: [],
        ratings: [],
      } satisfies ExternalMetadataItemModel,
    });

    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: '',
        text: 'The Truth About Cats & Dogs',
        value: 'imdb/tt0116213',
        year: '1996',
      },
    ]);
    expect(service.getProviderReference('imdb/tt0116213')).toEqual({
      identitySource: 'imdb',
      identityId: 'tt0116213',
      externalIds: [{ source: 'imdb', id: 'tt0116213' }],
    });
  });

  it('extracts a bare IMDb id when searching with the omdb provider', () => {
    service.getMatchedContents('tt0133093', 'omdb');

    const detailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093`
    );
    detailRequest.flush({
      data: {
        provider: 'omdb',
        providerItemId: 'tt0133093',
        title: 'The Matrix',
        year: '1999',
        contentType: 'movie',
        poster: '',
        plot: '',
        actors: '',
        genres: [],
        ratings: [],
      } satisfies ExternalMetadataItemModel,
    });

    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: '',
        text: 'The Matrix',
        value: directMatrixReference,
        year: '1999',
      },
    ]);
  });

  it('clears previous results while direct IMDb metadata is loading', () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);
    searchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt0133093',
            title: 'The Matrix',
            year: '1999',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [],
          },
        ],
      },
    });

    service.getMatchedContents('tt1160419');

    expect(service.matchedContent()).toEqual([]);
    expect(service.getProviderReference(matrixReference)).toBeNull();
    httpMock
      .expectOne(`${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt1160419`)
      .flush('missing', { status: 404, statusText: 'Not Found' });
  });

  it('requests search results and maps them to select options', async () => {
    service.getMatchedContents('Matrix');

    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);
    searchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt0133093',
            title: 'The Matrix',
            year: '1999',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: 'Keanu Reeves',
            genres: [],
            ratings: [{ source: 'Internet Movie Database', value: '8.7' }],
          },
        ],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: '',
        text: 'The Matrix',
        value: matrixReference,
        year: '1999',
        actors: 'Keanu Reeves',
      },
    ]);
    expect(service.getProviderReference(matrixReference)).toEqual({ identitySource: 'omdb', identityId: 'tt0133093' });
    expect(service.completedSearchText()).toBe('Matrix');
  });

  it('limits provider-specific searches and does not treat ISBN text as an IMDb lookup', () => {
    service.getMatchedContents('tt0133093', 'openlibrary');

    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=tt0133093&provider=openlibrary`);
    searchRequest.flush({ data: { results: [] } });

    expect(service.matchedContent()).toEqual([]);
  });

  it('uses encoded reference keys without parsing provider references from JSON', async () => {
    service.getMatchedContents('Provider punctuation');

    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Provider%20punctuation`);
    searchRequest.flush({
      data: {
        results: [
          {
            provider: 'provider:name',
            providerItemId: 'id,with/slash',
            externalIds: [{ source: 'imdb', id: 'tt0133093' }],
            title: 'Provider Punctuation',
            year: '1999',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [],
          },
        ],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const encodedReference = 'provider%3Aname/id%2Cwith%2Fslash';
    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: '',
        text: 'Provider Punctuation',
        value: encodedReference,
        year: '1999',
      },
    ]);
    expect(service.getProviderReference(encodedReference)).toEqual({
      identitySource: 'provider:name',
      identityId: 'id,with/slash',
      externalIds: [{ source: 'imdb', id: 'tt0133093' }],
    });
  });

  it('cancels stale search requests', () => {
    service.getMatchedContents('Matrix');
    const firstSearchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);

    service.getMatchedContents('Dune');
    const secondSearchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Dune`);

    expect(firstSearchRequest.cancelled).toBe(true);

    expect(service.matchedContent()).toEqual([]);
    expect(service.completedSearchText()).toBe('');

    secondSearchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt1160419',
            title: 'Dune',
            year: '2021',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [{ source: 'Internet Movie Database', value: '8.0' }],
          },
        ],
      },
    });

    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: '',
        text: 'Dune',
        value: duneReference,
        year: '2021',
      },
    ]);
    expect(service.getProviderReference(matrixReference)).toBeNull();
    expect(service.getProviderReference(duneReference)).toEqual({ identitySource: 'omdb', identityId: 'tt1160419' });
    expect(service.completedSearchText()).toBe('Dune');
  });

  it('ignores stale direct IMDb responses', () => {
    service.getMatchedContents('tt0133093');
    const directRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093`
    );

    service.getMatchedContents('Dune');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Dune`);

    expect(directRequest.cancelled).toBe(true);
    searchRequest.flush({ data: { results: [] } });

    expect(service.matchedContent()).toEqual([]);
    expect(service.getProviderReference(directMatrixReference)).toBeNull();
    expect(service.completedSearchText()).toBe('Dune');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('cancels a pending title search when starting a direct IMDb lookup', () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);

    service.getMatchedContents('tt0133093');

    expect(searchRequest.cancelled).toBe(true);
    httpMock
      .expectOne(`${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093`)
      .flush('missing', { status: 404, statusText: 'Not Found' });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('sets an empty result list when search returns no matches', () => {
    service.getMatchedContents('Nothing');

    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Nothing`);
    searchRequest.flush({ data: { results: [] } });

    expect(service.matchedContent()).toEqual([]);
    expect(service.completedSearchText()).toBe('Nothing');
  });

  it('alerts and throws when search request fails', () => {
    service.getMatchedContents('OldSearch');
    const oldSearchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=OldSearch`);
    oldSearchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt0133093',
            title: 'The Matrix',
            year: '1999',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [{ source: 'Internet Movie Database', value: '8.7' }],
          },
        ],
      },
    });

    service.getMatchedContents('ErrorSearch');

    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=ErrorSearch`);
    searchRequest.flush('failed', { status: 500, statusText: 'Server Error' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(service.matchedContent()).toEqual([]);
    expect(service.getProviderReference(matrixReference)).toBeNull();
    expect(service.completedSearchText()).toBe('ErrorSearch');
  });

  it('clears suggestions when a direct IMDb lookup fails', () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);
    searchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt0133093',
            title: 'The Matrix',
            year: '1999',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [],
          },
        ],
      },
    });

    service.getMatchedContents('tt0000000');
    const detailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0000000`
    );
    detailRequest.flush('missing', { status: 404, statusText: 'Not Found' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(service.matchedContent()).toEqual([]);
    expect(service.getProviderReference(matrixReference)).toBeNull();
    expect(service.completedSearchText()).toBe('tt0000000');
  });

  it('clears suggestions when response has no results property', () => {
    service.getMatchedContents('NoProp');

    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=NoProp`);
    searchRequest.flush({ data: {} });

    expect(service.matchedContent()).toEqual([]);
  });

  it('fetches a selected item by id', async () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Matrix`);
    searchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt0133093',
            title: 'The Matrix',
            year: '1999',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [],
          },
        ],
      },
    });

    const selected$ = service.getSelectedContent(matrixReference).pipe(filter(Boolean));

    const detailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=omdb&externalIdentityId=tt0133093`
    );
    detailRequest.flush({
      data: {
        provider: 'omdb',
        providerItemId: 'tt0133093',
        title: 'The Matrix',
        year: '1999',
        contentType: 'movie',
        poster: '',
        plot: 'Plot text',
        actors: 'Keanu Reeves',
        genres: ['Sci-Fi'],
        ratings: [{ source: 'Internet Movie Database', value: '8.7' }],
      } satisfies ExternalMetadataItemModel,
    });

    const result = await firstValueFrom(selected$);
    expect(result?.title).toBe('The Matrix');
    expect(service.selectedContent()).toEqual(result);
  });

  it('fetches a direct IMDb id through the server resolver', async () => {
    service.getMatchedContents('tt0133093');
    const searchDetailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093`
    );
    searchDetailRequest.flush({
      data: {
        provider: 'omdb',
        providerItemId: 'tt0133093',
        title: 'The Matrix',
        year: '1999',
        contentType: 'movie',
        poster: '',
        plot: 'Plot text',
        actors: 'Keanu Reeves',
        genres: ['Sci-Fi'],
        ratings: [{ source: 'Internet Movie Database', value: '8.7' }],
      } satisfies ExternalMetadataItemModel,
    });

    const selected$ = service.getSelectedContent(directMatrixReference).pipe(filter(Boolean));

    const result = await firstValueFrom(selected$);
    expect(result?.provider).toBe('omdb');
    httpMock.expectNone(`${API_URL}/external-metadata/items?externalIdentitySource=imdb&externalIdentityId=tt0133093`);
  });

  it('alerts and throws when fetching selected item fails', () => {
    service.getMatchedContents('Missing');
    const searchRequest = httpMock.expectOne(`${API_URL}/external-metadata/search?s=Missing`);
    searchRequest.flush({
      data: {
        results: [
          {
            provider: 'omdb',
            providerItemId: 'tt0000000',
            title: 'Missing',
            year: '1900',
            contentType: 'movie',
            poster: '',
            plot: '',
            actors: '',
            genres: [],
            ratings: [],
          },
        ],
      },
    });

    service.getSelectedContent(missingReference);

    const detailRequest = httpMock.expectOne(
      `${API_URL}/external-metadata/items?externalIdentitySource=omdb&externalIdentityId=tt0000000`
    );
    detailRequest.flush('missing', { status: 404, statusText: 'Not Found' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
