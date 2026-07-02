import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from '../alert-service';
import { ApiState, apiStateToken, initialApiState } from '../api/api-store';
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

  it('uses an IMDb id in the search text without calling the API', () => {
    service.getMatchedContents('see tt0133093 now');

    expect(service.matchedContent()).toEqual([{ text: 'IMDb id: tt0133093', value: directMatrixReference }]);
    expect(service.getProviderReference(directMatrixReference)).toEqual({
      identitySource: 'imdb',
      identityId: 'tt0133093',
      externalIds: [{ source: 'imdb', id: 'tt0133093' }],
    });
    expect(service.completedSearchText()).toBe('');
    httpMock.expectNone(() => true);
  });

  it('requests search results and maps them to select options', async () => {
    service.getMatchedContents('Matrix');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Matrix`);
    searchRequest.flush({
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
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(service.matchedContent()).toEqual([
      {
        contentType: 'movie',
        poster: '',
        text: 'The Matrix',
        value: matrixReference,
        year: '1999',
      },
    ]);
    expect(service.getProviderReference(matrixReference)).toEqual({ identitySource: 'omdb', identityId: 'tt0133093' });
    expect(service.completedSearchText()).toBe('Matrix');
  });

  it('uses encoded reference keys without parsing provider references from JSON', async () => {
    service.getMatchedContents('Provider punctuation');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Provider%20punctuation`);
    searchRequest.flush({
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

  it('ignores stale search responses', () => {
    service.getMatchedContents('Matrix');
    const firstSearchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Matrix`);

    service.getMatchedContents('Dune');
    const secondSearchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Dune`);

    firstSearchRequest.flush({
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
    });

    expect(service.matchedContent()).toEqual([]);
    expect(service.completedSearchText()).toBe('');

    secondSearchRequest.flush({
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

  it('sets an empty result list when search returns no matches', () => {
    service.getMatchedContents('Nothing');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Nothing`);
    searchRequest.flush({ results: [] });

    expect(service.matchedContent()).toEqual([]);
    expect(service.completedSearchText()).toBe('Nothing');
  });

  it('alerts and throws when search request fails', () => {
    service.getMatchedContents('OldSearch');
    const oldSearchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=OldSearch`);
    oldSearchRequest.flush({
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
    });

    service.getMatchedContents('ErrorSearch');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=ErrorSearch`);
    searchRequest.flush('failed', { status: 500, statusText: 'Server Error' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(service.matchedContent()).toEqual([]);
    expect(service.getProviderReference(matrixReference)).toBeNull();
    expect(service.completedSearchText()).toBe('ErrorSearch');
  });

  it('clears suggestions when response has no results property', () => {
    service.getMatchedContents('NoProp');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=NoProp`);
    searchRequest.flush({});

    expect(service.matchedContent()).toEqual([]);
  });

  it('fetches a selected item by id', async () => {
    service.getMatchedContents('Matrix');
    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Matrix`);
    searchRequest.flush({
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
    });

    const selected$ = service.getSelectedContent(matrixReference).pipe(filter(Boolean));

    const detailRequest = httpMock.expectOne(
      `${API_URL}/proxy/external-metadata/item?externalIdentitySource=omdb&externalIdentityId=tt0133093`
    );
    detailRequest.flush({
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
    } satisfies ExternalMetadataItemModel);

    const result = await firstValueFrom(selected$);
    expect(result?.title).toBe('The Matrix');
    expect(service.selectedContent()).toEqual(result);
  });

  it('fetches a direct IMDb id through the server resolver', async () => {
    service.getMatchedContents('tt0133093');

    const selected$ = service.getSelectedContent(directMatrixReference).pipe(filter(Boolean));

    const detailRequest = httpMock.expectOne(
      `${API_URL}/proxy/external-metadata/item?externalIdentitySource=imdb&externalIdentityId=tt0133093`
    );
    detailRequest.flush({
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
    } satisfies ExternalMetadataItemModel);

    const result = await firstValueFrom(selected$);
    expect(result?.provider).toBe('omdb');
  });

  it('alerts and throws when fetching selected item fails', () => {
    service.getMatchedContents('Missing');
    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/external-metadata/search?s=Missing`);
    searchRequest.flush({
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
    });

    service.getSelectedContent(missingReference);

    const detailRequest = httpMock.expectOne(
      `${API_URL}/proxy/external-metadata/item?externalIdentitySource=omdb&externalIdentityId=tt0000000`
    );
    detailRequest.flush('missing', { status: 404, statusText: 'Not Found' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
