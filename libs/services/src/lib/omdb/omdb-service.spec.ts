import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '../alert-service';
import { ApiState, apiStateToken, initialApiState } from '../api/api-store';
import { getParserRegexp, setParserRegexp } from '../parser/parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { OMDbResponseItemModel } from '@shared/models/omdb-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OMDbService } from './omdb-service';

const API_URL = 'https://api.test/api/v1';

describe('OMDbService', () => {
  let service: OMDbService;
  let httpMock: HttpTestingController;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    setParserRegexp('IMDbId', getParserRegexp('IMDbId') ?? PARSER_REGEXPS.IMDbId);
  });

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        OMDbService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialApiState, apiStateToken),
        { provide: AlertService, useValue: { show: alertSpy } },
      ],
    });

    service = TestBed.inject(OMDbService);
    httpMock = TestBed.inject(HttpTestingController);
    apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', API_URL);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses an IMDb id in the search text without calling the API', () => {
    service.getMatchedContents('see tt0133093 now');

    expect(service.matchedContent()).toEqual([{ text: 'IMDb id: tt0133093', value: 'tt0133093' }]);
    httpMock.expectNone(() => true);
  });

  it('requests search results and maps them to select options', () => {
    service.getMatchedContents('Matrix');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/omdb/search?s=Matrix`);
    searchRequest.flush({
      Search: [
        {
          imdbID: 'tt0133093',
          imdbRating: '8.7',
          Plot: '',
          Poster: '',
          Type: 'movie',
          Title: 'The Matrix',
          Year: '1999',
          Director: '',
          Genre: '',
          Actors: '',
        },
      ],
    });

    expect(service.matchedContent()).toEqual([{ text: '(movie) The Matrix (1999)', value: 'tt0133093' }]);
  });

  it('sets an empty result list when search returns no matches', () => {
    service.getMatchedContents('Nothing');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/omdb/search?s=Nothing`);
    searchRequest.flush({ Search: [] });

    expect(service.matchedContent()).toEqual([]);
  });

  it('alerts and throws when search request fails', () => {
    service.getMatchedContents('ErrorSearch');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/omdb/search?s=ErrorSearch`);
    searchRequest.flush('failed', { status: 500, statusText: 'Server Error' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('clears suggestions when response has no Search property', () => {
    service.getMatchedContents('NoProp');

    const searchRequest = httpMock.expectOne(`${API_URL}/proxy/omdb/search?s=NoProp`);
    searchRequest.flush({});

    expect(service.matchedContent()).toEqual([]);
  });

  it('fetches a selected item by id', async () => {
    const selected$ = service.getSelectedContent('tt0133093').pipe(filter(Boolean));

    const detailRequest = httpMock.expectOne(`${API_URL}/proxy/omdb/item?i=tt0133093`);
    detailRequest.flush({
      imdbID: 'tt0133093',
      imdbRating: '8.7',
      Plot: 'Plot text',
      Poster: '',
      Type: 'movie',
      Title: 'The Matrix',
      Year: '1999',
      Director: 'The Wachowskis',
      Genre: 'Sci-Fi',
      Actors: 'Keanu Reeves',
    } satisfies OMDbResponseItemModel);

    const result = await firstValueFrom(selected$);
    expect(result?.Title).toBe('The Matrix');
    expect(service.selectedContent()).toEqual(result);
  });

  it('alerts and throws when fetching selected item fails', () => {
    service.getSelectedContent('tt0000000');

    const detailRequest = httpMock.expectOne(`${API_URL}/proxy/omdb/item?i=tt0000000`);
    detailRequest.flush('missing', { status: 404, statusText: 'Not Found' });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
